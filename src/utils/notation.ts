/**
 * Standard American Checkers notation conversion.
 *
 * Simple moves use dash: "11-15"
 * Captures use 'x': "22x15", "9x18x25"
 *
 * Notation encodes origin and landing squares, not captured squares.
 */

import type { BoardState, Move, Square } from '../engine/types';
import { square } from '../engine/types';
import { getBoardSquare, gridToSquare, squareToGrid } from '../engine/board';

/**
 * Converts a Move object to standard American Checkers notation.
 *
 * Simple moves: "from-to" (e.g., "11-15").
 * Captures: "fromxlanding1xlanding2..." (e.g., "22x15" or "9x18x25").
 */
export function moveToString(move: Move): string {
  const separator = move.captured.length > 0 ? 'x' : '-';
  const squares: number[] = [move.from as number, ...move.path.map((sq) => sq as number)];
  return squares.join(separator);
}

/**
 * Parses a standard American Checkers notation string into a Move object.
 *
 * Requires the current board state to reconstruct captured squares
 * (notation only encodes landing squares, not captured squares).
 *
 * @throws Error if notation is malformed or board state is inconsistent.
 */
export function stringToMove(notation: string, board: BoardState): Move {
  const isCapture = notation.includes('x');
  const separator = isCapture ? 'x' : '-';
  const parts = notation.split(separator);

  if (parts.length < 2) {
    throw new Error(`Invalid notation: "${notation}" — must contain at least two squares.`);
  }

  const squares: Square[] = parts.map((part, index) => {
    const num = Number(part.trim());
    if (!Number.isInteger(num) || num < 1 || num > 32) {
      throw new Error(
        `Invalid notation: "${notation}" — "${part.trim()}" at position ${String(index)} is not a valid square (1–32).`,
      );
    }
    return square(num);
  });

  const from = squares[0] as Square;
  const path = squares.slice(1);

  const captured: Square[] = [];

  if (isCapture) {
    const allSquares = [from, ...path];

    for (let i = 0; i < allSquares.length - 1; i++) {
      const startSq = allSquares[i] as Square;
      const endSq = allSquares[i + 1] as Square;

      const startGrid = squareToGrid(startSq);
      const endGrid = squareToGrid(endSq);

      const midRow = (startGrid.row + endGrid.row) / 2;
      const midCol = (startGrid.col + endGrid.col) / 2;

      if (!Number.isInteger(midRow) || !Number.isInteger(midCol)) {
        throw new Error(
          `Invalid notation: "${notation}" — squares ${String(startSq)} and ${String(endSq)} are not a valid jump (no integer midpoint).`,
        );
      }

      const midSquare = gridToSquare(midRow, midCol);
      if (midSquare === null) {
        throw new Error(
          `Invalid notation: "${notation}" — midpoint between ${String(startSq)} and ${String(endSq)} is not a playable square.`,
        );
      }

      const midPiece = getBoardSquare(board, midSquare);
      if (midPiece === null) {
        throw new Error(
          `Invalid notation: "${notation}" — no piece at square ${String(midSquare)} to capture (between ${String(startSq)} and ${String(endSq)}).`,
        );
      }

      captured.push(midSquare);
    }
  }

  return { from, path, captured };
}

/**
 * Converts an array of moves to notation strings.
 */
export function gameMovesToNotation(moves: readonly Move[]): string[] {
  return moves.map(moveToString);
}

/**
 * Formats a move with its move number for the move history panel.
 *
 * White's moves (even ply indices) get a move number prefix: "1. 11-15"
 * Black's moves (odd ply indices) get no prefix: "22-17"
 */
export function formatMoveNumber(plyIndex: number, notation: string): string {
  const moveNumber = Math.floor(plyIndex / 2) + 1;
  if (plyIndex % 2 === 0) {
    return `${String(moveNumber)}. ${notation}`;
  }
  return notation;
}
