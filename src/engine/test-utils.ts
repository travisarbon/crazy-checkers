/**
 * Shared test utilities for engine test files.
 */

import type { BoardState, SquareState } from './types';
import { PieceColor, PieceType } from './types';

export const W = PieceColor.White;
export const B = PieceColor.Black;
export const P = PieceType.Pawn;
export const K = PieceType.King;

/** Creates an empty 32-square board (all nulls). */
export function emptyBoard(): SquareState[] {
  return new Array<SquareState>(32).fill(null);
}

/** Places pieces on an empty board and returns it. */
export function buildBoard(
  placements: Array<{ sq: number; color: PieceColor; type: PieceType }>,
): BoardState {
  const board = emptyBoard();
  for (const { sq, color, type } of placements) {
    board[sq - 1] = { color, type };
  }
  return board;
}
