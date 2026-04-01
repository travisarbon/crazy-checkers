/**
 * Board evaluation heuristic for the AI opponent.
 * Task 3.1 implements the evaluate function with material, advancement,
 * center control, back-row defense, mobility, and trapped-king factors.
 */

import type { BoardState, Square } from '../engine/types';
import { PieceColor, PieceType, opponentColor } from '../engine/types';
import { getBoardSquare, getSquaresWithColor, squareToGrid } from '../engine/board';
import { getAllAdjacentSquares } from '../engine/board';
import { getLegalMoves } from '../engine/moves';

// ---------------------------------------------------------------------------
// Weight configuration
// ---------------------------------------------------------------------------

export const EVAL_WEIGHTS = {
  pawnValue: 100,
  kingValue: 150,
  advancementPerRow: 5,
  centerBonus: 10,
  expandedCenterBonus: 5,
  backRowBonus: 10,
  mobilityPerMove: 2,
  trappedKingPenalty: 30,
  semiTrappedKingPenalty: 15,
  endgamePieceThreshold: 8,
  endgameKingValue: 175,
  endgameAdvancementPerRow: 8,
  winScore: 10_000,
  lossScore: -10_000,
} as const;

// ---------------------------------------------------------------------------
// Pre-computed square sets
// ---------------------------------------------------------------------------

/** Central squares with maximum diagonal reach. */
export const CENTER_SQUARES: ReadonlySet<number> = new Set([14, 15, 18, 19]);

/** Expanded center ring around the core center squares. */
export const EXPANDED_CENTER_SQUARES: ReadonlySet<number> = new Set([
  6, 7, 10, 11, 22, 23, 26, 27,
]);

/** White's starting back row (squares 29–32). */
export const WHITE_BACK_ROW: ReadonlySet<number> = new Set([29, 30, 31, 32]);

/** Black's starting back row (squares 1–4). */
export const BLACK_BACK_ROW: ReadonlySet<number> = new Set([1, 2, 3, 4]);

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns how many rows a pawn has advanced from its starting position.
 * White pawns start on rows 5–7 and advance toward row 0.
 * Black pawns start on rows 0–2 and advance toward row 7.
 */
export function getPawnAdvancement(sq: Square, color: PieceColor): number {
  const { row } = squareToGrid(sq);
  if (color === PieceColor.White) {
    // White starts at rows 5-7, advances toward row 0.
    // Row 7 = 0 advancement, row 0 = 7 advancement.
    return 7 - row;
  }
  // Black starts at rows 0-2, advances toward row 7.
  return row;
}

/**
 * Counts how many diagonal escape squares a king at the given square has.
 * An escape square is an adjacent empty square or a square off the board edge
 * (which doesn't count). Only empty adjacent squares count as escapes.
 */
export function kingEscapeCount(board: BoardState, sq: Square): number {
  const neighbors = getAllAdjacentSquares(sq);
  let escapes = 0;
  for (const { adjacent } of neighbors) {
    if (getBoardSquare(board, adjacent) === null) {
      escapes++;
    }
  }
  return escapes;
}

// ---------------------------------------------------------------------------
// Main evaluation function
// ---------------------------------------------------------------------------

/**
 * Evaluates a board position from the perspective of the given color.
 * Positive scores favor the given color; negative scores favor the opponent.
 *
 * Factors:
 * 1. Material (piece count weighted by type)
 * 2. Advancement (pawns closer to king row)
 * 3. Center control
 * 4. Back-row defense
 * 5. Mobility (legal move count)
 * 6. Trapped kings
 */
