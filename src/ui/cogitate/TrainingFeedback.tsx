/**
 * TrainingFeedback — post-move comparison panel.
 *
 * Shows a verdict (correct / acceptable / incorrect), the player's move
 * vs. the engine's best move with evaluations, the eval difference, the
 * best-line PV, alternatives, and original position context.
 */

import { memo } from 'react';
import type {
  TrainingAttemptResult,
  TrainingPosition,
} from '../../cogitate/trainingEngine';
import { formatEvaluationScore } from '../EvaluationBar';
import PrincipalVariation from './PrincipalVariation';
import styles from './TrainingFeedback.module.css';

export interface TrainingFeedbackProps {
  readonly result: TrainingAttemptResult;
  readonly position: TrainingPosition;
  readonly positionIndex: number;
  readonly className?: string;
}

type Verdict = 'correct' | 'acceptable' | 'incorrect';

function resolveVerdict(result: TrainingAttemptResult): Verdict {
  if (result.isCorrect) return 'correct';
  if (result.isAcceptable) return 'acceptable';
  return 'incorrect';
}

const VERDICT_ICON: Record<Verdict, string> = {
  correct: '✓',
  acceptable: '≈',
  incorrect: '✗',
};

const VERDICT_LABEL: Record<Verdict, string> = {
  correct: 'Correct!',
  acceptable: 'Good enough!',
  incorrect: 'Not quite',
};

const VERDICT_CLASS: Record<Verdict, string> = {
  correct: styles.correct ?? '',
  acceptable: styles.acceptable ?? '',
  incorrect: styles.incorrect ?? '',
};

function TrainingFeedback({
  result,
  position,
  positionIndex,
  className,
}: TrainingFeedbackProps) {
  const verdict = resolveVerdict(result);
  const showEvalDiff = !result.isCorrect;
  const bestDiffers = !result.isCorrect && result.bestMoveNotation.length > 0;

  const rootClasses = [styles.root, VERDICT_CLASS[verdict], className ?? '']
    .filter(Boolean)
    .join(' ');

  const playerAltIdx = result.alternatives.findIndex(
    (a) => a.notation === result.playerMoveNotation,
  );
  const topAlternatives = result.alternatives.slice(0, 3);

  return (
    <section
      className={rootClasses}
      role="region"
      aria-label={`Training feedback for position ${String(positionIndex + 1)}`}
      data-testid="training-feedback"
      data-verdict={verdict}
    >
      <header className={styles.verdict}>
        <span aria-hidden="true" className={styles.verdictIcon}>
          {VERDICT_ICON[verdict]}
        </span>
        <span data-testid="training-feedback-verdict">{VERDICT_LABEL[verdict]}</span>
      </header>

      <div className={styles.comparison}>
        <span className={styles.label}>Your move</span>
        <span className={styles.notation} data-testid="training-feedback-player-move">
          {result.playerMoveNotation}
        </span>
        <span className={styles.score}>
          {formatEvaluationScore(result.playerMoveEval.score)}
        </span>

        {bestDiffers && (
          <>
            <span className={styles.label}>Best move</span>
            <span className={styles.notation} data-testid="training-feedback-best-move">
              {result.bestMoveNotation}
            </span>
            <span className={styles.score}>
              {formatEvaluationScore(result.bestMoveEval.score)}
            </span>
          </>
        )}
      </div>

      {showEvalDiff && (
        <p className={styles.diffRow} data-testid="training-feedback-diff">
          Evaluation difference: −{result.evalDifference.toFixed(2)}
        </p>
      )}

      <PrincipalVariation pvNotation={result.bestMovePV} />

      {topAlternatives.length > 1 && (
        <div
          className={styles.alternatives}
          data-testid="training-feedback-alternatives"
        >
          <h4 className={styles.alternativesHeading}>Alternatives</h4>
          {topAlternatives.map((alt, idx) => {
            const isPlayerAlt = idx === playerAltIdx;
            const itemClasses = [
              styles.alternativeItem,
              isPlayerAlt ? styles.highlightPlayerAlt : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                key={`${alt.notation}-${String(idx)}`}
                className={itemClasses}
                data-testid={`training-feedback-alt-${String(idx)}`}
              >
                <span className={styles.altNotation}>
                  {alt.notation}
                  {isPlayerAlt ? ' (you)' : ''}
                </span>
                <span className={styles.altScore}>
                  {formatEvaluationScore(alt.normalizedScore)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className={styles.context} data-testid="training-feedback-context">
        In the original game, {position.originalMoveQuality ?? 'a suboptimal move'} was
        played here (eval drop: {position.originalEvalDrop.toFixed(2)}).
      </p>
    </section>
  );
}

export default memo(TrainingFeedback);
