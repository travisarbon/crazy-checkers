/**
 * Shared type definitions for the Crazy Checkers engine.
 */

/** The two player colors. White moves first. */
export const PieceColor = {
  White: 'WHITE',
  Black: 'BLACK',
} as const;
export type PieceColor = (typeof PieceColor)[keyof typeof PieceColor];

/** Piece rank. Pawns promote to kings on the far row. */
export const PieceType = {
  Pawn: 'PAWN',
  King: 'KING',
} as const;
export type PieceType = (typeof PieceType)[keyof typeof PieceType];

/** A piece on the board. */
export interface Piece {
  readonly color: PieceColor;
  readonly type: PieceType;
}

/**
 * A square index on the standard checkers board, numbered 1–32.
 *
 * Standard checkers numbering for an 8×8 board (only dark squares are playable):
 *
 *     Row 0 (top, Black's start / White's king row):  1   2   3   4
 *     Row 1:                                           5   6   7   8
 *     Row 2:                                           9  10  11  12
 *     Row 3:                                          13  14  15  16
 *     Row 4:                                          17  18  19  20
 *     Row 5:                                          21  22  23  24
 *     Row 6:                                          25  26  27  28
 *     Row 7 (bottom, White's start / Black's king row):29  30  31  32
 *
 * Branded type prevents accidentally passing a raw number where a Square is expected.
 */
export type Square = number & { readonly __brand: 'Square' };

/** Creates a Square from a raw number (1–32). Throws on out-of-range values. */
export function square(n: number): Square {
  if (n < 1 || n > 32 || !Number.isInteger(n)) {
    throw new RangeError(`Invalid square number: ${String(n)}. Must be an integer 1–32.`);
  }
  return n as Square;
}

/** Row and column on the 8×8 grid (0-indexed, row 0 = top of board). */
export interface GridPosition {
  readonly row: number; // 0–7, top to bottom
  readonly col: number; // 0–7, left to right
}

/** The state of a single playable square: either empty or occupied by a piece. */
export type SquareState = Piece | null;

/**
 * The board as a flat array of 32 playable squares.
 * Index 0 = square 1, index 31 = square 32.
 * Each element is either a Piece or null (empty).
 */
export type BoardState = readonly SquareState[];

/**
 * A move: a starting square and one or more destination squares.
 * - Simple move: path has 1 element.
 * - Single jump: path has 1 element, captured has 1 element.
 * - Multi-jump: path has N elements (each intermediate landing + final),
 *   captured has N elements (one per jump in the chain).
 */
export interface Move {
  readonly from: Square;
  readonly path: readonly Square[];
  readonly captured: readonly Square[];
}

/** How a game ended. */
export const GameResultType = {
  WhiteWin: 'WHITE_WIN',
  BlackWin: 'BLACK_WIN',
  Draw: 'DRAW',
} as const;
export type GameResultType = (typeof GameResultType)[keyof typeof GameResultType];

/** The reason a game ended. */
export const GameEndReason = {
  NoPiecesLeft: 'NO_PIECES_LEFT',
  NoLegalMoves: 'NO_LEGAL_MOVES',
  Repetition: 'REPETITION',
  FortyMoveRule: 'FORTY_MOVE_RULE',
  Resignation: 'RESIGNATION',
} as const;
export type GameEndReason = (typeof GameEndReason)[keyof typeof GameEndReason];

/** Full game result. */
export interface GameResult {
  readonly type: GameResultType;
  readonly reason: GameEndReason;
}

/** The player types the game needs to distinguish. */
export const PlayerType = {
  Human: 'HUMAN',
  CpuEasy: 'CPU_EASY',
  CpuHard: 'CPU_HARD',
} as const;
export type PlayerType = (typeof PlayerType)[keyof typeof PlayerType];

/** Diagonal directions for adjacency lookups. */
export const Direction = {
  ForwardLeft: 'FORWARD_LEFT',
  ForwardRight: 'FORWARD_RIGHT',
  BackwardLeft: 'BACKWARD_LEFT',
  BackwardRight: 'BACKWARD_RIGHT',
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

/** Returns the opposite color. */
export function opponentColor(color: PieceColor): PieceColor {
  return color === PieceColor.White ? PieceColor.Black : PieceColor.White;
}
