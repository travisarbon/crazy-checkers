/**
 * Reinforcements — production event decorator (Event 23).
 *
 * Instant event (duration 0). Each player receives up to 2 new pawns,
 * placed on empty squares in their back row. Players cannot exceed
 * 12 total pieces on the board. Fires in onTurnStart.
 *
 * Stateless: seed stored in metadata for deterministic consistency.
 */

import type { BoardState, RuleSet, Square } from '../types';
import { CrazyEvent, PieceColor, PieceType } from '../types';
import { getBoardSquare, getSquaresWithColor, isPromotionSquare, setBoardSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** White's back row (starting row). */
export const WHITE_BACK_ROW: readonly number[] = [29, 30, 31, 32];

/** Black's back row (starting row). */
export const BLACK_BACK_ROW: readonly number[] = [1, 2, 3, 4];

export class ReinforcementsDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Reinforcements;
  }

  withInner(inner: RuleSet): ReinforcementsDecorator {
    return new ReinforcementsDecorator(inner);
  }

  override onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    let result = super.onTurnStart(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) {
      return result;
    }

    for (const color of [PieceColor.White, PieceColor.Black]) {
      const currentCount = getSquaresWithColor(result, color).length;
      const maxReinforcements = Math.min(2, 12 - currentCount);
      if (maxReinforcements <= 0) continue;

      const backRow = color === PieceColor.White ? WHITE_BACK_ROW : BLACK_BACK_ROW;
      let placed = 0;
      for (const sq of backRow) {
        if (placed >= maxReinforcements) break;
        if (getBoardSquare(result, sq as Square) !== null) continue;
        const type = isPromotionSquare(sq as Square, color) ? PieceType.King : PieceType.Pawn;
        result = setBoardSquare(result, sq as Square, { color, type });
        placed++;
      }
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Reinforcements,
  (base: RuleSet) => new ReinforcementsDecorator(base),
);

// Register metadata factory (seed for consistency, unused in current algorithm)
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Reinforcements,
  (_board, _activeColor, randomFn) => ({
    seed: Math.floor((randomFn?.() ?? Math.random()) * 0xffffffff),
  }),
);
