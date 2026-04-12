/**
 * TrainingProgressBar — visualises progress through the Training position queue.
 *
 * Each segment is coloured by per-position attempt result: pending, current,
 * correct, acceptable, incorrect, or skipped. Displays completion counter and
 * accuracy alongside an optional streak indicator.
 */

import { memo } from 'react';
import type {
  TrainingAttemptResult,
  TrainingSessionStats,
} from '../../cogitate/trainingEngine';
import styles from './TrainingProgressBar.module.css';

export interface TrainingProgressBarProps {
  readonly stats: TrainingSessionStats;
  readonly results: readonly (TrainingAttemptResult | null)[];
  readonly skippedIndexes: ReadonlySet<number>;
  readonly currentIndex: number;
  readonly className?: string;
}

type SegmentState =
  | 'pending'
  | 'current'
  | 'correct'
  | 'acceptable'
  | 'incorrect'
  | 'skipped';

function segmentStateFor(
  idx: number,
  currentIndex: number,
  result: TrainingAttemptResult | null,
  skipped: boolean,
): SegmentState {
  if (skipped) return 'skipped';
  if (result) {
    if (result.isCorrect) return 'correct';
    if (result.isAcceptable) return 'acceptable';
    return 'incorrect';
  }
  if (idx === currentIndex) return 'current';
  return 'pending';
}

const SEGMENT_CLASS: Record<SegmentState, string> = {
  pending: '',
  current: styles.current ?? '',
  correct: styles.correct ?? '',
  acceptable: styles.acceptable ?? '',
  incorrect: styles.incorrect ?? '',
  skipped: styles.skipped ?? '',
};

function TrainingProgressBar({
  stats,
  results,
  skippedIndexes,
  currentIndex,
  className,
}: TrainingProgressBarProps) {
  const rootClasses = [styles.root, className ?? ''].filter(Boolean).join(' ');
  const label = `Training progress: ${String(stats.completedPositions)} of ${String(stats.totalPositions)} positions completed, ${String(stats.accuracy)}% accuracy`;

  return (
    <div className={rootClasses} data-testid="training-progress-bar">
      <div
        className={styles.segments}
        role="progressbar"
        aria-label={label}
        aria-valuenow={stats.completedPositions}
        aria-valuemin={0}
        aria-valuemax={stats.totalPositions}
      >
        {Array.from({ length: stats.totalPositions }, (_, idx) => {
          const state = segmentStateFor(
            idx,
            currentIndex,
            results[idx] ?? null,
            skippedIndexes.has(idx),
          );
          const segmentClass = [styles.segment, SEGMENT_CLASS[state]]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={`seg-${String(idx)}`}
              className={segmentClass}
              data-testid={`training-progress-segment-${String(idx)}`}
              data-state={state}
            />
          );
        })}
      </div>
      <div className={styles.meta}>
        <span data-testid="training-progress-counter">
          {String(stats.completedPositions)}/{String(stats.totalPositions)}
        </span>
        <span data-testid="training-progress-accuracy">
          Acc: {String(stats.accuracy)}%
        </span>
        {stats.currentStreak > 0 && (
          <span className={styles.streak} data-testid="training-progress-streak">
            🔥 Streak: {String(stats.currentStreak)}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(TrainingProgressBar);
