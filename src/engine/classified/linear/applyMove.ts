/**
 * Linear-movement engine apply-move (Phase 4 Task 29.2).
 *
 * Atomic state transition for Dameo's three move kinds:
 *   - 'step': single-piece advance (man or king); promotes if a man arrives
 *     on its promotion row.
 *   - 'group-advance': every member of a phalanx slides forward by one
 *     square in lockstep; only the head can promote (only the head can
 *     reach the promotion row).
 *   - 'capture': multi-jump chain. Victims listed in `move.capture` stay on
 *     the board during exploration (deferred removal) and are removed
 *     atomically at terminal commit. The mover lands at `move.to`; if a man
 *     arrives on the promotion row, it promotes.
 *
 * The function is pure: input state is never mutated. Output state shares
 * structural identity with the input for unchanged squares.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  LinearGameState,
  LinearMeta,
  LinearMove,
  LinearMovementConfig,
  LinearOwner,
  LinearPieceKind,
} from './types';
import { hashPosition, incrementRepetition } from './linearZobrist';
import { stepForward } from './Phalanx';

export function applyLinearMove(
  state: LinearGameState,
  move: LinearMove,
  config: LinearMovementConfig,
): LinearGameState {
  if (move.kind === 'step') {
    return applyStep(state, move, config);
  }
  if (move.kind === 'group-advance') {
    return applyGroupAdvance(state, move, config);
  }
  return applyCapture(state, move, config);
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

function applyStep(
  state: LinearGameState,
  move: LinearMove,
  config: LinearMovementConfig,
): LinearGameState {
  const fromNode = parseLabel(config, move.from, 'step.from');
  const toNode = parseLabel(config, move.to, 'step.to');
  const piece = state.pieces.get(fromNode);
  if (!piece) {
    throw new Error(`[linear applyMove] step: no piece at ${move.from}`);
  }

  const owner = pieceOwner(piece);
  const baseKind = pieceKind(piece);
  const placedKind: LinearPieceKind =
    move.promotion === 'king' && baseKind === 'man' ? 'king' : baseKind;

  const nextPieces = new Map(state.pieces);
  nextPieces.delete(fromNode);
  nextPieces.set(toNode, Object.freeze({ owner, kind: placedKind }));

  return finalize(state, move, nextPieces, config, /*wasCapture=*/ false);
}

// ---------------------------------------------------------------------------
// Group-advance
// ---------------------------------------------------------------------------

function applyGroupAdvance(
  state: LinearGameState,
  move: LinearMove,
  config: LinearMovementConfig,
): LinearGameState {
  const memberNodes = move.meta?.groupMemberNodes;
  if (!memberNodes || memberNodes.length === 0) {
    throw new Error(
      `[linear applyMove] group-advance: move ${move.from}→${move.to} missing required meta.groupMemberNodes`,
    );
  }
  const targetNode = parseLabel(config, move.to, 'group-advance.to');
  const direction = move.direction;

  const nextPieces = new Map(state.pieces);
  // Snapshot the original pieces at member squares (they're all friendly men).
  const memberPieces: { source: NodeId; piece: ClassifiedPiece }[] = [];
  for (const idx of memberNodes) {
    const node = idx as unknown as NodeId;
    const p = state.pieces.get(node);
    if (!p) {
      throw new Error(
        `[linear applyMove] group-advance: missing member tower at NodeId ${String(idx)}`,
      );
    }
    memberPieces.push({ source: node, piece: p });
  }

  // Remove every source square first so destinations don't collide with each other.
  for (const { source } of memberPieces) {
    nextPieces.delete(source);
  }
  // Place each member at its forward-step destination.
  // For lockstep correctness we recompute the destination from the source
  // using the shared `stepForward` helper from Phalanx.ts.
  for (const { source, piece } of memberPieces) {
    const dest = stepForward(source, direction, config.boardSize);
    if (dest === null) {
      throw new Error(
        `[linear applyMove] group-advance: member at NodeId ${String(source as unknown as number)} has off-board destination`,
      );
    }
    // The head of the phalanx may promote if it lands on the promotion row.
    const isHead = (dest as unknown as number) === (targetNode as unknown as number);
    const owner = pieceOwner(piece);
    const promoteHead =
      isHead &&
      pieceKind(piece) === 'man' &&
      move.promotion === 'king';
    const placed: ClassifiedPiece = Object.freeze({
      owner,
      kind: promoteHead ? 'king' : pieceKind(piece),
    });
    nextPieces.set(dest, placed);
  }

  return finalize(state, move, nextPieces, config, /*wasCapture=*/ false);
}

