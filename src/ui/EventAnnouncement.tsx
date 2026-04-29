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
import EventIcon from './EventIcon';
import styles from './EventAnnouncement.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum time the announcement stays visible (ms). */
const MIN_DISPLAY_MS = 1500;

/** Auto-dismiss delay after all conditions are met (ms). */
const DEFAULT_DISMISS_DELAY = 2000;

/** Extended dismiss delay for Double Trouble (ms). */
const DOUBLE_TROUBLE_DISMISS_DELAY = 3500;

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
  dismissDelay,
}: EventAnnouncementProps) {
  const isDoubleTrouble = events.length >= 2;
  const effectiveDismissDelay = dismissDelay ?? (isDoubleTrouble ? DOUBLE_TROUBLE_DISMISS_DELAY : DEFAULT_DISMISS_DELAY);
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
    const remaining = Math.max(0, effectiveDismissDelay - elapsed);

    timerRef.current = setTimeout(handleDismiss, remaining);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAnimating, minTimeElapsed, handleDismiss, effectiveDismissDelay, mountedAt]);

  return (
    <div
      className={`${styles.overlay ?? ''} event-announcement`}
      role="alert"
      aria-live="assertive"
      onClick={handleDismiss}
      data-testid="event-announcement"
    >
      <div className={styles.content}>
        {isDoubleTrouble && (
          <p className={styles.doubleTroubleTitle} data-testid="double-trouble-title">
            DOUBLE TROUBLE!
          </p>
        )}
        {events.map((event, index) => (
          <div key={`${event.type}-${String(event.triggeredAtPly)}`} className={styles.eventBlock}>
            {index > 0 && <hr />}
            {/* P5.5 — illustrated icon above the event name. Margin Notes only;
                the EventIcon CSS hides the thumbnail under other themes. */}
            <EventIcon eventType={event.type} size={80} />
            <p className={`${styles.eventName ?? ''} event-announcement-name`} data-testid="event-announcement-name">
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
