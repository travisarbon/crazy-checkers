/**
 * Event announcement overlay displayed when a new Crazy mode event triggers.
 *
 * Shows the event name and flavor text, then auto-dismisses after animations
 * complete and a minimum display time has elapsed. Clicking or tapping
 * anywhere dismisses immediately.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ActiveEvent } from '../engine/types';
import { EVENT_DISPLAY_NAMES, EVENT_FLAVOR_TEXT } from '../engine/events';
import styles from './EventAnnouncement.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum time the announcement stays visible (ms). */
const MIN_DISPLAY_MS = 1500;

/** Auto-dismiss delay after all conditions are met (ms). */
const DEFAULT_DISMISS_DELAY = 2000;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EventAnnouncementProps {
  /** The newly triggered event(s) to announce. */
  events: readonly ActiveEvent[];
  /** Called when the announcement completes (auto-dismiss or user click). */
  onDismiss: () => void;
  /** Whether an animation is currently playing on the board. */
  isAnimating?: boolean;
  /** Auto-dismiss delay in milliseconds. Default: 2000. */
  dismissDelay?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventAnnouncement({
  events,
  onDismiss,
  isAnimating = false,
  dismissDelay = DEFAULT_DISMISS_DELAY,
}: EventAnnouncementProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);
  const [mountedAt] = useState(() => Date.now());
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  const handleDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onDismiss();
  }, [onDismiss]);

  // Track minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_DISPLAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Auto-dismiss: start countdown only when animation is done AND min time has elapsed
  useEffect(() => {
    if (isAnimating || !minTimeElapsed) return;

    // Calculate remaining dismiss delay after min display time
    const elapsed = Date.now() - mountedAt;
    const remaining = Math.max(0, dismissDelay - elapsed);

    timerRef.current = setTimeout(handleDismiss, remaining);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAnimating, minTimeElapsed, handleDismiss, dismissDelay, mountedAt]);

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