// ---------------------------------------------------------------------------
// Capture chain
// ---------------------------------------------------------------------------

function applyCapture(
  state: LinearGameState,
  move: LinearMove,
  config: LinearMovementConfig,
): LinearGameState {
  const fromNode = parseLabel(config, move.from, 'capture.from');
  const toNode = parseLabel(config, move.to, 'capture.to');
  const captureNodes = move.capture.map((label, i) =>
    parseLabel(config, label, `capture[${String(i)}]`),
  );
  const path = move.meta?.path;
  if (!path) {
    throw new Error(
      `[linear applyMove] capture: move ${move.from}→${move.to} missing required meta.path`,
    );
  }

  const moverPiece = state.pieces.get(fromNode);
  if (!moverPiece) {
    throw new Error(`[linear applyMove] capture: no piece at ${move.from}`);
  }
  const owner = pieceOwner(moverPiece);
  const kindStart = pieceKind(moverPiece);

  // Build the next pieces map: remove mover from source, remove all victims
  // atomically at terminal commit, then place the mover at `to`. Promotion
  // fires if a man arrived on the promotion row.
  const nextPieces = new Map(state.pieces);
  nextPieces.delete(fromNode);
  for (const victim of captureNodes) {
    nextPieces.delete(victim);
  }
  const placedKind: LinearPieceKind =
    move.promotion === 'king' && kindStart === 'man' ? 'king' : kindStart;
  nextPieces.set(toNode, Object.freeze({ owner, kind: placedKind }));

  return finalize(state, move, nextPieces, config, /*wasCapture=*/ true);
}

// ---------------------------------------------------------------------------
// Finalisation
// ---------------------------------------------------------------------------

function finalize(
  state: LinearGameState,
  move: LinearMove,
  nextPieces: Map<NodeId, ClassifiedPiece>,
  config: LinearMovementConfig,
  wasCapture: boolean,
): LinearGameState {
  const nextTurn: LinearOwner = state.turn === 'white' ? 'black' : 'white';
  const nextHash = hashPosition(nextPieces, nextTurn, config);

  const meta: LinearMeta = {
    turnTag: nextTurn,
    halfMoveClock: wasCapture ? 0 : state.meta.halfMoveClock + 1,
    repetitionTable: incrementRepetition(state.meta.repetitionTable, nextHash),
  };

  return {
    pieces: nextPieces,
    turn: nextTurn,
    plyCount: state.plyCount + 1,
    moveHistory: Object.freeze([...state.moveHistory, move]),
    meta,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseLabel(
  config: LinearMovementConfig,
  label: string,
  context: string,
): NodeId {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) {
    throw new Error(
      `[linear applyMove] ${context}: unparsable notation token "${label}"`,
    );
  }
  return node;
}

function pieceOwner(piece: ClassifiedPiece): LinearOwner {
  if (piece.owner !== 'white' && piece.owner !== 'black') {
    throw new Error(`[linear applyMove] invalid piece owner '${piece.owner}'`);
  }
  return piece.owner;
}

function pieceKind(piece: ClassifiedPiece): LinearPieceKind {
  if (piece.kind !== 'man' && piece.kind !== 'king') {
    throw new Error(`[linear applyMove] invalid piece kind '${piece.kind}'`);
  }
  return piece.kind;
}

