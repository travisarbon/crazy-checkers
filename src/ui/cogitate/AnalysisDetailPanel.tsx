/**
 * AnalysisDetailPanel — per-move analysis readout.
 */

import { memo } from 'react';
import type { AnalysisResult, MoveQuality } from '../../cogitate/types';
import { formatEvaluationScore } from '../EvaluationBar';
import PrincipalVariation from './PrincipalVariation';
import styles from './AnalysisDetailPanel.module.css';

export interface AnalysisDetailPanelProps {
  readonly result: AnalysisResult | null;
  readonly plyIndex: number;
  readonly playedMoveNotation: string;
  readonly isAnalyzing: boolean;
  readonly onDeepAnalyze?: () => void;
  readonly deepAnalyzeAvailable?: boolean;
  /** Whether a deep analysis is currently running for this panel. */
  readonly isDeepAnalyzing?: boolean;
  readonly className?: string;
}

const QUALITY_SYMBOL: Record<MoveQuality, string> = {
  brilliant: '☆',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

const QUALITY_LABEL: Record<MoveQuality, string> = {
  brilliant: 'Brilliant',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

const QUALITY_CLASS: Record<MoveQuality, string> = {
  brilliant: styles.badgeBrilliant ?? '',
  good: styles.badgeGood ?? '',
  inaccuracy: styles.badgeInaccuracy ?? '',
  mistake: styles.badgeMistake ?? '',
  blunder: styles.badgeBlunder ?? '',
};

function AnalysisDetailPanel({
  result,
  plyIndex,
  playedMoveNotation,
  isAnalyzing,
  onDeepAnalyze,
  deepAnalyzeAvailable = true,
  isDeepAnalyzing = false,
  className,
}: AnalysisDetailPanelProps) {
  const moveNumber = Math.floor(plyIndex / 2) + 1;
  const rootClasses = [styles.root, className ?? ''].filter(Boolean).join(' ');

  if (!result) {
    return (
      <section
        className={rootClasses}
        role="region"
        aria-label={`Analysis details for move ${String(moveNumber)}`}
        data-testid="analysis-detail-panel"
      >
        {isAnalyzing ? (
          <p className={styles.status} data-testid="analysis-detail-analyzing">
            Analyzing position…
          </p>
        ) : (
          <p className={styles.status} data-testid="analysis-detail-empty">
            Select a move to see analysis details.
          </p>
        )}
      </section>
    );
  }

  const quality = result.moveQuality;
  const showEvalDrop =
    quality === 'inaccuracy' || quality === 'mistake' || quality === 'blunder';
  const bestDiffers =
    result.bestMoveNotation.length > 0 &&
    result.bestMoveNotation !== playedMoveNotation;

  return (
    <section
      className={rootClasses}
      role="region"
      aria-label={`Analysis details for move ${String(moveNumber)}`}
      data-testid="analysis-detail-panel"
    >
      <header className={styles.header}>
        <h3 className={styles.title}>
          Move {String(moveNumber)}: <span className={styles.notation}>{playedMoveNotation}</span>
        </h3>
        {quality && (
          <span
            className={[styles.badge, QUALITY_CLASS[quality]].filter(Boolean).join(' ')}
            aria-label={QUALITY_LABEL[quality]}
            data-testid={`analysis-detail-badge-${quality}`}
          >
            <span aria-hidden="true">{QUALITY_SYMBOL[quality]}</span>
            {' '}
            {QUALITY_LABEL[quality]}
          </span>
        )}
      </header>

      <dl className={styles.stats}>
        <div>
          <dt>Evaluation</dt>
          <dd data-testid="analysis-detail-eval">
            {formatEvaluationScore(result.evaluation)}
          </dd>
        </div>
        {showEvalDrop && result.evalDrop !== undefined && (
          <div>
            <dt>Eval drop</dt>
            <dd
              className={quality === 'blunder' ? styles.evalDropBlunder : ''}
              data-testid="analysis-detail-drop"
            >
              −{result.evalDrop.toFixed(2)}
            </dd>
          </div>
        )}
        {bestDiffers && (
          <div>
            <dt>Engine best</dt>
            <dd data-testid="analysis-detail-best">{result.bestMoveNotation}</dd>
          </div>
        )}
        <div>
          <dt>Depth</dt>
          <dd data-testid="analysis-detail-depth">{String(result.depth)}</dd>
        </div>
      </dl>

      <PrincipalVariation pvNotation={result.pvNotation} />

      {result.alternativeMoves.length > 1 && (
        <div className={styles.alternatives} data-testid="analysis-detail-alternatives">
          <h4 className={styles.sectionHeading}>Alternatives</h4>
          <ul>
            {result.alternativeMoves.slice(1, 4).map((alt, idx) => (
              <li key={`${alt.notation}-${String(idx)}`}>
                <span className={styles.altNotation}>{alt.notation}</span>
                <span className={styles.altScore}>
                  {formatEvaluationScore(alt.normalizedScore)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onDeepAnalyze && (
        <button
          type="button"
          className={styles.deepAnalyzeButton}
          onClick={onDeepAnalyze}
          disabled={!deepAnalyzeAvailable || isDeepAnalyzing}
          aria-busy={isDeepAnalyzing}
          data-testid="analysis-detail-deep-analyze"
        >
          {isDeepAnalyzing ? 'Deep Analyzing…' : 'Deep Analyze'}
        </button>
      )}
    </section>
  );
}

export default memo(AnalysisDetailPanel);
