/**
 * Forced March — production event decorator (Event 27).
 *
 * Each turn, the active player must move their most advanced piece
 * (closest to opponent's back row). Ties broken by leftmost column.
 * If most advanced piece has no legal moves, any piece may move.
 * Mandatory capture overrides forced march.
 *
 * Duration: 4 plies (2 rounds).
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { BoardState, Move, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent, PieceColor as PC } from '../types';
import { getSquaresWithColor, squareToGrid } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns the square of the most advanced piece for the given color.
 * "Most advanced" = closest to opponent's back row.
 * - White: lowest row number (toward row 0)
 * - Black: highest row number (toward row 7)
 * Tiebreaker: leftmost column (lowest col number).
 *
 * Returns null if no pieces of the given color exist.
 */
export function getMostAdvancedPieceSquare(
  board: BoardState,
  activeColor: PieceColor,
): Square | null {
  const pieces = getSquaresWithColor(board, activeColor);
  const first = pieces[0];
  if (first === undefined) return null;

  let bestSq: Square = first;
  let bestGrid = squareToGrid(bestSq);

  for (let i = 1; i < pieces.length; i++) {
    const sq = pieces[i] as Square;
    const grid = squareToGrid(sq);

    let isBetter: boolean;
    if (activeColor === PC.White) {
      // White: lower row = more advanced
      isBetter = grid.row < bestGrid.row ||
        (grid.row === bestGrid.row && grid.col < bestGrid.col);
    } else {
      // Black: higher row = more advanced
      isBetter = grid.row > bestGrid.row ||
        (grid.row === bestGrid.row && grid.col < bestGrid.col);
    }

    if (isBetter) {
      bestSq = sq;
      bestGrid = grid;
    }
  }

  return bestSq;
}

export class ForcedMarchDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.ForcedMarch;
  }

  withInner(inner: RuleSet): ForcedMarchDecorator {
    return new ForcedMarchDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);
    if (innerMoves.length === 0) return innerMoves;

    const mostAdvanced = getMostAdvancedPieceSquare(board, activeColor);
    if (mostAdvanced === null) return innerMoves;

    const jumps = innerMoves.filter(m => m.captured.length > 0);

    if (jumps.length > 0) {
      // Mandatory capture applies — prefer most-advanced piece's jumps
      const advancedJumps = jumps.filter(m => (m.from as number) === (mostAdvanced as number));
      if (advancedJumps.length > 0) return advancedJumps;
      return jumps; // fallback: most advanced can't capture
    }

    // Simple moves only — prefer most-advanced piece
    const advancedSimples = innerMoves.filter(m => (m.from as number) === (mostAdvanced as number));
    if (advancedSimples.length > 0) return advancedSimples;
    return innerMoves; // fallback: most advanced is blocked
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.ForcedMarch,
  (base: RuleSet) => new ForcedMarchDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.ForcedMarch,
  () => undefined,
);
