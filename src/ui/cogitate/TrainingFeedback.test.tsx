import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrainingFeedback from './TrainingFeedback';
import type {
  TrainingAttemptResult,
  TrainingPosition,
} from '../../cogitate/trainingEngine';
import type { AnalysisResult } from '../../cogitate/types';
import {
  PieceColor,
  square,
  type BoardState,
  type Move,
  type RuleSet,
} from '../../engine/types';

function makeMove(from: number, to: number): Move {
  return { from: square(from), path: [square(to)], captured: [] };
}

function makeAnalysis(): AnalysisResult {
  return {
    evaluation: 0.3,
    bestMove: makeMove(11, 15),
    bestMoveNotation: '11-15',
    principalVariation: [],
    pvNotation: ['11-15', '22-18'],
    alternativeMoves: [
      { move: makeMove(11, 15), notation: '11-15', score: 30, normalizedScore: 0.3 },
      { move: makeMove(12, 16), notation: '12-16', score: 10, normalizedScore: 0.1 },
    ],
    depth: 8,
    nodesEvaluated: 100,
    rawScore: 30,
    evalDrop: 0.2,
    moveQuality: 'mistake',
  };
}

function makePosition(): TrainingPosition {
  const ruleSet: RuleSet = {
    getLegalMoves: () => [],
    applyMove: (board) => board,
    checkGameOver: () => null,
    shouldPromote: () => false,
  };
  return {
    plyIndex: 4,
    board: new Array(32).fill(null) as BoardState,
    activeColor: PieceColor.White,
    activeEvents: [],
    serializedEvents: [],
    ruleSet,
    analysisResult: makeAnalysis(),
    gameId: 'g',
    modeId: 'classic',
    gameLabel: 'Classic — Alice vs Bob',
    moveNumber: 3,
    originalEvalDrop: 0.2,
    originalMoveQuality: 'mistake',
  };
}

function makeResult(over: Partial<TrainingAttemptResult> = {}): TrainingAttemptResult {
  const analysis = makeAnalysis();
  return {
    playerMove: makeMove(12, 16),
    playerMoveNotation: '12-16',
    playerMoveEval: { score: 0.05, rawScore: 5, isTerminal: false, confidence: 1 },
    bestMove: analysis.bestMove,
    bestMoveNotation: '11-15',
    bestMoveEval: { score: 0.3, rawScore: 30, isTerminal: false, confidence: 1 },
    evalDifference: 0.25,
    isCorrect: false,
    isAcceptable: false,
    attemptQuality: 'mistake',
    alternatives: analysis.alternativeMoves,
    bestMovePV: analysis.pvNotation,
    ...over,
  };
}

describe('TrainingFeedback', () => {
  it('renders "Correct!" when player found the best move', () => {
    render(
      <TrainingFeedback
        result={makeResult({
          isCorrect: true,
          isAcceptable: true,
          evalDifference: 0,
          playerMoveNotation: '11-15',
        })}
        position={makePosition()}
        positionIndex={0}
      />,
    );
    expect(screen.getByTestId('training-feedback-verdict').textContent).toBe('Correct!');
    expect(screen.getByTestId('training-feedback').dataset.verdict).toBe('correct');
    expect(screen.queryByTestId('training-feedback-diff')).toBeNull();
  });

  it('renders "Good enough!" when acceptable but not best', () => {
    render(
      <TrainingFeedback
        result={makeResult({
          isCorrect: false,
          isAcceptable: true,
          evalDifference: 0.02,
        })}
        position={makePosition()}
        positionIndex={1}
      />,
    );
    expect(screen.getByTestId('training-feedback-verdict').textContent).toBe('Good enough!');
    expect(screen.getByTestId('training-feedback').dataset.verdict).toBe('acceptable');
  });

  it('renders "Not quite" when incorrect', () => {
    render(
      <TrainingFeedback
        result={makeResult()}
        position={makePosition()}
        positionIndex={2}
      />,
    );
    expect(screen.getByTestId('training-feedback-verdict').textContent).toBe('Not quite');
    expect(screen.getByTestId('training-feedback').dataset.verdict).toBe('incorrect');
    expect(screen.getByTestId('training-feedback-diff').textContent).toContain('−0.25');
  });

  it('shows player move and best move notation when they differ', () => {
    render(
      <TrainingFeedback
        result={makeResult()}
        position={makePosition()}
        positionIndex={0}
      />,
    );
    expect(screen.getByTestId('training-feedback-player-move').textContent).toBe('12-16');
    expect(screen.getByTestId('training-feedback-best-move').textContent).toBe('11-15');
  });

  it('renders alternatives and the principal variation', () => {
    render(
      <TrainingFeedback
        result={makeResult()}
        position={makePosition()}
        positionIndex={0}
      />,
    );
    expect(screen.getByTestId('training-feedback-alternatives')).toBeInTheDocument();
    expect(screen.getByTestId('principal-variation')).toBeInTheDocument();
  });

  it('includes original position context', () => {
    render(
      <TrainingFeedback
        result={makeResult()}
        position={makePosition()}
        positionIndex={0}
      />,
    );
    expect(screen.getByTestId('training-feedback-context').textContent).toContain('mistake');
    expect(screen.getByTestId('training-feedback-context').textContent).toContain('0.20');
  });
});
