/**
 * EvaluationBar — persistent display of the engine's position assessment.
 *
 * Used by Replay, Analysis, and Free Play Cogitate tools.
 */

import { memo, useMemo } from 'react';
import type { NormalizedEvaluation } from '../cogitate/types';
import styles from './EvaluationBar.module.css';

export type EvaluationBarState = 'loading' | 'evaluated' | 'unavailable' | 'error';

export interface EvaluationBarProps {
  score: NormalizedEvaluation | null;
  orientation?: 'vertical' | 'horizontal';
  state?: EvaluationBarState;
  className?: string;
}

const MINUS_SIGN = '\u2212';

// eslint-disable-next-line react-refresh/only-export-components
export function formatEvaluationScore(score: number): string {
  const clamped = Math.max(-1, Math.min(1, score));
  const rounded = Math.round(clamped * 10) / 10;
  const abs = Math.abs(rounded).toFixed(1);
  if (rounded === 0) return '0.0';
  return rounded > 0 ? `+${abs}` : `${MINUS_SIGN}${abs}`;
}

function whiteFillPercent(score: number): number {
  const clamped = Math.max(-1, Math.min(1, score));
  return ((clamped + 1) / 2) * 100;
}

function ariaAnnouncement(score: number): string {
  const v = Math.abs(Math.round(score * 10) / 10).toFixed(1);
  if (score > 0) return `Evaluation: White plus ${v}`;
  if (score < 0) return `Evaluation: Black plus ${v}`;
  return 'Evaluation: equal';
}

function EvaluationBar({
  score,
  orientation = 'vertical',
  state,
  className,
}: EvaluationBarProps) {
  const resolvedState: EvaluationBarState = useMemo(() => {
    if (state) return state;
    if (score === null) return 'loading';
    return 'evaluated';
  }, [state, score]);

  const fillPercent = score === null ? 50 : whiteFillPercent(score.score);
  const label =
    resolvedState === 'loading'
      ? 'Analyzing...'
      : resolvedState === 'unavailable'
        ? 'N/A'
        : resolvedState === 'error'
          ? 'Error'
          : score !== null
            ? formatEvaluationScore(score.score)
            : '';

  const classes = [
    styles.root,
    orientation === 'horizontal' ? styles.horizontal : styles.vertical,
    resolvedState === 'loading' ? styles.loading : '',
    resolvedState === 'unavailable' ? styles.unavailable : '',
    resolvedState === 'error' ? styles.error : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const fillStyle =
    orientation === 'horizontal'
      ? { width: `${String(fillPercent)}%`, height: '100%' }
      : { width: '100%', height: `${String(fillPercent)}%` };

  const restStyle =
    orientation === 'horizontal'
      ? { width: `${String(100 - fillPercent)}%`, height: '100%' }
      : { width: '100%', height: `${String(100 - fillPercent)}%` };

  return (
    <div
      className={classes}
      role="meter"
      aria-valuenow={score === null ? 0 : Math.max(-1, Math.min(1, score.score))}
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-label="Position evaluation"
      data-testid="evaluation-bar"
      data-state={resolvedState}
      data-orientation={orientation}
    >
      {resolvedState === 'evaluated' && (
        <>
          <div
            className={styles.fill}
            style={fillStyle}
            data-testid="evaluation-bar-fill"
          />
          <div className={styles.rest} style={restStyle} />
        </>
      )}
      {label && (
        <span className={styles.label} data-testid="evaluation-bar-label">
          {label}
        </span>
      )}
      <span className={styles.liveRegion} aria-live="polite">
        {resolvedState === 'evaluated' && score !== null
          ? ariaAnnouncement(score.score)
          : ''}
      </span>
    </div>
  );
}

export default memo(EvaluationBar);
