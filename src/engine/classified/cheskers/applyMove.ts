/**
 * Cheskers apply-move (Phase 4 Task 29.6).
 *
 * Atomic state transition for Cheskers's eight move kinds. Three top-level
 * branches:
 *
 * 1. **Pawn / King step** (`pawn-step`, `king-step`): mover relocates;
 *    Pawn promotion fires iff a Pawn arrives on its back rank.
 * 2. **Pawn / King jump chain** (`pawn-jump`, `king-jump`): victims removed
 *    from `pieces`; mover relocates to the chain's terminal landing; Pawn
 *    promotion fires at terminal arrival (per §1.3 default
 *    `midChainPromotion: false` — when the knob is on, the move generator
 *    upgrades the chain to `'king-jump'` and the moving piece is committed
 *    as a King).
 * 3. **Bishop / Camel displacement** (`bishop-slide`, `bishop-displace`,
 *    `camel-leap`, `camel-displace`): single-piece relocation (slide/leap)
 *    or single-piece capture (displace). No chain. No promotion (only
 *    Pawns promote per §1.2).
 *
 * The function is pure: input state is never mutated. Every map mutation
 * goes through a fresh `Map`. Output state shares structural identity with
 * the input for unchanged squares.
 *
 * `meta.kingCount` is recomputed on every move to support `gameOver`'s
 * eliminate-all-kings check; the recomputation is O(pieces.size) and
 * acceptable on a 24-piece board.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  CheskersConfig,
  CheskersGameState,
  CheskersMeta,
  CheskersMove,
  CheskersOwner,
  CheskersPieceKind,
} from './types';
import { hashPosition, incrementRepetition } from './cheskersZobrist';

export function applyCheskersMove(
  state: CheskersGameState,
  move: CheskersMove,
  config: CheskersConfig,
): CheskersGameState {
  switch (move.kind) {
    case 'pawn-step':
    case 'king-step':
      return applyStep(state, move, config, /*wasCapture*/ false);
    case 'bishop-slide':
    case 'camel-leap':
      return applyStep(state, move, config, /*wasCapture*/ false);
    case 'pawn-jump':
    case 'king-jump':
      return applyJumpChain(state, move, config);
    case 'bishop-displace':
    case 'camel-displace':
      return applyDisplace(state, move, config);
  }
}

// ---------------------------------------------------------------------------
// Step / slide / leap (non-capturing) — also used by Bishop slides + Camel leaps
// ---------------------------------------------------------------------------

function applyStep(
  state: CheskersGameState,
  move: CheskersMove,
  config: CheskersConfig,
  wasCapture: boolean,
): CheskersGameState {
  const fromNode = parseLabel(config, move.from, `${move.kind}.from`);
  const toNode = parseLabel(config, move.to, `${move.kind}.to`);
  const piece = state.pieces.get(fromNode);
  if (!piece) {
    throw new Error(`[cheskers applyMove] ${move.kind}: no piece at ${move.from}`);
  }
  const owner = pieceOwner(piece);
  const baseKind = pieceKind(piece);

  let placedKind: CheskersPieceKind = baseKind;
  // Pawn promotion at terminal arrival on back rank (non-capturing).
  if (baseKind === 'pawn' && move.promotion !== undefined) {
    placedKind = move.promotion;
  } else if (baseKind === 'pawn') {
    const r = rowOf(toNode, config.boardSize);
    const backRank = owner === 'white' ? 0 : config.boardSize - 1;
    if (r === backRank) {
      // Defensive — generator should have stamped move.promotion. Default to King.
      placedKind = 'king';
    }
  }

  const nextPieces = new Map(state.pieces);
  nextPieces.delete(fromNode);
  nextPieces.set(toNode, freezePiece(owner, placedKind));

  return finalize(state, move, nextPieces, config, wasCapture);
}

// ---------------------------------------------------------------------------
// Pawn / King jump chain (immediate-removal)
// ---------------------------------------------------------------------------

