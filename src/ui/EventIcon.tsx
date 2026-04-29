/**
 * P5.1, P5.5 — Per-event illustrated icon (Margin Notes only).
 *
 * Layered SVG: a 64×64 ink-on-paper icon with an 80×80 pencil
 * annotation overlay. The asset bundle (icon + annotation +
 * draw-on duration) is loaded lazily via the EventIconLoader
 * registered in `src/data/eventIcons/_index.ts`. Icons that
 * fail to load fall back to the event's text name.
 *
 * Consumers (EventReferencePanel, EventAnnouncement,
 * ActiveEventsIndicator) render this inside a wrapper that hides
 * it under non-Margin-Notes themes via the
 * `body[data-theme='margin-notes'] .event-icon-thumbnail` /
 * `body:not(...) .event-icon-thumbnail { display: none }` toggle
 * in `EventIcon.module.css`.
 */

import { useEffect, useState } from 'react';
import type { CrazyEvent } from '../engine/types';
import { EVENT_DISPLAY_NAMES } from '../engine/events';
import { EVENT_ICON_LOADERS } from '../data/eventIcons/_index';
import type { EventIconAsset } from '../data/eventData';
import styles from './EventIcon.module.css';

interface EventIconProps {
  readonly eventType: CrazyEvent;
  /** Pixel size of the icon (defaults to 48). */
  readonly size?: number;
  /** Optional className applied to the wrapper. */
  readonly className?: string;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'errored' }
  | { readonly kind: 'loaded'; readonly asset: EventIconAsset };

export default function EventIcon({ eventType, size = 48, className }: EventIconProps) {
  const [state, setState] = useState<LoadState>(() => {
    return EVENT_ICON_LOADERS[eventType] ? { kind: 'loading' } : { kind: 'errored' };
  });

  useEffect(() => {
    let cancelled = false;
    const loader = EVENT_ICON_LOADERS[eventType];
    if (!loader) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch keyed on prop; resetting to errored synchronously is the legitimate use of the effect.
      setState({ kind: 'errored' });
      return;
    }
    setState({ kind: 'loading' });
    loader()
      .then((loaded) => {
        if (!cancelled) setState({ kind: 'loaded', asset: loaded });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ kind: 'errored' });
          if (typeof console !== 'undefined') {
            console.warn(`[EventIcon] failed to load icon for ${eventType}:`, err);
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventType]);

  const fallbackText = EVENT_DISPLAY_NAMES[eventType];

  if (state.kind !== 'loaded') {
    return (
      <span
        className={[styles.wrapper ?? '', 'event-icon-thumbnail', className ?? '']
          .filter(Boolean)
          .join(' ')}
        style={{ width: size, height: size }}
        aria-label={fallbackText}
        data-event-type={eventType}
        data-loaded="false"
      >
        {state.kind === 'loading' && <span className={styles.placeholder} aria-hidden="true" />}
      </span>
    );
  }

  return (
    <span
      className={[styles.wrapper ?? '', 'event-icon-thumbnail', className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={{ width: size, height: size }}
      aria-label={fallbackText}
      data-event-type={eventType}
      data-loaded="true"
    >
      <span
        className={styles.iconLayer}
        dangerouslySetInnerHTML={{ __html: state.asset.icon }}
        aria-hidden="true"
      />
      <span
        className={styles.annotationLayer}
        dangerouslySetInnerHTML={{ __html: state.asset.annotation }}
        aria-hidden="true"
      />
    </span>
  );
}
