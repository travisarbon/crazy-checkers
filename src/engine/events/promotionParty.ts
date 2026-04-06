/**
 * Promotion Party — production event decorator (Event 22).
 *
 * Promotion zone expands from one row to two rows for 2 rounds (4 plies).
 * White pawns promote on row 0 OR row 1. Black pawns promote on row 6 OR row 7.
 * Only overrides shouldPromote — does not modify getLegalMoves.
 *
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { BoardState, Move, Piece, PieceColor, RuleSet, Square, SquareState } from '../types';
import { CrazyEvent, PieceColor as PC, PieceType } from '../types';
import { getBoardSquare, squareToGrid } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns the expanded promotion row for a given color.
 * White: row 1 (in addition to standard row 0).
 * Black: row 6 (in addition to standard row 7).
 */
export function getExpandedPromotionRow(color: PieceColor): number {
  return color === PC.White ? 1 : 6;
}

/**
 * Returns true if the given square is on the expanded promotion row
 * for the given color.
 */
export function isExpandedPromotionSquare(sq: Square, color: PieceColor): boolean {
  const { row } = squareToGrid(sq);
  return row === getExpandedPromotionRow(color);
}

export class PromotionPartyDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.PromotionParty;
  }

  withInner(inner: RuleSet): PromotionPartyDecorator {
    return new PromotionPartyDecorator(inner);
  }

  override shouldPromote(piece: Piece, sq: Square): boolean {
    const innerResult = this.inner.shouldPromote(piece, sq);
    if (innerResult) return true;

    if (!this.isActive(this.activeEventsContext)) return false;
    if (piece.type === PieceType.King) return false;

    return isExpandedPromotionSquare(sq, piece.color);
  }

  override applyMove(board: BoardState, move: Move): BoardState {
    const result = this.inner.applyMove(board, move);

    if (!this.isActive(this.activeEventsContext)) return result;

    // Post-process: check if the landing piece should be promoted on
    // the expanded zone. The inner applyMove already handled standard
    // promotion (row 0/7); we only need to handle the expanded zone.
    const finalSquare = move.path[move.path.length - 1];
    if (finalSquare === undefined) return result;

    const landingPiece = getBoardSquare(result, finalSquare);
    if (landingPiece === null || landingPiece.type === PieceType.King) return result;

    if (isExpandedPromotionSquare(finalSquare, landingPiece.color)) {
      const newBoard = [...result] as SquareState[];
      newBoard[(finalSquare as number) - 1] = { color: landingPiece.color, type: PieceType.King };
      return newBoard;
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.PromotionParty,
  (base: RuleSet) => new PromotionPartyDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.PromotionParty,
  () => undefined,
);
