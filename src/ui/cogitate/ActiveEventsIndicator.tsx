/**
 * ActiveEventsIndicator (Cogitate) — shared event-state display for Replay,
 * Analysis, and Training tools. Renders compact event pills reflecting the
 * active events at the current position.
 */

import { memo } from 'react';
import type { SerializedActiveEvent } from '../../persistence/serialization';
import { EVENT_DISPLAY_NAMES } from '../../engine/events';
import styles from './ActiveEventsIndicator.module.css';

export interface ActiveEventsIndicatorProps {
  readonly events: readonly SerializedActiveEvent[];
  readonly gameMode: string;
  readonly compact?: boolean;
  readonly className?: string;
}

const PERMANENT_THRESHOLD = 9999;

function isPermanent(event: SerializedActiveEvent): boolean {
  return event.remainingPlies < 0 || event.remainingPlies > PERMANENT_THRESHOLD;
}

function formatDisplayName(type: string): string {
  const map = EVENT_DISPLAY_NAMES as Readonly<Record<string, string | undefined>>;
  return map[type] ?? type;
}

function formatDuration(event: SerializedActiveEvent, compact: boolean): string {
  if (isPermanent(event)) return 'permanent';
  if (event.remainingPlies <= 0) return '';
  const turns = Math.ceil(event.remainingPlies / 2);
  if (compact) return `${String(turns)}t`;
  return turns === 1 ? '1 turn left' : `${String(turns)} turns left`;
}

function ariaLabelFor(event: SerializedActiveEvent): string {
  const name = formatDisplayName(event.type);
  if (isPermanent(event)) return `${name}, permanent`;
  const turns = Math.ceil(event.remainingPlies / 2);
  return `${name}, ${String(turns)} turn${turns === 1 ? '' : 's'} remaining`;
}

function ActiveEventsIndicator({
  events,
  gameMode,
  compact = false,
  className,
}: ActiveEventsIndicatorProps) {
  if (gameMode === 'classic') return null;
  if (events.length === 0) return null;

  const classes = [
    styles.root,
    compact ? styles.compact : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
      aria-label="Active events"
      data-testid="cogitate-active-events"
    >
      {compact && <span className={styles.compactLabel}>Events:</span>}
      <ul className={styles.list}>
        {events.map((event, idx) => {
          const duration = formatDuration(event, compact);
          const permanent = isPermanent(event);
          const pillClass = [
            styles.pill,
            permanent ? styles.permanent : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li
              key={`${event.type}-${String(event.triggeredAtPly)}-${String(idx)}`}
              className={pillClass}
              aria-label={ariaLabelFor(event)}
              data-testid="cogitate-active-event-pill"
              data-permanent={permanent ? 'true' : 'false'}
            >
              <span className={styles.name}>{formatDisplayName(event.type)}</span>
              {duration && <span className={styles.duration}>{duration}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(ActiveEventsIndicator);
