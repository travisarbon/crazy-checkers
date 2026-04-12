/**
 * PrincipalVariation — compact display of the engine's predicted best line.
 */

import { memo } from 'react';
import styles from './PrincipalVariation.module.css';

export interface PrincipalVariationProps {
  readonly pvNotation: readonly string[];
  readonly maxMoves?: number;
  readonly className?: string;
}

function PrincipalVariation({
  pvNotation,
  maxMoves = 5,
  className,
}: PrincipalVariationProps) {
  const truncated = pvNotation.slice(0, maxMoves);
  const hasMore = pvNotation.length > maxMoves;
  const label = `Principal variation: ${pvNotation.join(', ')}`;

  const rootClasses = [styles.root, className ?? ''].filter(Boolean).join(' ');

  if (truncated.length === 0) {
    return (
      <div
        className={rootClasses}
        aria-label="No principal variation available"
        data-testid="principal-variation-empty"
      >
        <span className={styles.label}>Best line:</span>
        <span className={styles.empty}>—</span>
      </div>
    );
  }

  return (
    <div
      className={rootClasses}
      aria-label={label}
      data-testid="principal-variation"
    >
      <span className={styles.label}>Best line:</span>
      <span className={styles.moves}>
        {truncated.map((notation, idx) => (
          <span
            key={`${notation}-${String(idx)}`}
            className={idx % 2 === 0 ? styles.whiteMove : styles.blackMove}
            data-testid={`pv-move-${String(idx)}`}
          >
            {notation}
          </span>
        ))}
        {hasMore && (
          <span className={styles.ellipsis} aria-hidden="true">
            …
          </span>
        )}
      </span>
    </div>
  );
}

export default memo(PrincipalVariation);
