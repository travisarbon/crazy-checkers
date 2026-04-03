/**
 * Animated thinking dots indicator — renders three pulsing dots
 * to signal AI computation in progress.
 */

import styles from './ThinkingIndicator.module.css';

interface ThinkingIndicatorProps {
  isThinking: boolean;
}

export default function ThinkingIndicator({ isThinking }: ThinkingIndicatorProps) {
  if (!isThinking) return null;

  return (
    <span className={styles.dots} aria-hidden="true" data-testid="thinking-dots">
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </span>
  );
}
