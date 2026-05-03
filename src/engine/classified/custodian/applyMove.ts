/**
 * Custodian-engine apply-move (Phase 4 Task 29.4).
 *
 * Atomic state transition. Captures resolve as a side effect of movement
 * rather than as a distinct move type — `getLegalMoves` returns slides /
 * jumps only; `applyMove` runs the configured capture detectors against the
 * post-move state and records victims.
 *
 * Resolution order (per RULES_NOTES.md §1):
 *   1. Move the piece from `from` to `to`.
 *   2. (custodian, intervention, corner, line) — these all read the
 *      post-move state and resolve simultaneously. Their victims are unioned
 *      and removed atomically.
 *   3. (immobilization) — runs against the state AFTER the step-2 victims
 *      have been removed. Adds further victims.
 *   4. Final state has all victims removed in one batch.
 *
 * For Dai Hasami: after victims are removed, recompute `meta.winningLines`
 * for the side that just moved (used by `gameOver` for the line-formation
 * win condition).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import {
  findCornerCaptures,
  findCustodianCaptures,
  findImmobilizationCaptures,
  findInterventionCaptures,
  findLineCaptures,
} from './captureDetectors';
import { findNInARowLines } from './nInARow';
import type {
  CustodianConfig,
  CustodianGameState,
  CustodianMeta,
  CustodianMove,
  CustodianOwner,
  CustodianPieceKind,
} from './types';
import { hashPosition, incrementRepetition } from './custodianZobrist';

export function applyCustodianMove(
  state: CustodianGameState,
  move: CustodianMove,
  config: CustodianConfig,
): CustodianGameState {
  const fromNode = parseLabel(config, move.from, `${move.kind}.from`);
  const toNode = parseLabel(config, move.to, `${move.kind}.to`);
  const piece = state.pieces.get(fromNode);
  if (!piece) {
    throw new Error(`[custodian applyMove] ${move.kind}: no piece at ${move.from}`);
  }
  const owner = pieceOwner(piece);
  const kind = pieceKind(piece);

  // Step 1: move the piece.
  const movedPieces = new Map(state.pieces);
  movedPieces.delete(fromNode);
  movedPieces.set(toNode, Object.freeze({ owner, kind }));

  // Step 2: simultaneous-mode capture detectors. Either custodian (single
  // piece) OR line (whole line) — they're mutually exclusive paths through
  // the same detector module.
  const captureBreakdown: {
    custodian?: number[];
    intervention?: number[];
    corner?: number[];
    immobilization?: number[];
    line?: number[];
  } = {};
  const stage2Victims = new Set<number>();

  if (config.capture.custodian && config.capture.lineCapture === 'single-piece') {
    const cap = findCustodianCaptures(movedPieces, toNode, owner, config);
    if (cap.length > 0) {
      captureBreakdown.custodian = cap.map((n) => n as unknown as number);
      for (const n of cap) stage2Victims.add(n as unknown as number);
    }
  }
  if (config.capture.lineCapture === 'whole-line') {
    const cap = findLineCaptures(movedPieces, toNode, owner, config);
    if (cap.length > 0) {
      captureBreakdown.line = cap.map((n) => n as unknown as number);
      for (const n of cap) stage2Victims.add(n as unknown as number);
    }
  }
  if (config.capture.intervention) {
    const cap = findInterventionCaptures(movedPieces, toNode, owner, config);
    if (cap.length > 0) {
      captureBreakdown.intervention = cap.map((n) => n as unknown as number);
      for (const n of cap) stage2Victims.add(n as unknown as number);
    }
  }
  if (config.capture.corner) {
    const cap = findCornerCaptures(movedPieces, owner, config);
    if (cap.length > 0) {
      captureBreakdown.corner = cap.map((n) => n as unknown as number);
      for (const n of cap) stage2Victims.add(n as unknown as number);
    }
  }

  // Apply stage-2 victim removal.
  const afterStage2 = new Map(movedPieces);
  for (const v of stage2Victims) {
    afterStage2.delete(v as unknown as NodeId);
  }

  // Step 3: immobilization runs against the post-stage-2 state.
  const stage3Victims = new Set<number>();
  if (config.capture.immobilization) {
    const cap = findImmobilizationCaptures(afterStage2, owner, config);
    if (cap.length > 0) {
      captureBreakdown.immobilization = cap.map((n) => n as unknown as number);
      for (const n of cap) stage3Victims.add(n as unknown as number);
    }
  }

  const finalPieces = new Map(afterStage2);
  for (const v of stage3Victims) {
    finalPieces.delete(v as unknown as NodeId);
  }

  // Build canonical move record with capture list + breakdown.
  const allVictims = new Set<number>([...stage2Victims, ...stage3Victims]);
  const sortedVictims = [...allVictims].sort((a, b) => a - b);
  const captureLabels = sortedVictims.map((idx) =>
    config.boardGeometry.coordinateLabels.notationOf(idx as unknown as NodeId),
  );
  const finalMove: CustodianMove = {
    kind: move.kind,
    from: move.from,
    to: move.to,
    piece: move.piece,
    capture: captureLabels,
    meta: {
      ...(move.meta ?? {}),
      owner,
      fromNode: fromNode as unknown as number,
      toNode: toNode as unknown as number,
      ...(Object.keys(captureBreakdown).length > 0
        ? { captureBreakdown: freezeBreakdown(captureBreakdown) }
        : {}),
    },
  };

  const wasCapture = captureLabels.length > 0;
  return finalize(state, finalMove, finalPieces, config, wasCapture);
}

function freezeBreakdown(breakdown: {
  custodian?: number[];
  intervention?: number[];
  corner?: number[];
  immobilization?: number[];
  line?: number[];
}): {
  custodian?: readonly number[];
  intervention?: readonly number[];
  corner?: readonly number[];
  immobilization?: readonly number[];
  line?: readonly number[];
} {
  const out: {
    custodian?: readonly number[];
    intervention?: readonly number[];
    corner?: readonly number[];
    immobilization?: readonly number[];
    line?: readonly number[];
  } = {};
  if (breakdown.custodian) out.custodian = Object.freeze([...breakdown.custodian]);
  if (breakdown.intervention) out.intervention = Object.freeze([...breakdown.intervention]);
  if (breakdown.corner) out.corner = Object.freeze([...breakdown.corner]);
  if (breakdown.immobilization) out.immobilization = Object.freeze([...breakdown.immobilization]);
  if (breakdown.line) out.line = Object.freeze([...breakdown.line]);
  return out;
}

// ---------------------------------------------------------------------------
// Finalisation
// ---------------------------------------------------------------------------

function finalize(
  state: CustodianGameState,
  move: CustodianMove,
  nextPieces: Map<NodeId, ClassifiedPiece>,
  config: CustodianConfig,
  wasCapture: boolean,
): CustodianGameState {
  const nextTurn: CustodianOwner = state.turn === 'white' ? 'black' : 'white';
  const nextHash = hashPosition(nextPieces, nextTurn, config);

  // For Dai Hasami's line-formation win: recompute the just-moved side's
  // n-in-a-row lines against the post-move state.
  let winningLines: readonly (readonly number[])[] | null = null;
  if (config.winCondition.kind === 'reduce-below-or-line-formation') {
    const wc = config.winCondition;
    const moverSide: CustodianOwner = state.turn;
    const lines = findNInARowLines({
      pieces: nextPieces,
      owner: moverSide,
      n: wc.lineLength,
      axes: wc.lineAxes,
      boardSize: config.boardSize,
      excludeRow: rowExcluderFor(moverSide, config.boardSize, wc.excludeOwnStartingRanks),
    });
    winningLines = lines.length > 0 ? lines : null;
  }

  const meta: CustodianMeta = {
    turnTag: nextTurn,
    halfMoveClock: wasCapture ? 0 : state.meta.halfMoveClock + 1,
    repetitionTable: incrementRepetition(state.meta.repetitionTable, nextHash),
    winningLines,
  };

  return {
    pieces: nextPieces,
    turn: nextTurn,
    plyCount: state.plyCount + 1,
    moveHistory: Object.freeze([...state.moveHistory, move]),
    meta,
  };
}

/**
 * Excluded-row predicate for Dai Hasami:
 *   - White's starting ranks are rows 0..(excludeOwnStartingRanks-1).
 *   - Black's starting ranks are rows (size-excludeOwnStartingRanks)..(size-1).
 * A line is "entirely excluded" iff every row falls in the excluded zone for
 * the mover.
 */
function rowExcluderFor(
  side: CustodianOwner,
  size: number,
  excludeOwnStartingRanks: number,
): (row: number) => boolean {
  if (side === 'white') {
    return (row: number) => row >= 0 && row < excludeOwnStartingRanks;
  }
  return (row: number) => row >= size - excludeOwnStartingRanks && row < size;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseLabel(
  config: CustodianConfig,
  label: string,
  context: string,
): NodeId {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) {
    throw new Error(
      `[custodian applyMove] ${context}: unparsable notation token "${label}"`,
    );
  }
  return node;
}

function pieceOwner(piece: ClassifiedPiece): CustodianOwner {
  if (piece.owner !== 'white' && piece.owner !== 'black') {
    throw new Error(`[custodian applyMove] invalid piece owner '${piece.owner}'`);
  }
  return piece.owner;
}

function pieceKind(piece: ClassifiedPiece): CustodianPieceKind {
  if (piece.kind !== 'man' && piece.kind !== 'king') {
    throw new Error(`[custodian applyMove] invalid piece kind '${piece.kind}'`);
  }
  return piece.kind;
}
