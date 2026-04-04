/**
 * Displays currently active Crazy mode events with names and remaining durations.
 *
 * Placed in the sidebar (desktop) or bottom panel (mobile) of GameScreen.
 * Returns null when no events are active.
 */

import type { ActiveEvent, PieceColor } from '../engine/types';
import { CrazyEvent, PieceColor as PC } from '../engine/types';
import { EVENT_DISPLAY_NAMES } from '../engine/events';
import styles from './ActiveEventsIndicator.module.css';

// ---------------------------------------------------------------------------
// Condition text for condition-based events
// ---------------------------------------------------------------------------

const EVENT_CONDITION_TEXT: Partial<Record<CrazyEvent, string>> = {
  [CrazyEvent.LiveGrenade]: 'Until next capture',
};

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

function formatDuration(event: ActiveEvent): string {
  if (event.remainingPlies === -1) {
    return EVENT_CONDITION_TEXT[event.type] ?? 'Condition';
  }
  if (event.remainingPlies <= 0) {
    return '';
  }
  const rounds = Math.ceil(event.remainingPlies / 2);
  return rounds === 1 ? '1 round' : `${String(rounds)} rounds`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActiveEventsIndicatorProps {
  activeEvents: readonly ActiveEvent[];
  activeColor: PieceColor;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActiveEventsIndicator({
  activeEvents,
}: ActiveEventsIndicatorProps) {
  // Filter out instant events (remainingPlies === 0) defensively
  const visibleEvents = activeEvents.filter((e) => e.remainingPlies !== 0);

  if (visibleEvents.length === 0) return null;

  return (
    <div className={styles.container} data-testid="active-events-indicator">
      <p className={styles.heading}>Active Events</p>
      {visibleEvents.map((event) => (
        <div
          key={`${event.type}-${String(event.triggeredAtPly)}`}
          className={styles.eventRow}
          data-testid="active-event-row"
        >
          <span
            className={`${styles.colorDot ?? ''} ${event.triggeredBy === PC.White ? (styles.white ?? '') : (styles.black ?? '')}`}
            aria-label={`Triggered by ${event.triggeredBy === PC.White ? 'White' : 'Black'}`}
          />
          <span className={styles.eventName}>{EVENT_DISPLAY_NAMES[event.type]}</span>
          <span className={styles.durationBadge}>{formatDuration(event)}</span>
        </div>
      ))}
    </div>
  );
}
