/**
 * Before/after event visualization using BoardPreviewLarge.
 * Renders one or two board previews with event metadata and annotations.
 */

import BoardPreviewLarge from './BoardPreviewLarge';
import { EVENT_DISPLAY_NAMES, EVENT_FLAVOR_TEXT } from '../engine/events';
import type { CrazyEvent } from '../engine/types';
import type { BoardState } from '../engine/types';
import styles from './EventDiagram.module.css';

export interface EventAnnotation {
  square: number;
  text: string;
  side: 'before' | 'after' | 'both';
}

export interface EventDiagramProps {
  eventType: CrazyEvent;
  beforePosition: BoardState;
  afterPosition?: BoardState;
  highlightSquares?: number[];
  annotations?: EventAnnotation[];
  size?: number;
}

export default function EventDiagram({
  eventType,
  beforePosition,
  afterPosition,
  highlightSquares = [],
  annotations = [],
  size = 160,
}: EventDiagramProps) {
  const eventName = EVENT_DISPLAY_NAMES[eventType];
  const flavorText = EVENT_FLAVOR_TEXT[eventType];

  const beforeAnnotations = annotations.filter(
    (a) => a.side === 'before' || a.side === 'both',
  );
  const afterAnnotations = annotations.filter(
    (a) => a.side === 'after' || a.side === 'both',
  );

  const diagramLabel = afterPosition
    ? `Diagram showing ${eventName} event: before and after`
    : `Diagram showing ${eventName} event`;

  return (
    <div
      className={styles.diagram}
      role="figure"
      aria-label={diagramLabel}
      data-testid="event-diagram"
    >
      <div className={styles.eventHeader}>
        <h3 className={styles.eventName}>{eventName}</h3>
        <p className={styles.flavorText}>{flavorText}</p>
      </div>

      <div className={styles.boardRow}>
        <div className={styles.boardColumn}>
          {afterPosition && <span className={styles.boardLabel}>Before</span>}
          <div className={styles.boardWrapper}>
            <BoardPreviewLarge
              position={beforePosition}
              size={size}
              highlightSquares={highlightSquares}
              label={afterPosition ? `Board before ${eventName}` : `Board showing ${eventName}`}
            />
            {beforeAnnotations.map((a) => (
              <span
                key={`before-${String(a.square)}-${a.text}`}
                className={styles.annotation}
                data-testid={`annotation-before-${String(a.square)}`}
              >
                {a.text}
              </span>
            ))}
          </div>
        </div>

        {afterPosition && (
          <>
            <span className={styles.arrow} aria-hidden="true">&rarr;</span>
            <div className={styles.boardColumn}>
              <span className={styles.boardLabel}>After</span>
              <div className={styles.boardWrapper}>
                <BoardPreviewLarge
                  position={afterPosition}
                  size={size}
                  highlightSquares={highlightSquares}
                  label={`Board after ${eventName}`}
                />
                {afterAnnotations.map((a) => (
                  <span
                    key={`after-${String(a.square)}-${a.text}`}
                    className={styles.annotation}
                    data-testid={`annotation-after-${String(a.square)}`}
                  >
                    {a.text}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
