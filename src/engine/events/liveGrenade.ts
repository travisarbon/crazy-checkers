/**
 * Live Grenade — production event decorator.
 *
 * The next capture by either player causes an explosion: all pieces
 * (friendly and enemy) on squares diagonally adjacent to the landing
 * square are destroyed. The landing piece survives.
 *
 * Condition-based event (remainingPlies: -1) — consumed after one detonation.
 * Stateless: armed status derived from activeEventsContext, not instance fields.
 */

import type { BoardState, RuleSet, Square, SquareState } from '../types';
import { CrazyEvent } from '../types';
import { getAllAdjacentSquares } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns a new board with all pieces on squares diagonally adjacent to
 * the given square removed (set to null). The piece on the center square
 * itself is NOT removed.
 *
 * Pure function — no side effects.
 */
export function explodeAdjacentPieces(board: BoardState, centerSquare: Square): BoardState {
  const newBoard = [...board] as SquareState[];
  const neighbors = getAllAdjacentSquares(centerSquare);

  for (const { adjacent } of neighbors) {
    const index = (adjacent as number) - 1;
    newBoard[index] = null;
  }

  return newBoard;
}

export class LiveGrenadeDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.LiveGrenade;
  }

  withInner(inner: RuleSet): LiveGrenadeDecorator {
    return new LiveGrenadeDecorator(inner);
  }

  override onCapture(board: BoardState, landingSquare: Square, captured: Square[]): BoardState {
    // Delegate to inner first (chain order)
    const result = super.onCapture(board, landingSquare, captured);

    // BOOM: destroy all pieces adjacent to the landing square
    const explodedBoard = explodeAdjacentPieces(result, landingSquare);

    // Signal that this event should be removed (condition met) —
    // but NOT if the event is a permanent Choice mode event.
    const isPermanent = this.activeEventsContext.some(
      e => e.type === CrazyEvent.LiveGrenade && e.permanent === true,
    );
    if (!isPermanent) {
      this.requestEventRemoval(CrazyEvent.LiveGrenade);
    }

    return explodedBoard;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.LiveGrenade,
  (base: RuleSet) => new LiveGrenadeDecorator(base),
);

// No metadata needed — register undefined-returning factory for consistency
// (pattern established in Task 9.2; see Task_9.2_Opposite_Day_Implementation_Plan.md §2.1)
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.LiveGrenade,
  () => undefined,
);
