/**
 * Harzdame apply-move (Phase 4 Task 29.5).
 *
 * Atomic state transition for Harzdame's two move kinds:
 *
 * - `'move'` (non-capturing step): mover relocates; promotion fires iff a
 *   man arrives on its promotion area. Senior-king flip is NOT triggered
 *   by step moves.
 *
 * - `'capture'` (jump chain): victims are removed atomically based on
 *   `move.capture`. Per playbook §4.2 row "Captured piece removal:
 *   Immediate", removal is structurally immediate during chain enumeration
 *   (`moveGen.ts`); the apply-move final commit removes the same victims
 *   from the canonical state. Promotion is DENIED on capture-arrival per
 *   §1.3 — a man landing on a promotion-area square via a capture chain
 *   stays a man. Senior-king flip is triggered iff the moving piece is a
 *   king AND `move.capture.length` equals the position's max chain length
 *   (computed from pre-move state, optionally cached in
 *   `meta.maxCaptureChainLength`).
 *
 * The function is pure: input state is never mutated. Output state shares
 * structural identity with the input for unchanged squares.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  HarzdameConfig,
  HarzdameGameState,
  HarzdameMeta,
  HarzdameMove,
  HarzdameOwner,
  HarzdamePieceKind,
} from './types';
import { hashPosition, incrementRepetition } from './harzdameZobrist';
import { maxCaptureChainLength } from './moveGen';

export function applyHarzdameMove(
  state: HarzdameGameState,
  move: HarzdameMove,
  config: HarzdameConfig,
): HarzdameGameState {
  if (move.kind === 'move') {
    return applyStep(state, move, config);
  }
  return applyCapture(state, move, config);
}

// ---------------------------------------------------------------------------
// Step move
// ---------------------------------------------------------------------------

function applyStep(
  state: HarzdameGameState,
  move: HarzdameMove,
  config: HarzdameConfig,
): HarzdameGameState {
  const fromNode = parseLabel(config, move.from, 'move.from');
  const toNode = parseLabel(config, move.to, 'move.to');
  const piece = state.pieces.get(fromNode);
  if (!piece) {
    throw new Error(`[harzdame applyMove] move: no piece at ${move.from}`);
  }
  const owner = pieceOwner(piece);
  const baseKind = pieceKind(piece);

  let placedKind: HarzdamePieceKind = baseKind;
  let placedPromoted: boolean = piece.promoted === true;
  // Promotion fires only on non-capture arrival to the promotion area.
  if (
    baseKind === 'man' &&
    config.promotionArea[owner].has(toNode)
  ) {
    placedKind = 'king';
    placedPromoted = false; // newly promoted king is regular, not senior
  }

  const nextPieces = new Map(state.pieces);
  nextPieces.delete(fromNode);
  nextPieces.set(toNode, freezePiece(owner, placedKind, placedPromoted));

  return finalize(state, move, nextPieces, config, /*wasCapture=*/ false);
}

// ---------------------------------------------------------------------------
// Capture chain commit
// ---------------------------------------------------------------------------

function applyCapture(
  state: HarzdameGameState,
  move: HarzdameMove,
  config: HarzdameConfig,
): HarzdameGameState {
  const fromNode = parseLabel(config, move.from, 'capture.from');
  const toNode = parseLabel(config, move.to, 'capture.to');
  const captureNodes = move.capture.map((label, i) =>
    parseLabel(config, label, `capture[${String(i)}]`),
  );

  const moverPiece = state.pieces.get(fromNode);
  if (!moverPiece) {
    throw new Error(`[harzdame applyMove] capture: no piece at ${move.from}`);
  }
  const owner = pieceOwner(moverPiece);
  const startKind = pieceKind(moverPiece);
  const startPromoted = moverPiece.promoted === true;

  const nextPieces = new Map(state.pieces);
  nextPieces.delete(fromNode);
  for (const victim of captureNodes) {
    nextPieces.delete(victim);
  }

  // Promotion is DENIED on capture arrival (per config.promotionDeniedOnCaptureArrival).
  // The moving piece keeps its kind. Senior-king flip is computed below.
  let finalKind: HarzdamePieceKind = startKind;
  let finalPromoted: boolean = startPromoted;

  // Senior-king flip: regular king completing the position-max chain.
  // (config.seniorKing.trigger is locked to 'max-chain' at the type level.)
  void config.seniorKing.trigger;
  if (
    config.seniorKing.enabled &&
    startKind === 'king' &&
    !startPromoted
  ) {
    const maxLen = state.meta.maxCaptureChainLength ?? maxCaptureChainLength(state, config);
    if (move.capture.length === maxLen && move.capture.length > 0) {
      finalKind = 'king';
      finalPromoted = true;
    }
  }

  nextPieces.set(toNode, freezePiece(owner, finalKind, finalPromoted));

  return finalize(state, move, nextPieces, config, /*wasCapture=*/ true);
}

// ---------------------------------------------------------------------------
// Finalisation
// ---------------------------------------------------------------------------

function finalize(
  state: HarzdameGameState,
  move: HarzdameMove,
  nextPieces: Map<NodeId, ClassifiedPiece>,
  config: HarzdameConfig,
  wasCapture: boolean,
): HarzdameGameState {
  const nextTurn: HarzdameOwner = state.turn === 'white' ? 'black' : 'white';
  const nextHash = hashPosition(nextPieces, nextTurn, config);

  // Senior-kings cache.
  const seniorKings: number[] = [];
  for (const [nodeId, piece] of nextPieces) {
    if (piece.kind === 'king' && piece.promoted === true) {
      seniorKings.push(nodeId as unknown as number);
    }
  }
  seniorKings.sort((a, b) => a - b);

  const meta: HarzdameMeta = {
    turnTag: nextTurn,
    halfMoveClock: wasCapture ? 0 : state.meta.halfMoveClock + 1,
    repetitionTable: incrementRepetition(state.meta.repetitionTable, nextHash),
    seniorKings: Object.freeze(seniorKings),
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
  config: HarzdameConfig,
  label: string,
  context: string,
): NodeId {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) {
    throw new Error(`[harzdame applyMove] ${context}: unparsable notation token "${label}"`);
  }
  return node;
}

function pieceOwner(piece: ClassifiedPiece): HarzdameOwner {
  if (piece.owner !== 'white' && piece.owner !== 'black') {
    throw new Error(`[harzdame applyMove] invalid piece owner '${piece.owner}'`);
  }
  return piece.owner;
}

function pieceKind(piece: ClassifiedPiece): HarzdamePieceKind {
  if (piece.kind !== 'man' && piece.kind !== 'king') {
    throw new Error(`[harzdame applyMove] invalid piece kind '${piece.kind}'`);
  }
  return piece.kind;
}

function freezePiece(
  owner: HarzdameOwner,
  kind: HarzdamePieceKind,
  promoted: boolean,
): ClassifiedPiece {
  if (kind === 'king' && promoted) {
    return Object.freeze({ owner, kind, promoted: true });
  }
  return Object.freeze({ owner, kind });
}
