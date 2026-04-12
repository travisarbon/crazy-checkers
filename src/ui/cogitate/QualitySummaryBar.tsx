/**
 * QualitySummaryBar — colored segment bar showing per-move quality across a game.
 */

import { memo, useMemo } from 'react';
import type { MoveQuality } from '../../cogitate/types';
import styles from './QualitySummaryBar.module.css';

export interface QualitySummaryBarProps {
  readonly qualities: readonly (MoveQuality | null)[];
  readonly qualityScore?: number;
  readonly selectedPly?: number;
  readonly onPlySelect?: (ply: number) => void;
  readonly className?: string;
}

const SEGMENT_CLASS: Record<MoveQuality, string> = {
  brilliant: styles.segmentBrilliant ?? '',
  good: styles.segmentGood ?? '',
  inaccuracy: styles.segmentInaccuracy ?? '',
  mistake: styles.segmentMistake ?? '',
  blunder: styles.segmentBlunder ?? '',
};

const QUALITY_LABEL: Record<MoveQuality, string> = {
  brilliant: 'Brilliant',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

function countQualities(
  qualities: readonly (MoveQuality | null)[],
): Record<MoveQuality, number> {
  const counts: Record<MoveQuality, number> = {
    brilliant: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
  for (const q of qualities) {
    if (q) counts[q] += 1;
  }
  return counts;
}

function QualitySummaryBar({
  qualities,
  qualityScore,
  selectedPly,
  onPlySelect,
  className,
}: QualitySummaryBarProps) {
  const counts = useMemo(() => countQualities(qualities), [qualities]);
  const ariaLabel = `Game quality summary: ${String(counts.brilliant)} brilliant, ${String(counts.good)} good, ${String(counts.inaccuracy)} inaccuracy, ${String(counts.mistake)} mistake, ${String(counts.blunder)} blunder`;

  const rootClasses = [styles.root, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={rootClasses} data-testid="quality-summary-bar">
      <div
        className={styles.bar}
        role="img"
        aria-label={ariaLabel}
        data-testid="quality-summary-segments"
      >
        {qualities.map((q, idx) => {
          const segmentClass = [
            styles.segment ?? '',
            q ? SEGMENT_CLASS[q] : (styles.segmentPending ?? ''),
            selectedPly === idx ? (styles.segmentSelected ?? '') : '',
          ]
            .filter(Boolean)
            .join(' ');
          const title = q
            ? `Move ${String(idx + 1)}: ${QUALITY_LABEL[q]}`
            : `Move ${String(idx + 1)}: not analyzed`;
          if (onPlySelect) {
            return (
              <button
                key={idx}
                type="button"
                className={segmentClass}
                aria-label={title}
                title={title}
                onClick={() => { onPlySelect(idx); }}
                data-testid={`quality-summary-segment-${String(idx)}`}
                data-quality={q ?? 'pending'}
              />
            );
          }
          return (
            <span
              key={idx}
              className={segmentClass}
              title={title}
              data-testid={`quality-summary-segment-${String(idx)}`}
              data-quality={q ?? 'pending'}
            />
          );
        })}
      </div>
      {qualityScore !== undefined && (
        <span
          className={styles.score}
          data-testid="quality-summary-score"
          aria-label={`Quality score ${String(Math.round(qualityScore))} out of 100`}
        >
          {String(Math.round(qualityScore))}/100
        </span>
      )}
    </div>
  );
}

export default memo(QualitySummaryBar);
