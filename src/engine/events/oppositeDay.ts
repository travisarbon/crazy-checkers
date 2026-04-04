/**
 * Opposite Day — production event decorator.
 *
 * Inverts the win condition to anti-checkers for one full round (2 plies).
 * During Opposite Day:
 * - Losing all pieces = WIN (for the player who lost pieces).
 * - No legal moves = WIN (for the blocked player).
 * - Draws are unaffected.
 *
 * Stateless: no metadata required. The decorator reads its presence from
 * activeEventsContext via isActive().
 */

import type { BoardState, GameResult, PieceColor, RuleSet } from '../types';
import { CrazyEvent, GameResultType } from '../types';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

// ---------------------------------------------------------------------------
// Inversion utility
// ---------------------------------------------------------------------------

/**
 * Inverts the winner of a game result for anti-checkers (Opposite Day).
 *
 * WhiteWin → BlackWin, BlackWin → WhiteWin, Draw → Draw.
 * The reason field is preserved — only the interpretation changes.
 */
export function invertGameResult(result: GameResult): GameResult {
  switch (result.type) {
    case GameResultType.WhiteWin:
      return { type: GameResultType.BlackWin, reason: result.reason };
    case GameResultType.BlackWin:
      return { type: GameResultType.WhiteWin, reason: result.reason };
    default:
      return result; // Draw — unchanged
  }
}

// ---------------------------------------------------------------------------
// Decorator
// ---------------------------------------------------------------------------

export class OppositeDayDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.OppositeDay;
  }

  withInner(inner: RuleSet): OppositeDayDecorator {
    return new OppositeDayDecorator(inner);
  }

  /**
   * Inverts the game-over result when Opposite Day is active.
   *
   * Called by the game state machine after checkGameOver. If the base
   * result indicates a win for either player, the winner is swapped.
   * Draws and null (game not over) pass through unchanged.
   *
   * Does NOT invert twice when multiple Opposite Day entries are stacked —
   * isActive() returns true for any match, and the inversion is applied once.
   */
  override onCheckGameOver(
    board: BoardState,
    activeColor: PieceColor,
    baseResult: GameResult | null,
  ): GameResult | null {
    // Delegate to inner decorators first (they may also modify the result)
    const result = super.onCheckGameOver(board, activeColor, baseResult);

    // If Opposite Day is not active, pass through
    if (!this.isActive(this.activeEventsContext)) {
      return result;
    }

    // If no game-over condition, nothing to invert
    if (result === null) {
      return null;
    }

    // Invert the winner
    return invertGameResult(result);
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.OppositeDay,
  (base: RuleSet) => new OppositeDayDecorator(base),
);

// No metadata needed — register undefined-returning factory for consistency
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.OppositeDay,
  () => undefined,
);
