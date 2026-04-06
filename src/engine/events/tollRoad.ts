/**
 * Toll Road — production event decorator (Event 31).
 *
 * Whenever a player makes a capture, their least advanced piece is also
 * removed from the board as a toll. One toll per turn. If the capturing
 * piece is the player's only piece, no toll is paid.
 *
 * Duration: 4 plies (2 rounds). Stateless: no metadata needed.
 */

import type { BoardState, Move, RuleSet, Square } from '../types';
import { CrazyEvent, PieceColor } from '../types';
import { getSquaresWithColor, setBoardSquare, squareToGrid } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns the square of the least advanced piece of the given color,
 * or null if the player has 1 or fewer pieces (can't toll the last piece).
 *
 * Advancement: White advances toward row 0 (advancement = 7 - row),
 * Black advances toward row 7 (advancement = row).
 * Least advanced = lowest advancement value.
 * Ties broken by column: rightmost for White, leftmost for Black.
 */
export function getLeastAdvancedPiece(board: BoardState, color: PieceColor): Square | null {
  const pieces: Array<{ sq: Square; advancement: number; col: number }> = [];

  for (const sq of getSquaresWithColor(board, color)) {
    const { row, col } = squareToGrid(sq);
    const advancement = color === PieceColor.White ? 7 - row : row;
    pieces.push({ sq, advancement, col });
  }

  if (pieces.length <= 1) return null; // can't toll the last piece

  pieces.sort((a, b) => {
    if (a.advancement !== b.advancement) return a.advancement - b.advancement;
    // Tie-break: rightmost column for White, leftmost for Black
    return color === PieceColor.White ? b.col - a.col : a.col - b.col;
  });

  const first = pieces[0];
  return first !== undefined ? first.sq : null;
}

export class TollRoadDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.TollRoad;
  }

  withInner(inner: RuleSet): TollRoadDecorator {
    return new TollRoadDecorator(inner);
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    let result = super.onTurnEnd(board, activeColor, move);

    if (!this.isActive(this.activeEventsContext)) {
      return result;
    }

    // Only toll on captures
    if (move.captured.length === 0) return result;

    // Find and remove the least advanced piece
    const tollSquare = getLeastAdvancedPiece(result, activeColor);
    if (tollSquare === null) return result;

    result = setBoardSquare(result, tollSquare, null);

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.TollRoad,
  (base: RuleSet) => new TollRoadDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.TollRoad,
  () => undefined,
);