export function evaluate(board: BoardState, color: PieceColor): number {
  const myPieces = getSquaresWithColor(board, color);
  const oppPieces = getSquaresWithColor(board, opponentColor(color));

  // --- Terminal state detection ---
  if (myPieces.length === 0) {
    return EVAL_WEIGHTS.lossScore;
  }
  if (oppPieces.length === 0) {
    return EVAL_WEIGHTS.winScore;
  }

  // Check for no legal moves (loss)
  const myMoves = getLegalMoves(board, color);
  if (myMoves.length === 0) {
    return EVAL_WEIGHTS.lossScore;
  }

  const oppMoves = getLegalMoves(board, opponentColor(color));
  if (oppMoves.length === 0) {
    return EVAL_WEIGHTS.winScore;
  }

  // --- Endgame detection ---
  const totalPieces = myPieces.length + oppPieces.length;
  const isEndgame = totalPieces <= EVAL_WEIGHTS.endgamePieceThreshold;

  const kingValue = isEndgame ? EVAL_WEIGHTS.endgameKingValue : EVAL_WEIGHTS.kingValue;
  const advancementPerRow = isEndgame
    ? EVAL_WEIGHTS.endgameAdvancementPerRow
    : EVAL_WEIGHTS.advancementPerRow;

  // --- Score each side ---
  let myScore = 0;
  let oppScore = 0;

  const backRow = color === PieceColor.White ? WHITE_BACK_ROW : BLACK_BACK_ROW;
  const oppBackRow = color === PieceColor.White ? BLACK_BACK_ROW : WHITE_BACK_ROW;

  // Score my pieces
  for (const sq of myPieces) {
    const piece = getBoardSquare(board, sq);
    if (piece === null) continue;
    const sqNum = sq as number;

    // Material
    if (piece.type === PieceType.King) {
      myScore += kingValue;
    } else {
      myScore += EVAL_WEIGHTS.pawnValue;
    }

    // Advancement (pawns only)
    if (piece.type === PieceType.Pawn) {
      myScore += getPawnAdvancement(sq, color) * advancementPerRow;
    }

    // Center control
    if (CENTER_SQUARES.has(sqNum)) {
      myScore += EVAL_WEIGHTS.centerBonus;
    } else if (EXPANDED_CENTER_SQUARES.has(sqNum)) {
      myScore += EVAL_WEIGHTS.expandedCenterBonus;
    }

    // Back-row defense (pawns on their starting back row)
    if (piece.type === PieceType.Pawn && backRow.has(sqNum)) {
      myScore += EVAL_WEIGHTS.backRowBonus;
    }

    // Trapped kings
    if (piece.type === PieceType.King) {
      const escapes = kingEscapeCount(board, sq);
      if (escapes === 0) {
        myScore -= EVAL_WEIGHTS.trappedKingPenalty;
      } else if (escapes === 1) {
        myScore -= EVAL_WEIGHTS.semiTrappedKingPenalty;
      }
    }
  }

  // Score opponent pieces
  for (const sq of oppPieces) {
    const piece = getBoardSquare(board, sq);
    if (piece === null) continue;
    const sqNum = sq as number;

    // Material
    if (piece.type === PieceType.King) {
      oppScore += kingValue;
    } else {
      oppScore += EVAL_WEIGHTS.pawnValue;
    }

    // Advancement (pawns only)
    if (piece.type === PieceType.Pawn) {
      oppScore += getPawnAdvancement(sq, opponentColor(color)) * advancementPerRow;
    }

    // Center control
    if (CENTER_SQUARES.has(sqNum)) {
      oppScore += EVAL_WEIGHTS.centerBonus;
    } else if (EXPANDED_CENTER_SQUARES.has(sqNum)) {
      oppScore += EVAL_WEIGHTS.expandedCenterBonus;
    }

    // Back-row defense
    if (piece.type === PieceType.Pawn && oppBackRow.has(sqNum)) {
      oppScore += EVAL_WEIGHTS.backRowBonus;
    }

    // Trapped kings
    if (piece.type === PieceType.King) {
      const escapes = kingEscapeCount(board, sq);
      if (escapes === 0) {
        oppScore -= EVAL_WEIGHTS.trappedKingPenalty;
      } else if (escapes === 1) {
        oppScore -= EVAL_WEIGHTS.semiTrappedKingPenalty;
      }
    }
  }

  // --- Mobility ---
  myScore += myMoves.length * EVAL_WEIGHTS.mobilityPerMove;
  oppScore += oppMoves.length * EVAL_WEIGHTS.mobilityPerMove;

  return myScore - oppScore;
}