function applyJumpChain(
  state: CheskersGameState,
  move: CheskersMove,
  config: CheskersConfig,
): CheskersGameState {
  const fromNode = parseLabel(config, move.from, `${move.kind}.from`);
  const toNode = parseLabel(config, move.to, `${move.kind}.to`);
  const captureNodes = move.capture.map((label, i) =>
    parseLabel(config, label, `${move.kind}.capture[${String(i)}]`),
  );

  const moverPiece = state.pieces.get(fromNode);
  if (!moverPiece) {
    throw new Error(`[cheskers applyMove] ${move.kind}: no piece at ${move.from}`);
  }
  const owner = pieceOwner(moverPiece);
  const startKind = pieceKind(moverPiece);

  const nextPieces = new Map(state.pieces);
  nextPieces.delete(fromNode);
  for (const victim of captureNodes) {
    nextPieces.delete(victim);
  }

  // Determine the final piece kind.
  let finalKind: CheskersPieceKind = startKind;
  if (move.kind === 'king-jump' && startKind === 'pawn') {
    // Mid-chain promotion knob fired in moveGen — committed as a King.
    finalKind = 'king';
  } else if (move.promotion !== undefined && startKind === 'pawn') {
    finalKind = move.promotion;
  } else if (startKind === 'pawn') {
    const r = rowOf(toNode, config.boardSize);
    const backRank = owner === 'white' ? 0 : config.boardSize - 1;
    if (r === backRank) {
      finalKind = 'king';
    }
  }

  nextPieces.set(toNode, freezePiece(owner, finalKind));

  return finalize(state, move, nextPieces, config, /*wasCapture*/ true);
}

// ---------------------------------------------------------------------------
// Bishop / Camel displacement capture (single)
// ---------------------------------------------------------------------------

function applyDisplace(
  state: CheskersGameState,
  move: CheskersMove,
  config: CheskersConfig,
): CheskersGameState {
  const fromNode = parseLabel(config, move.from, `${move.kind}.from`);
  const toNode = parseLabel(config, move.to, `${move.kind}.to`);
  const moverPiece = state.pieces.get(fromNode);
  if (!moverPiece) {
    throw new Error(`[cheskers applyMove] ${move.kind}: no piece at ${move.from}`);
  }
  const owner = pieceOwner(moverPiece);
  const kind = pieceKind(moverPiece);

  const nextPieces = new Map(state.pieces);
  nextPieces.delete(fromNode);
  // Remove the captured opponent at toNode (single piece for displacement).
  nextPieces.delete(toNode);
  nextPieces.set(toNode, freezePiece(owner, kind));

  return finalize(state, move, nextPieces, config, /*wasCapture*/ true);
}

// ---------------------------------------------------------------------------
// Finalisation
// ---------------------------------------------------------------------------

function finalize(
  state: CheskersGameState,
  move: CheskersMove,
  nextPieces: Map<NodeId, ClassifiedPiece>,
  config: CheskersConfig,
  wasCapture: boolean,
): CheskersGameState {
  const nextTurn: CheskersOwner = state.turn === 'white' ? 'black' : 'white';
  const nextHash = hashPosition(nextPieces, nextTurn, config);

  // King-count cache.
  let whiteKings = 0;
  let blackKings = 0;
  for (const piece of nextPieces.values()) {
    if (piece.kind === 'king') {
      if (piece.owner === 'white') whiteKings += 1;
      else if (piece.owner === 'black') blackKings += 1;
    }
  }

  const meta: CheskersMeta = {
    turnTag: nextTurn,
    halfMoveClock: wasCapture || move.promotion !== undefined ? 0 : state.meta.halfMoveClock + 1,
    repetitionTable: incrementRepetition(state.meta.repetitionTable, nextHash),
    kingCount: Object.freeze({ white: whiteKings, black: blackKings }),
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
  config: CheskersConfig,
  label: string,
  context: string,
): NodeId {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) {
    throw new Error(`[cheskers applyMove] ${context}: unparsable notation token "${label}"`);
  }
  return node;
}

function pieceOwner(piece: ClassifiedPiece): CheskersOwner {
  if (piece.owner !== 'white' && piece.owner !== 'black') {
    throw new Error(`[cheskers applyMove] invalid piece owner '${piece.owner}'`);
  }
  return piece.owner;
}

function pieceKind(piece: ClassifiedPiece): CheskersPieceKind {
  if (
    piece.kind !== 'pawn' &&
    piece.kind !== 'king' &&
    piece.kind !== 'bishop' &&
    piece.kind !== 'camel'
  ) {
    throw new Error(`[cheskers applyMove] invalid piece kind '${piece.kind}'`);
  }
  return piece.kind;
}

function freezePiece(owner: CheskersOwner, kind: CheskersPieceKind): ClassifiedPiece {
  return Object.freeze({ owner, kind });
}

function rowOf(node: NodeId, size: number): number {
  return Math.floor((node as unknown as number) / size);
}
