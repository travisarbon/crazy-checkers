/**
 * Legal move generation, jump detection, and multi-jump chains.
 *
 * Public API:
 * - getLegalMoves(board, activeColor) — all legal moves enforcing mandatory capture
 * - getLegalMovesForPiece(board, sq) — legal moves for a specific piece (UI convenience)
 * - getSimpleMovesForPiece(board, sq) — non-capturing diagonal steps
 * - getJumpsForPiece(board, sq) — all jump chains including multi-jumps
 * - getMovesToSquare(moves, target) — filter moves by first destination
 */

import type { BoardState, Move, Piece, Square } from './types';
import { Direction, PieceColor, PieceType } from './types';
import {
  getAdjacentSquare,
  getBoardSquare,
  getJumpTarget,
  getSquaresWithColor,
  isPromotionSquare,
} from './board';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the diagonal directions a piece is allowed to move/capture in.
 * Pawns move forward only (relative to their color). Kings move in all four.
 */
function getMovementDirections(piece: Piece): Direction[] {
  if (piece.type === PieceType.King) {
    return [
      Direction.ForwardLeft,
      Direction.ForwardRight,
      Direction.BackwardLeft,
      Direction.BackwardRight,
    ];
  }
  // Pawns: White moves toward row 0 (Forward), Black moves toward row 7 (Backward)
  if (piece.color === PieceColor.White) {
    return [Direction.ForwardLeft, Direction.ForwardRight];
  }
  return [Direction.BackwardLeft, Direction.BackwardRight];
}

// ---------------------------------------------------------------------------
// Simple move generation
// ---------------------------------------------------------------------------

/**
 * Returns all simple (non-capturing) moves for a piece at the given square.
 * A simple move is one diagonal step to an empty adjacent square in an
 * allowed direction for the piece's color and type.
 */
export function getSimpleMovesForPiece(board: BoardState, sq: Square): Move[] {
  const piece = getBoardSquare(board, sq);
  if (piece === null) return [];

  const directions = getMovementDirections(piece);
  const moves: Move[] = [];

  for (const direction of directions) {
    const target = getAdjacentSquare(sq, direction);
    if (target === null) continue;
    if (getBoardSquare(board, target) !== null) continue;

    moves.push({
      from: sq,
      path: [target],
      captured: [],
    });
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Jump generation
// ---------------------------------------------------------------------------

/**
 * Returns all possible jump chains (including multi-jumps) for a piece
 * at the given square.
 *
 * Each returned Move represents a complete chain — one where no further
 * jumps are possible from the final landing square. Partial chains are
 * never returned (mandatory capture continuation rule).
 *
 * Promotion stop rule (American Rules): if a pawn reaches its king row
 * during a multi-jump, the chain terminates immediately — the pawn is
 * promoted and does NOT continue jumping as a king.
 */
export function getJumpsForPiece(board: BoardState, sq: Square): Move[] {
  const maybePiece = getBoardSquare(board, sq);
  if (maybePiece === null) return [];

  // Local const so TypeScript narrows inside the closure.
  const piece = maybePiece;
  const completedChains: Move[] = [];
  const directions = getMovementDirections(piece);

  function explore(
    currentSq: Square,
    pathSoFar: Square[],
    capturedSoFar: Square[],
    capturedSet: Set<number>,
  ): void {
    // Promotion stop: if this pawn just landed on its king row, terminate.
    if (
      piece.type === PieceType.Pawn &&
      pathSoFar.length > 0 &&
      isPromotionSquare(currentSq, piece.color)
    ) {
      completedChains.push({
        from: sq,
        path: [...pathSoFar],
        captured: [...capturedSoFar],
      });
      return;
    }

    let foundContinuation = false;

    for (const direction of directions) {
      const adjacent = getAdjacentSquare(currentSq, direction);
      if (adjacent === null) continue;

      // Already captured this piece in the chain — skip
      if (capturedSet.has(adjacent as number)) continue;

      const adjacentPiece = getBoardSquare(board, adjacent);
      if (adjacentPiece === null || adjacentPiece.color === piece.color) continue;

      const landing = getJumpTarget(currentSq, direction);
      if (landing === null) continue;

      // Landing must be empty, or it's the piece's own starting square (vacated)
      const landingContents = getBoardSquare(board, landing);
      if (landingContents !== null && (landing as number) !== (sq as number)) continue;

      foundContinuation = true;
      const newCapturedSet = new Set(capturedSet);
      newCapturedSet.add(adjacent as number);

      explore(landing, [...pathSoFar, landing], [...capturedSoFar, adjacent], newCapturedSet);
    }

    // No continuation found — record this chain if it has at least one jump
    if (!foundContinuation && pathSoFar.length > 0) {
      completedChains.push({
        from: sq,
        path: [...pathSoFar],
        captured: [...capturedSoFar],
      });
    }
  }

  explore(sq, [], [], new Set());
  return completedChains;
}

// ---------------------------------------------------------------------------
// Top-level legal move generation
// ---------------------------------------------------------------------------

/**
 * Returns all legal moves for the active color on the given board.
 *
 * Enforces mandatory capture: if any jumps exist for any piece of the
 * active color, only jumps are returned.
 */
export function getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
  const pieces = getSquaresWithColor(board, activeColor);

  // Pass 1: collect all jumps
  const allJumps: Move[] = [];
  for (const sq of pieces) {
    const jumps = getJumpsForPiece(board, sq);
    allJumps.push(...jumps);
  }

  if (allJumps.length > 0) {
    return allJumps;
  }

  // Pass 2: no jumps — collect simple moves
  const allSimpleMoves: Move[] = [];
  for (const sq of pieces) {
    const moves = getSimpleMovesForPiece(board, sq);
    allSimpleMoves.push(...moves);
  }

  return allSimpleMoves;
}

// ---------------------------------------------------------------------------
// UI convenience helpers
// ---------------------------------------------------------------------------

/**
 * Returns all legal moves originating from a specific square.
 * Respects mandatory capture: if jumps exist for ANY piece of the same color,
 * only jump moves from this square are returned.
 */
export function getLegalMovesForPiece(board: BoardState, sq: Square): Move[] {
  const piece = getBoardSquare(board, sq);
  if (piece === null) return [];

  const allPieces = getSquaresWithColor(board, piece.color);
  let jumpsExist = false;
  for (const p of allPieces) {
    if (getJumpsForPiece(board, p).length > 0) {
      jumpsExist = true;
      break;
    }
  }

  if (jumpsExist) {
    return getJumpsForPiece(board, sq);
  }

  return getSimpleMovesForPiece(board, sq);
}

/**
 * Filters moves to those whose first path step matches the given target square.
 * Used by the UI to resolve a click on a highlighted destination.
 */
export function getMovesToSquare(moves: Move[], target: Square): Move[] {
  return moves.filter((m) => m.path.length > 0 && (m.path[0] as number) === (target as number));
}
