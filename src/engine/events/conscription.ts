/**
 * Conscription — production event decorator (Event 14).
 *
 * When a piece is captured, it switches to the capturing player's color
 * instead of being removed from the board. The captured piece remains on
 * its current square with its type preserved (pawn or king), but its color
 * flips. In multi-jump chains, each individually captured piece is flipped.
 *
 * Duration: 4 plies (2 rounds). Stateless: no metadata needed.
 *
 * Overrides `applyMove` rather than `onCapture` so the pre-capture board
 * is available for reading the original piece types at captured squares.
 */

import type { BoardState, Move, RuleSet, Square } from '../types';
import { CrazyEvent, PieceColor, PieceType, opponentColor } from '../types';
import { getBoardSquare, isPromotionSquare, setBoardSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

export class ConscriptionDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Conscription;
  }

  withInner(inner: RuleSet): ConscriptionDecorator {
    return new ConscriptionDecorator(inner);
  }

  override applyMove(board: BoardState, move: Move): BoardState {
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.applyMove(board, move);
    }

    // Snapshot captured pieces before inner applyMove removes them
    const capturedPieces: Array<{ square: Square; color: PieceColor; type: PieceType }> = [];
    for (const sq of move.captured) {
      const piece = getBoardSquare(board, sq);
      if (piece !== null) {
        capturedPieces.push({ square: sq, color: piece.color, type: piece.type });
      }
    }

    // Apply standard move (removes captured pieces, places moving piece at destination)
    let result = this.inner.applyMove(board, move);

    // Re-place captured pieces with flipped colors
    for (const { square, color, type } of capturedPieces) {
      const newColor = opponentColor(color); // = capturing player's color
      let newType = type;
      // Promotion check: pawn on new color's promotion row
      if (newType === PieceType.Pawn && isPromotionSquare(square, newColor)) {
        newType = PieceType.King;
      }
      result = setBoardSquare(result, square, { color: newColor, type: newType });
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Conscription,
  (base: RuleSet) => new ConscriptionDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Conscription,
  () => undefined,
);
