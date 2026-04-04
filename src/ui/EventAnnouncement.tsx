/**
 * Event announcement overlay displayed when a new Crazy mode event triggers.
 *
 * Shows the event name and flavor text, then auto-dismisses after a delay.
 * Clicking or tapping anywhere dismisses immediately.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ActiveEvent } from '../engine/types';
import { EVENT_DISPLAY_NAMES, EVENT_FLAVOR_TEXT } from '../engine/events';
import styles from './EventAnnouncement.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EventAnnouncementProps {
  /** The newly triggered event(s) to announce. */
  events: readonly ActiveEvent[];
  /** Called when the announcement completes (auto-dismiss or user click). */
  onDismiss: () => void;
  /** Auto-dismiss delay in milliseconds. Default: 2000. */
  dismissDelay?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventAnnouncement({
  events,
  onDismiss,
  dismissDelay = 2000,
}: EventAnnouncementProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);

  const handleDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(handleDismiss, dismissDelay);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [handleDismiss, dismissDelay]);

  return (
    <div
      className={styles.overlay}
      role="alert"
      aria-live="assertive"
      onClick={handleDismiss}
      data-testid="event-announcement"
    >
      <div className={styles.content}>
        {events.map((event, index) => (
          <div key={`${event.type}-${String(event.triggeredAtPly)}`} className={styles.eventBlock}>
            {index > 0 && <hr />}
            <p className={styles.eventName} data-testid="event-announcement-name">
              {EVENT_DISPLAY_NAMES[event.type]}
            </p>
            <p className={styles.eventFlavor} data-testid="event-announcement-flavor">
              {EVENT_FLAVOR_TEXT[event.type]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
