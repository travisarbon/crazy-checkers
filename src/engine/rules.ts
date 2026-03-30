/**
 * Rule interface and American Rules implementation.
 *
 * The RuleSet interface is the primary extensibility point for the entire project.
 * Phase 2 event modifiers implement it as decorators wrapping an inner RuleSet.
 * Phase 4 Classified games provide entirely new implementations.
 *
 * Public API:
 * - RuleSet (interface)
 * - AmericanRules (class)
 * - createAmericanRules() (factory)
 */

import type { BoardState, GameResult, Move, Piece, RuleSet, Square, SquareState } from './types';
import { GameEndReason, GameResultType, PieceColor, PieceType } from './types';

export type { RuleSet } from './types';
import { getBoardSquare, getSquaresWithColor, isPromotionSquare } from './board';
import { getLegalMoves as generateLegalMoves } from './moves';

// ---------------------------------------------------------------------------
// AmericanRules implementation
// ---------------------------------------------------------------------------

/** Standard American Rules Checkers (English Draughts). */
export class AmericanRules implements RuleSet {
  getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    return generateLegalMoves(board, activeColor);
  }

  applyMove(board: BoardState, move: Move): BoardState {
    const newBoard = [...board] as SquareState[];

    // 1. Get the piece being moved
    const piece = getBoardSquare(board, move.from);
    if (piece === null) {
      throw new Error(`applyMove: no piece at square ${String(move.from)}`);
    }

    // 2. Remove the piece from its starting square
    newBoard[(move.from as number) - 1] = null;

    // 3. Remove all captured pieces
    for (const captured of move.captured) {
      newBoard[(captured as number) - 1] = null;
    }

    // 4. Determine the final landing square
    const finalSquare = move.path[move.path.length - 1];
    if (finalSquare === undefined) {
      throw new Error('applyMove: move has empty path');
    }

    // 5. Check for promotion and place the piece
    const landingPiece: Piece = this.shouldPromote(piece, finalSquare)
      ? { color: piece.color, type: PieceType.King }
      : piece;

    newBoard[(finalSquare as number) - 1] = landingPiece;

    return newBoard;
  }

  checkGameOver(board: BoardState, activeColor: PieceColor): GameResult | null {
    const legalMoves = this.getLegalMoves(board, activeColor);

    if (legalMoves.length === 0) {
      const pieces = getSquaresWithColor(board, activeColor);
      const reason =
        pieces.length === 0 ? GameEndReason.NoPiecesLeft : GameEndReason.NoLegalMoves;
      const type =
        activeColor === PieceColor.White ? GameResultType.BlackWin : GameResultType.WhiteWin;

      return { type, reason };
    }

    return null;
  }

  shouldPromote(piece: Piece, sq: Square): boolean {
    if (piece.type === PieceType.King) return false;
    return isPromotionSquare(sq, piece.color);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a standard American Rules rule set. */
export function createAmericanRules(): RuleSet {
  return new AmericanRules();
}
