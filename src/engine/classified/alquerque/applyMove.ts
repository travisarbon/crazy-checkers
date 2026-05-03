/**
 * Alquerque-engine apply-move (Phase 4 Task 29.3).
 *
 * Atomic state transition for Zamma's two move kinds:
 *   - 'step': single-piece advance along an incident line. Promotes if a
 *     man arrives on its promotion row.
 *   - 'capture': multi-jump chain. Victims listed in `move.capture` stay on
 *     the board during exploration (deferred removal) and are removed
 *     atomically at terminal commit. The mover lands at `move.to`; if a man
 *     arrives on the promotion row, it promotes to a Mullah.
 *
 * The function is pure: input state is never mutated. Output state shares
 * structural identity with the input for unchanged intersections.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  AlquerqueConfig,
  AlquerqueGameState,
  AlquerqueMeta,
  AlquerqueMove,
  AlquerqueOwner,
  AlquerquePieceKind,
} from './types';
import { hashPosition, incrementRepetition } from './alquerqueZobrist';

export function applyAlquerqueMove(
  state: AlquerqueGameState,
  move: AlquerqueMove,
  config: AlquerqueConfig,
): AlquerqueGameState {
  if (move.kind === 'step') {
    return applyStep(state, move, config);
  }
  return applyCapture(state, move, config);
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

function applyStep(
  state: AlquerqueGameState,
  move: AlquerqueMove,
  config: AlquerqueConfig,
): AlquerqueGameState {
  const fromNode = parseLabel(config, move.from, 'step.from');
  const toNode = parseLabel(config, move.to, 'step.to');
  const piece = state.pieces.get(fromNode);
  if (!piece) {
    throw new Error(`[alquerque applyMove] step: no piece at ${move.from}`);
  }

  const owner = pieceOwner(piece);
  const baseKind = pieceKind(piece);
  const placedKind: AlquerquePieceKind =
    move.promotion === 'mullah' && baseKind === 'man' ? 'mullah' : baseKind;

  const nextPieces = new Map(state.pieces);
  nextPieces.delete(fromNode);
  nextPieces.set(toNode, Object.freeze({ owner, kind: placedKind }));

  return finalize(state, move, nextPieces, config, /*wasCapture=*/ false);
}

// ---------------------------------------------------------------------------
// Capture chain
// ---------------------------------------------------------------------------

function applyCapture(
  state: AlquerqueGameState,
  move: AlquerqueMove,
  config: AlquerqueConfig,
): AlquerqueGameState {
  const fromNode = parseLabel(config, move.from, 'capture.from');
  const toNode = parseLabel(config, move.to, 'capture.to');
  const captureNodes = move.capture.map((label, i) =>
    parseLabel(config, label, `capture[${String(i)}]`),
  );
  const path = move.meta?.path;
  if (!path) {
    throw new Error(
      `[alquerque applyMove] capture: move ${move.from}→${move.to} missing required meta.path`,
    );
  }

  const moverPiece = state.pieces.get(fromNode);
  if (!moverPiece) {
    throw new Error(`[alquerque applyMove] capture: no piece at ${move.from}`);
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
  const placedKind: AlquerquePieceKind =
    move.promotion === 'mullah' && kindStart === 'man' ? 'mullah' : kindStart;
  nextPieces.set(toNode, Object.freeze({ owner, kind: placedKind }));

  return finalize(state, move, nextPieces, config, /*wasCapture=*/ true);
}

// ---------------------------------------------------------------------------
// Finalisation
// ---------------------------------------------------------------------------

function finalize(
  state: AlquerqueGameState,
  move: AlquerqueMove,
  nextPieces: Map<NodeId, ClassifiedPiece>,
  config: AlquerqueConfig,
  wasCapture: boolean,
): AlquerqueGameState {
  const nextTurn: AlquerqueOwner = state.turn === 'white' ? 'black' : 'white';
  const nextHash = hashPosition(nextPieces, nextTurn, config);

  const meta: AlquerqueMeta = {
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
  config: AlquerqueConfig,
  label: string,
  context: string,
): NodeId {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) {
    throw new Error(
      `[alquerque applyMove] ${context}: unparsable notation token "${label}"`,
    );
  }
  return node;
}

function pieceOwner(piece: ClassifiedPiece): AlquerqueOwner {
  if (piece.owner !== 'white' && piece.owner !== 'black') {
    throw new Error(`[alquerque applyMove] invalid piece owner '${piece.owner}'`);
  }
  return piece.owner;
}

function pieceKind(piece: ClassifiedPiece): AlquerquePieceKind {
  if (piece.kind !== 'man' && piece.kind !== 'mullah') {
    throw new Error(`[alquerque applyMove] invalid piece kind '${piece.kind}'`);
  }
  return piece.kind;
}
