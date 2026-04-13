/**
 * Visual progress bar with milestone waypoints.
 * Used by CareerScreen and ChallengeScreen for progression tracking.
 */

import styles from './ProgressTracker.module.css';

export interface Milestone {
  name: string;
  threshold: number;
  completed: boolean;
  /** Optional tooltip text shown on hover (e.g. milestone description). */
  tooltip?: string;
}

export interface ProgressTrackerProps {
  trackName: string;
  milestones: Milestone[];
  currentValue: number;
  maxValue: number;
  accentColor?: string;
}

export default function ProgressTracker({
  trackName,
  milestones,
  currentValue,
  maxValue,
  accentColor,
}: ProgressTrackerProps) {
  // Clamp to [0, 100] so over-achievement (e.g. 101 completed / 100 required)
  // still reads cleanly as "100%" rather than "101%".
  const rawPercentage =
    maxValue > 0 ? Math.round((currentValue / maxValue) * 100) : 0;
  const percentage = Math.min(100, Math.max(0, rawPercentage));
  const fillColor = accentColor ?? 'var(--ui-accent)';

  return (
    <div className={styles.tracker} data-testid="progress-tracker">
      <h3 className={styles.trackName}>{trackName}</h3>

      <div className={styles.barContainer}>
        <div
          className={styles.barFill}
          style={{ width: `${String(percentage)}%`, backgroundColor: fillColor }}
          role="progressbar"
          aria-valuenow={Math.min(currentValue, maxValue)}
          aria-valuemin={0}
          aria-valuemax={maxValue}
          aria-label={trackName}
        />
      </div>

      <div className={styles.percentLabel}>{percentage}%</div>

      <div className={styles.milestones}>
        {milestones.map((m) => (
          <div
            key={m.name}
            className={m.completed ? styles.milestoneComplete : styles.milestoneIncomplete}
            aria-label={`${m.name}: ${m.completed ? 'completed' : 'not yet reached'}`}
            title={m.tooltip ?? m.name}
          >
            <span className={styles.milestoneMarker}>
              {m.completed ? '✓' : '○'}
            </span>
            <span className={styles.milestoneName} title={m.tooltip ?? m.name}>{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
