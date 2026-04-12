import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTrainingSession } from './useTrainingSession';
import type { TrainingPosition } from '../../cogitate/trainingEngine';
import type { CogitateGameAdapter } from '../../cogitate/CogitateGameAdapter';
import type { AnalysisResult } from '../../cogitate/types';
import { ANALYSIS_SEARCH_CONFIG } from '../../cogitate/types';
import { PieceColor, square, type BoardState, type Move, type RuleSet } from '../../engine/types';

function makeMove(from: number, to: number, captured: number[] = []): Move {
  return {
    from: square(from),
    path: [square(to)],
    captured: captured.map((c) => square(c)),
  };
}

function makeAdapter(): CogitateGameAdapter {
  const stubRuleSet: RuleSet = {
    getLegalMoves: () => [],
    applyMove: (board) => board,
    checkGameOver: () => null,
    shouldPromote: () => false,
  };
  return {
    modeId: 'classic',
    getBoard: () => new Array(32).fill(null) as BoardState,
    serializeBoard: () => '',
    getRuleSet: () => stubRuleSet,
    getAIConfig: () => ANALYSIS_SEARCH_CONFIG,
    getPiecePalette: () => [],
    getBoardGeometry: () => ({
      gridType: 'diagonal-square',
      rows: 8,
      cols: 8,
      playableSquares: 32,
      darkSquaresOnly: true,
    }),
    getStartingPosition: () => new Array(32).fill(null) as BoardState,
    validatePosition: () => ({ isLegal: true, warnings: [], errors: [] }),
    getNotationAdapter: () => ({
      moveToString: (m) => `${String(m.from)}-${String(m.path[0])}`,
      stringToMove: () => null,
      formatMoveNumber: (_p, n) => n,
    }),
    supportsEvaluation: () => true,
    getEvaluationRange: () => [-1000, 1000] as const,
    getEvaluationProvider: () => ({} as never),
  };
}

function makeAnalysis(): AnalysisResult {
  return {
    evaluation: 0.3,
    bestMove: makeMove(11, 15),
    bestMoveNotation: '11-15',
    principalVariation: [],
    pvNotation: [],
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

function makePosition(plyIndex: number): TrainingPosition {
  const stubRuleSet: RuleSet = {
    getLegalMoves: () => [],
    applyMove: (board) => board,
    checkGameOver: () => null,
    shouldPromote: () => false,
  };
  return {
    plyIndex,
    board: new Array(32).fill(null) as BoardState,
    activeColor: PieceColor.White,
    activeEvents: [],
    serializedEvents: [],
    ruleSet: stubRuleSet,
    analysisResult: makeAnalysis(),
    gameId: `g-${String(plyIndex)}`,
    modeId: 'classic',
    gameLabel: 'Classic',
    moveNumber: Math.floor(plyIndex / 2) + 1,
    originalEvalDrop: 0.2,
    originalMoveQuality: 'mistake',
  };
}

describe('useTrainingSession', () => {
  it('initializes in playing phase at position 0', () => {
    const adapter = makeAdapter();
    const positions = [makePosition(0), makePosition(2)];
    const { result } = renderHook(() =>
      useTrainingSession({ positions, getAdapter: () => adapter }),
    );
    expect(result.current.phase).toBe('playing');
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentPosition).toBe(positions[0]);
    expect(result.current.isSessionComplete).toBe(false);
    expect(result.current.stats.totalPositions).toBe(2);
  });

  it('submitMove transitions to feedback and updates stats', async () => {
    const adapter = makeAdapter();
    const positions = [makePosition(0)];
    const { result } = renderHook(() =>
      useTrainingSession({ positions, getAdapter: () => adapter }),
    );

    await act(async () => {
      await result.current.submitMove(makeMove(11, 15));
    });

    expect(result.current.phase).toBe('feedback');
    expect(result.current.attemptResult?.isCorrect).toBe(true);
    expect(result.current.stats.correctCount).toBe(1);
    expect(result.current.stats.completedPositions).toBe(1);
  });

  it('nextPosition advances to the next position in playing phase', async () => {
    const adapter = makeAdapter();
    const positions = [makePosition(0), makePosition(2)];
    const { result } = renderHook(() =>
      useTrainingSession({ positions, getAdapter: () => adapter }),
    );

    await act(async () => {
      await result.current.submitMove(makeMove(11, 15));
    });
    act(() => {
      result.current.nextPosition();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.phase).toBe('playing');
    expect(result.current.currentPosition).toBe(positions[1]);
  });

  it('skipCurrent advances without recording a result', () => {
    const adapter = makeAdapter();
    const positions = [makePosition(0), makePosition(2)];
    const { result } = renderHook(() =>
      useTrainingSession({ positions, getAdapter: () => adapter }),
    );

    act(() => {
      result.current.skipCurrent();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.phase).toBe('playing');
    expect(result.current.skippedIndexes.has(0)).toBe(true);
    expect(result.current.stats.completedPositions).toBe(0);
  });

  it('isSessionComplete becomes true after all positions attempted', async () => {
    const adapter = makeAdapter();
    const positions = [makePosition(0)];
    const { result } = renderHook(() =>
      useTrainingSession({ positions, getAdapter: () => adapter }),
    );

    await act(async () => {
      await result.current.submitMove(makeMove(11, 15));
    });
    act(() => {
      result.current.nextPosition();
    });
    expect(result.current.isSessionComplete).toBe(true);
    expect(result.current.hasNext).toBe(false);
  });

  it('restartSession resets to initial state', async () => {
    const adapter = makeAdapter();
    const positions = [makePosition(0), makePosition(2)];
    const { result } = renderHook(() =>
      useTrainingSession({ positions, getAdapter: () => adapter }),
    );

    await act(async () => {
      await result.current.submitMove(makeMove(11, 15));
    });
    act(() => {
      result.current.nextPosition();
    });
    act(() => {
      result.current.skipCurrent();
    });
    act(() => {
      result.current.restartSession();
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.phase).toBe('playing');
    expect(result.current.stats.correctCount).toBe(0);
    expect(result.current.skippedIndexes.size).toBe(0);
  });

  it('captures evaluation errors without crashing', async () => {
    const adapter = makeAdapter();
    const positions = [makePosition(0)];
    const requestAnalysisFn = vi.fn(() => Promise.reject(new Error('worker died')));
    const { result } = renderHook(() =>
      useTrainingSession({
        positions,
        getAdapter: () => adapter,
        evaluateOptions: { requestAnalysisFn: requestAnalysisFn as never },
      }),
    );

    await act(async () => {
      // Player makes a non-best move, so the worker is called.
      await result.current.submitMove(makeMove(12, 16));
    });
    expect(result.current.phase).toBe('playing');
    expect(result.current.evaluationError).toBe('worker died');
  });
});
