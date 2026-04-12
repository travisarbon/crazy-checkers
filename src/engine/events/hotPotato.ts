/**
 * Hot Potato — production event decorator.
 *
 * After the affected player completes their next move, the piece they moved
 * switches to the opponent's color. The piece retains its type (pawn or king).
 * If the switched piece is a pawn on its new color's promotion row, it promotes.
 *
 * Duration: 2 plies (survives the opponent's intervening turn, fires on
 * the triggeredBy player's next turn).
 *
 * Stateless: triggeredBy derived from activeEventsContext, not instance fields.
 * No metadata needed.
 */

import type { BoardState, Move, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent, opponentColor, PieceType } from '../types';
import { getBoardSquare, isPromotionSquare, setBoardSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Switches the color of the piece on the given square to the opponent's color.
 * Retains the piece's type (pawn or king). If the switched piece is a pawn
 * and is now on its new color's promotion row, promotes it to king.
 *
 * Returns a new board with the modified piece. If the square is empty,
 * returns the board unchanged (defensive).
 *
 * Pure function — no side effects.
 */
export function switchPieceColor(board: BoardState, sq: Square): BoardState {
  const piece = getBoardSquare(board, sq);
  if (piece === null) return board;

  const newColor = opponentColor(piece.color);

  // Determine type: if pawn and now on new color's promotion row, promote
  let newType = piece.type;
  if (piece.type === PieceType.Pawn && isPromotionSquare(sq, newColor)) {
    newType = PieceType.King;
  }

  const newPiece = { color: newColor, type: newType };
  return setBoardSquare(board, sq, newPiece);
}

export class HotPotatoDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.HotPotato;
  }

  withInner(inner: RuleSet): HotPotatoDecorator {
    return new HotPotatoDecorator(inner);
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    // Delegate to inner first (chain order)
    let result = super.onTurnEnd(board, activeColor, move);

    // Count how many HotPotato events target this player.
    // Permanent Choice mode events apply to BOTH players regardless of triggeredBy.
    const matchingEntries = this.activeEventsContext.filter(
      e => e.type === this.getEventType() && (
        e.triggeredBy === activeColor || e.permanent === true
      ),
    );

    if (matchingEntries.length === 0) return result;

    const landingSquare = move.path[move.path.length - 1];
    if (landingSquare === undefined) return result;

    // Apply color switch once per matching entry (parity-based):
    // Odd count = net switch; even count = cancel out (double switch)
    if (matchingEntries.length % 2 === 1) {
      result = switchPieceColor(result, landingSquare);
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.HotPotato,
  (base: RuleSet) => new HotPotatoDecorator(base),
);

/**
 * Metadata stored in ActiveEvent.metadata for Hot Potato.
 * Records the square of the "hot" piece at trigger time so the UI
 * can render a visual indicator on that piece.
 */
export interface HotPotatoMetadata {
  readonly hotSquare: number;
}

// Register metadata factory — stores the landing square of the triggering move
// so the UI overlay can highlight the "hot" piece (Task 11.3).
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.HotPotato,
  (_board, _activeColor, _randomFn?, move?) => {
    if (!move) return undefined;
    const landingSquare = move.path[move.path.length - 1];
    if (landingSquare === undefined) return undefined;
    return { hotSquare: landingSquare as number };
  },
);
