import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrainingProgressBar from './TrainingProgressBar';
import type {
  TrainingAttemptResult,
  TrainingSessionStats,
} from '../../cogitate/trainingEngine';
import { square } from '../../engine/types';

function makeStats(over: Partial<TrainingSessionStats> = {}): TrainingSessionStats {
  return {
    totalPositions: 4,
    completedPositions: 0,
    correctCount: 0,
    acceptableCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    accuracy: 0,
    ...over,
  };
}

function makeResult(flags: {
  isCorrect?: boolean;
  isAcceptable?: boolean;
}): TrainingAttemptResult {
  const move = { from: square(11), path: [square(15)], captured: [] } as const;
  return {
    playerMove: move,
    playerMoveNotation: '11-15',
    playerMoveEval: { score: 0, rawScore: 0, isTerminal: false, confidence: 1 },
    bestMove: move,
    bestMoveNotation: '11-15',
    bestMoveEval: { score: 0, rawScore: 0, isTerminal: false, confidence: 1 },
    evalDifference: 0,
    isCorrect: flags.isCorrect ?? false,
    isAcceptable: flags.isAcceptable ?? false,
    attemptQuality: 'good',
    alternatives: [],
    bestMovePV: [],
  };
}

describe('TrainingProgressBar', () => {
  it('renders one segment per total position', () => {
    render(
      <TrainingProgressBar
        stats={makeStats({ totalPositions: 5 })}
        results={[null, null, null, null, null]}
        skippedIndexes={new Set()}
        currentIndex={0}
      />,
    );
    expect(screen.getAllByTestId(/training-progress-segment-/)).toHaveLength(5);
  });

  it('applies state classes based on attempt results', () => {
    const results = [
      makeResult({ isCorrect: true, isAcceptable: true }),
      makeResult({ isCorrect: false, isAcceptable: true }),
      makeResult({ isCorrect: false, isAcceptable: false }),
      null,
    ];
    render(
      <TrainingProgressBar
        stats={makeStats({ completedPositions: 3, correctCount: 1, accuracy: 33 })}
        results={results}
        skippedIndexes={new Set([3])}
        currentIndex={3}
      />,
    );
    expect(screen.getByTestId('training-progress-segment-0').dataset.state).toBe('correct');
    expect(screen.getByTestId('training-progress-segment-1').dataset.state).toBe('acceptable');
    expect(screen.getByTestId('training-progress-segment-2').dataset.state).toBe('incorrect');
    expect(screen.getByTestId('training-progress-segment-3').dataset.state).toBe('skipped');
  });

  it('marks the current position when no result yet', () => {
    render(
      <TrainingProgressBar
        stats={makeStats()}
        results={[null, null, null, null]}
        skippedIndexes={new Set()}
        currentIndex={2}
      />,
    );
    expect(screen.getByTestId('training-progress-segment-2').dataset.state).toBe('current');
  });

  it('renders counter, accuracy and streak', () => {
    render(
      <TrainingProgressBar
        stats={makeStats({
          completedPositions: 2,
          totalPositions: 5,
          accuracy: 80,
          currentStreak: 3,
        })}
        results={[null, null, null, null, null]}
        skippedIndexes={new Set()}
        currentIndex={2}
      />,
    );
    expect(screen.getByTestId('training-progress-counter').textContent).toBe('2/5');
    expect(screen.getByTestId('training-progress-accuracy').textContent).toBe('Acc: 80%');
    expect(screen.getByTestId('training-progress-streak').textContent).toContain('3');
  });

  it('exposes accessible progressbar attributes', () => {
    render(
      <TrainingProgressBar
        stats={makeStats({ completedPositions: 1, totalPositions: 4, accuracy: 100 })}
        results={[makeResult({ isCorrect: true, isAcceptable: true }), null, null, null]}
        skippedIndexes={new Set()}
        currentIndex={1}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');
    expect(bar.getAttribute('aria-label')).toContain('1 of 4');
  });
});
