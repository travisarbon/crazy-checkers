/**
 * Flying move generation for Up in the Air event (and future International Draughts).
 *
 * Flying movement allows pieces to slide any number of squares diagonally:
 * - Pawns: forward-only, multiple squares.
 * - Kings: all four diagonal directions, multiple squares.
 * - Captures: fly over empty squares to reach an opponent, land on any empty beyond.
 * - Multi-jumps: each hop uses flying scan logic.
 *
 * Reusable module — designed for Up in the Air (Phase 2), Frequent Flyer choice mode
 * (Phase 3), and International Draughts (Phase 4).
 */

import type { BoardState, Move, Piece, Square } from './types';
import { Direction, PieceColor, PieceType } from './types';
import {
  getAdjacentSquare,
  getBoardSquare,
  getSquaresWithColor,
  isPromotionSquare,
} from './board';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the diagonal directions a piece may fly in.
 * Pawns: forward-only (2 directions). Kings: all four directions.
 */
function getFlyingDirections(piece: Piece): Direction[] {
  if (piece.type === PieceType.King) {
    return [
      Direction.ForwardLeft,
      Direction.ForwardRight,
      Direction.BackwardLeft,
      Direction.BackwardRight,
    ];
  }
  // Pawns — forward only
  if (piece.color === PieceColor.White) {
    return [Direction.ForwardLeft, Direction.ForwardRight];
  }
  return [Direction.BackwardLeft, Direction.BackwardRight];
}

// ---------------------------------------------------------------------------
// Flying simple moves
// ---------------------------------------------------------------------------

/**
 * Returns all non-capturing flying moves for a piece.
 * The piece slides any number of empty squares diagonally in each legal direction.
 * Stops at the board edge or any occupied square.
 */
export function getFlyingSimpleMoves(board: BoardState, sq: Square): Move[] {
  const piece = getBoardSquare(board, sq);
  if (piece === null) return [];

  const directions = getFlyingDirections(piece);
  const moves: Move[] = [];

  for (const direction of directions) {
    let next = getAdjacentSquare(sq, direction);
    while (next !== null) {
      if (getBoardSquare(board, next) !== null) break; // Occupied
      moves.push({ from: sq, path: [next], captured: [] });
      next = getAdjacentSquare(next, direction);
    }
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Flying jump generation
// ---------------------------------------------------------------------------

/**
 * Recursive explorer for flying jump chains (including multi-jumps).
 *
 * Flying jump rules:
 * - Scan diagonally, passing over empty squares.
 * - When an opponent piece is found, land on any empty square beyond it.
 * - Only one opponent piece can be jumped per diagonal scan.
 * - A piece cannot re-capture a piece already jumped in the current chain.
 * - Promotion stop rule: a pawn reaching its king row terminates the chain.
 */
function exploreFlyingJump(
  board: BoardState,
  piece: Piece,
  currentSq: Square,
  pathSoFar: Square[],
  capturedSoFar: Square[],
  capturedSet: Set<number>,
  originSq: Square,
  completedChains: Move[],
): void {
  const directions = getFlyingDirections(piece);
  let foundContinuation = false;

  for (const direction of directions) {
    // Scan along the diagonal looking for a capturable opponent
    let nextSq = getAdjacentSquare(currentSq, direction);

    while (nextSq !== null) {
      const nextPiece = getBoardSquare(board, nextSq);

      // Empty square or the origin (vacated) — keep scanning
      if (nextPiece === null || (nextSq as number) === (originSq as number)) {
        nextSq = getAdjacentSquare(nextSq, direction);
        continue;
      }

      // Friendly piece — blocked, stop scanning this direction
      if (nextPiece.color === piece.color) break;

      // Already captured in this chain — stop scanning (cannot pass over)
      if (capturedSet.has(nextSq as number)) break;

      // Found an opponent piece at nextSq — scan for landing squares beyond it
      const capturedSq = nextSq;
      let beyondSq = getAdjacentSquare(capturedSq, direction);

      while (beyondSq !== null) {
        const beyondPiece = getBoardSquare(board, beyondSq);
        // Landing square must be empty or the origin (vacated)
        if (beyondPiece !== null && (beyondSq as number) !== (originSq as number)) break;

        // Valid landing — record it
        foundContinuation = true;
        const newPath = [...pathSoFar, beyondSq];
        const newCaptured = [...capturedSoFar, capturedSq];
        const newCapturedSet = new Set(capturedSet);
        newCapturedSet.add(capturedSq as number);

        // Promotion stop rule: pawn reaching king row terminates the chain
        if (
          piece.type === PieceType.Pawn &&
          isPromotionSquare(beyondSq, piece.color)
        ) {
          completedChains.push({
            from: originSq,
            path: newPath,
            captured: newCaptured,
          });
        } else {
          // Recurse to find further captures from this landing
          exploreFlyingJump(
            board,
            piece,
            beyondSq,
            newPath,
            newCaptured,
            newCapturedSet,
            originSq,
            completedChains,
          );
        }

        beyondSq = getAdjacentSquare(beyondSq, direction);
      }

      // Only one opponent piece per diagonal scan — stop scanning this direction
      break;
    }
  }

  // Terminal chain: no further captures found, but at least one capture was made
  if (!foundContinuation && capturedSoFar.length > 0) {
    completedChains.push({
      from: originSq,
      path: pathSoFar,
      captured: capturedSoFar,
    });
  }
}

/**
 * Returns all complete flying jump chains for a piece, including multi-jumps.
 */
export function getFlyingJumps(board: BoardState, sq: Square): Move[] {
  const piece = getBoardSquare(board, sq);
  if (piece === null) return [];

  const completedChains: Move[] = [];

  exploreFlyingJump(
    board,
    piece,
    sq,     // currentSq
    [],     // pathSoFar
    [],     // capturedSoFar
    new Set<number>(), // capturedSet
    sq,     // originSq
    completedChains,
  );

  return completedChains;
}

// ---------------------------------------------------------------------------
// Top-level legal move generation
// ---------------------------------------------------------------------------

/**
 * Returns all legal moves for the active color under flying movement rules.
 * Enforces mandatory capture: if any flying jump exists, only jumps are returned.
 *
 * This function is the flying equivalent of getLegalMoves() in moves.ts.
 */
export function getFlyingLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
  const pieces = getSquaresWithColor(board, activeColor);

  // Pass 1: collect all flying jumps
  const allJumps: Move[] = [];
  for (const sq of pieces) {
    allJumps.push(...getFlyingJumps(board, sq));
  }

  if (allJumps.length > 0) {
    return allJumps; // Mandatory capture
  }

  // Pass 2: collect all flying simple moves
  const allSimple: Move[] = [];
  for (const sq of pieces) {
    allSimple.push(...getFlyingSimpleMoves(board, sq));
  }

  return allSimple;
}
