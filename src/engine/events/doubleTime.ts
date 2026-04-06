/**
 * Double Time — production event decorator (Event 19).
 *
 * Each player takes two consecutive moves per turn. The first move is
 * normal. After the first move, the same player moves again before the
 * turn passes to the opponent. Mandatory capture applies independently
 * to each sub-move.
 *
 * Duration: 2 plies (1 round). Both players get one double turn.
 * Each double-move (two sub-moves) counts as a single ply for duration.
 *
 * Uses metadata `{ phase: 'first' | 'second' }` to track sub-move state.
 * Uses `requestSuppressTurnSwitch()` to prevent turn alternation and
 * event tick after the first sub-move.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent } from '../types';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** Metadata stored in ActiveEvent.metadata for Double Time. */
export interface DoubleTimeMetadata {
  readonly phase: 'first' | 'second';
}

export class DoubleTimeDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.DoubleTime;
  }

  withInner(inner: RuleSet): DoubleTimeDecorator {
    return new DoubleTimeDecorator(inner);
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    const result = super.onTurnEnd(board, activeColor, move);

    const entry = this.getActiveEntry(this.activeEventsContext);
    if (!entry) return result;

    const metadata = entry.metadata as unknown as DoubleTimeMetadata | undefined;
    if (metadata === undefined) return result;

    if (metadata.phase === 'first') {
      // First sub-move complete — suppress turn switch, advance to second phase
      this.requestSuppressTurnSwitch();
      this.requestMetadataUpdate(CrazyEvent.DoubleTime, { phase: 'second' });
    } else {
      // Second sub-move complete — reset to 'first' so the next player
      // also gets their double-move when their turn begins
      this.requestMetadataUpdate(CrazyEvent.DoubleTime, { phase: 'first' });
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.DoubleTime,
  (base: RuleSet) => new DoubleTimeDecorator(base),
);

// Register metadata factory: initialize with phase 'first'
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.DoubleTime,
  () => ({ phase: 'first' }),
);
