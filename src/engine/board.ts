/**
 * Board representation, square addressing, piece placement, and adjacency.
 */

import type { BoardState, GridPosition, Square, SquareState } from './types';
import { Direction, PieceColor, PieceType, square } from './types';

/** The total number of playable squares on a standard checkers board. */
export const BOARD_SIZE = 32;

/**
 * Creates the standard American Checkers starting position.
 * - Squares 1–12: Black pieces (pawns)
 * - Squares 13–20: empty
 * - Squares 21–32: White pieces (pawns)
 */
export function createInitialBoard(): BoardState {
  const board: SquareState[] = new Array<SquareState>(BOARD_SIZE).fill(null);

  for (let i = 0; i < 12; i++) {
    board[i] = { color: PieceColor.Black, type: PieceType.Pawn };
  }

  for (let i = 20; i < 32; i++) {
    board[i] = { color: PieceColor.White, type: PieceType.Pawn };
  }

  return board;
}

/**
 * Gets the contents of a square on the board.
 */
export function getBoardSquare(board: BoardState, sq: Square): SquareState {
  return board[sq - 1] ?? null;
}

/**
 * Returns a new board with the given square set to a new value.
 * Does not mutate the input board.
 */
export function setBoardSquare(board: BoardState, sq: Square, value: SquareState): BoardState {
  const newBoard = [...board];
  newBoard[sq - 1] = value;
  return newBoard;
}

/**
 * Converts a square number (1–32) to an 8×8 grid position.
 *
 * Even rows (0, 2, 4, 6): playable squares at columns 1, 3, 5, 7.
 * Odd rows (1, 3, 5, 7): playable squares at columns 0, 2, 4, 6.
 */
export function squareToGrid(sq: Square): GridPosition {
  const index = sq - 1;
  const row = Math.floor(index / 4);
  const posInRow = index % 4;

  const col = row % 2 === 0 ? posInRow * 2 + 1 : posInRow * 2;

  return { row, col };
}

/**
 * Converts an 8×8 grid position to a square number (1–32).
 * Returns null if the position is not a playable (dark) square.
 */
export function gridToSquare(row: number, col: number): Square | null {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;

  const isPlayable = row % 2 === 0 ? col % 2 === 1 : col % 2 === 0;
  if (!isPlayable) return null;

  const posInRow = row % 2 === 0 ? (col - 1) / 2 : col / 2;

  return square(row * 4 + posInRow + 1);
}

/** Grid deltas for each diagonal direction. */
const DIRECTION_DELTAS: Record<Direction, { dRow: number; dCol: number }> = {
  [Direction.ForwardLeft]: { dRow: -1, dCol: -1 },
  [Direction.ForwardRight]: { dRow: -1, dCol: 1 },
  [Direction.BackwardLeft]: { dRow: 1, dCol: -1 },
  [Direction.BackwardRight]: { dRow: 1, dCol: 1 },
};

/**
 * Given a square and a diagonal direction, returns the adjacent square
 * in that direction, or null if it's off the board.
 */
export function getAdjacentSquare(sq: Square, direction: Direction): Square | null {
  const { row, col } = squareToGrid(sq);
  const delta = DIRECTION_DELTAS[direction];
  return gridToSquare(row + delta.dRow, col + delta.dCol);
}

/**
 * Given a square and a direction, returns the square two steps away
 * in that direction (the landing square for a jump), or null if off the board.
 */
export function getJumpTarget(sq: Square, direction: Direction): Square | null {
  const { row, col } = squareToGrid(sq);
  const delta = DIRECTION_DELTAS[direction];
  return gridToSquare(row + delta.dRow * 2, col + delta.dCol * 2);
}

/**
 * Returns all four diagonal neighbors of a square that exist on the board.
 * Each result includes the direction, the adjacent square, and the jump-target square.
 */
export function getAllAdjacentSquares(sq: Square): Array<{
  direction: Direction;
  adjacent: Square;
  jumpTarget: Square | null;
}> {
  const results: Array<{ direction: Direction; adjacent: Square; jumpTarget: Square | null }> = [];
  for (const direction of Object.values(Direction)) {
    const adjacent = getAdjacentSquare(sq, direction);
    if (adjacent !== null) {
      const jumpTarget = getJumpTarget(sq, direction);
      results.push({ direction, adjacent, jumpTarget });
    }
  }
  return results;
}

/**
 * Returns all squares occupied by pieces of the given color.
 */
export function getSquaresWithColor(board: BoardState, color: PieceColor): Square[] {
  const result: Square[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const piece = board[i];
    if (piece != null && piece.color === color) {
      result.push(square(i + 1));
    }
  }
  return result;
}

/**
 * Counts the pieces on the board by color and type.
 */
export function countPieces(board: BoardState): {
  white: { pawns: number; kings: number };
  black: { pawns: number; kings: number };
} {
  const counts = {
    white: { pawns: 0, kings: 0 },
    black: { pawns: 0, kings: 0 },
  };
  for (let i = 0; i < BOARD_SIZE; i++) {
    const piece = board[i];
    if (piece == null) continue;
    const side = piece.color === PieceColor.White ? counts.white : counts.black;
    if (piece.type === PieceType.Pawn) side.pawns++;
    else side.kings++;
  }
  return counts;
}

/**
 * Returns the promotion row for a given color.
 * White promotes on row 0 (squares 1–4). Black promotes on row 7 (squares 29–32).
 */
export function getPromotionRow(color: PieceColor): number {
  return color === PieceColor.White ? 0 : 7;
}

/**
 * Returns true if the given square is on the promotion row for the given color.
 */
export function isPromotionSquare(sq: Square, color: PieceColor): boolean {
  const { row } = squareToGrid(sq);
  return row === getPromotionRow(color);
}

/**
 * Returns a shallow copy of the board.
 * Safe because Piece objects are treated as immutable.
 */
export function cloneBoard(board: BoardState): BoardState {
  return [...board] as BoardState;
}
