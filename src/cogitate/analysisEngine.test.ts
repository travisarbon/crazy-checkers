import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeGame,
  classifyMove,
  computeSummary,
  extractTrainingPositions,
  loadCachedAnalysis,
  _clearAnalysisCache,
  type AnalyzeGameOptions,
} from './analysisEngine';
import { ANALYSIS_SEARCH_CONFIG, type AnalysisResult } from './types';
import type { CogitateGameAdapter } from './CogitateGameAdapter';
import type { GameRecord } from '../persistence/gameHistory';
import { PieceColor, PieceType } from '../engine/types';
import type { BoardState } from '../engine/types';

function makeEmptyBoard(): BoardState {
  return new Array(32).fill(null) as BoardState;
}

function makeAdapter(modeId = 'classic'): CogitateGameAdapter {
  return {
    modeId,
    getBoard: () => makeEmptyBoard(),
    serializeBoard: () => '',
    getRuleSet: () => ({} as never),
    getAIConfig: () => ANALYSIS_SEARCH_CONFIG,
    getPiecePalette: () => [],
    getBoardGeometry: () => ({
      gridType: 'diagonal-square',
      rows: 8,
      cols: 8,
      playableSquares: 32,
      darkSquaresOnly: true,
    }),
    getStartingPosition: () => makeEmptyBoard(),
    validatePosition: () => ({ isLegal: true, warnings: [], errors: [] }),
    getNotationAdapter: () => ({} as never),
    supportsEvaluation: () => true,
    getEvaluationRange: () => [-1000, 1000] as const,
    getEvaluationProvider: () => ({} as never),
  };
}

function makeGame(plies: number): GameRecord {
  return {
    id: 'game-1',
    mode: 'classic',
    playerWhite: 'White',
    playerBlack: 'Black',
    result: 'WHITE_WIN',
    reason: 'checkmate',
    moves: Array.from({ length: plies }, (_, i) => `m${String(i)}`),
    boardStates: Array.from({ length: plies + 1 }, () => ''),
    startedAt: 0,
    completedAt: 0,
  };
}

function makeResult(overrides: Partial<AnalysisResult>): AnalysisResult {
  return {
    evaluation: 0,
    bestMove: null,
    bestMoveNotation: '',
    principalVariation: [],
    pvNotation: [],
    alternativeMoves: [],
    depth: 1,
    nodesEvaluated: 1,
    rawScore: 0,
    ...overrides,
  };
}

describe('classifyMove', () => {
  it('returns good for drops below 0.05', () => {
    expect(classifyMove(0, 5, false, 0)).toBe('good');
    expect(classifyMove(0.049, 5, false, 0)).toBe('good');
  });

  it('returns inaccuracy for drops in [0.05, 0.15)', () => {
    expect(classifyMove(0.05, 5, false, 0)).toBe('inaccuracy');
    expect(classifyMove(0.14, 5, false, 0)).toBe('inaccuracy');
  });

  it('returns mistake for drops in [0.15, 0.30)', () => {
    expect(classifyMove(0.15, 5, false, 0)).toBe('mistake');
    expect(classifyMove(0.29, 5, false, 0)).toBe('mistake');
  });

  it('returns blunder for drops >= 0.30', () => {
    expect(classifyMove(0.30, 5, false, 0)).toBe('blunder');
    expect(classifyMove(1.0, 5, false, 0)).toBe('blunder');
  });

  it('returns brilliant when best move is non-obvious in a complex position', () => {
    expect(classifyMove(0, 5, false, 0.2)).toBe('brilliant');
  });

  it('is not brilliant when only capture is forced', () => {
    expect(classifyMove(0, 5, true, 0.2)).toBe('good');
  });

  it('is not brilliant with fewer than 3 legal moves', () => {
    expect(classifyMove(0, 2, false, 0.2)).toBe('good');
  });

  it('is not brilliant without a large second-best gap', () => {
    expect(classifyMove(0, 5, false, 0.05)).toBe('good');
  });

  it('widens thresholds for chaos mode', () => {
    // 0.10 would normally be an inaccuracy, but Chaos multiplier (1.5) keeps it good.
    expect(classifyMove(0.07, 5, false, 0, { modeId: 'chaos' })).toBe('good');
    expect(classifyMove(0.08, 5, false, 0, { modeId: 'chaos' })).toBe('inaccuracy');
  });
});

describe('computeSummary', () => {
  it('counts classifications and computes a quality score', () => {
    const results: (AnalysisResult | null)[] = [
      makeResult({ moveQuality: 'good', evalDrop: 0 }),
      makeResult({ moveQuality: 'brilliant', evalDrop: 0 }),
      makeResult({ moveQuality: 'blunder', evalDrop: 0.5 }),
      makeResult({ moveQuality: 'mistake', evalDrop: 0.2 }),
      null,
    ];
    const summary = computeSummary(results);
    expect(summary.blunderCount).toBe(1);
    expect(summary.mistakeCount).toBe(1);
    expect(summary.brilliantCount).toBe(1);
    expect(summary.goodCount).toBe(1);
    expect(summary.qualityScore).toBe(100 - 30 - 15 + 5);
  });

  it('clamps qualityScore to [0, 100]', () => {
    const results: (AnalysisResult | null)[] = Array.from({ length: 10 }, () =>
      makeResult({ moveQuality: 'blunder', evalDrop: 0.5 }),
    );
    expect(computeSummary(results).qualityScore).toBe(0);
  });
});

describe('extractTrainingPositions', () => {
  it('returns plies with evalDrop >= 0.05 sorted by drop descending', () => {
    const results: (AnalysisResult | null)[] = [
      makeResult({ evalDrop: 0.02, alternativeMoves: [{} as never, {} as never] }),
      makeResult({ evalDrop: 0.20, alternativeMoves: [{} as never, {} as never] }),
      makeResult({ evalDrop: 0.08, alternativeMoves: [{} as never, {} as never] }),
      null,
    ];
    expect(extractTrainingPositions(results)).toEqual([1, 2]);
  });

  it('excludes plies with fewer than 2 alternative moves', () => {
    const results: (AnalysisResult | null)[] = [
      makeResult({ evalDrop: 0.3, alternativeMoves: [{} as never] }),
    ];
    expect(extractTrainingPositions(results)).toEqual([]);
  });
});

describe('analyzeGame', () => {
  beforeEach(() => {
    _clearAnalysisCache();
  });

  it('runs analysis for every ply and fires onProgress', async () => {
    const game = makeGame(3);
    const adapter = makeAdapter();
    const fn = vi.fn().mockResolvedValue(
      makeResult({
        evaluation: 0.1,
        alternativeMoves: [
          { move: {} as never, notation: 'a', score: 1, normalizedScore: 0.1 },
          { move: {} as never, notation: 'b', score: 0.5, normalizedScore: 0 },
          { move: {} as never, notation: 'c', score: 0.1, normalizedScore: -0.1 },
        ],
      }),
    );
    const evalFn = vi.fn().mockResolvedValue({
      score: 0,
      rawScore: 0,
      isTerminal: false,
      confidence: 1,
    });
    const progress = vi.fn();
    const options: AnalyzeGameOptions = {
      requestAnalysisFn: fn as never,
      requestEvaluationFn: evalFn as never,
    };
    const analysis = await analyzeGame(game, adapter, ANALYSIS_SEARCH_CONFIG, progress, options);

    expect(fn).toHaveBeenCalledTimes(3);
    expect(analysis.results).toHaveLength(3);
    expect(analysis.status).toBe('complete');
    expect(progress).toHaveBeenCalled();
  });

  it('respects AbortSignal cancellation', async () => {
    const game = makeGame(5);
    const adapter = makeAdapter();
    const controller = new AbortController();
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 2) controller.abort();
      return Promise.resolve(makeResult({ evaluation: 0, alternativeMoves: [] }));
    });
    const evalFn = vi.fn();
    const analysis = await analyzeGame(
      game,
      adapter,
      ANALYSIS_SEARCH_CONFIG,
      () => undefined,
      {
        requestAnalysisFn: fn as never,
        requestEvaluationFn: evalFn as never,
        signal: controller.signal,
      },
    );
    expect(analysis.status).toBe('cancelled');
    expect(fn.mock.calls.length).toBeLessThan(5);
  });
});

describe('loadCachedAnalysis', () => {
  beforeEach(() => {
    _clearAnalysisCache();
  });

  it('returns null when the record has no analysisCache', () => {
    const game = makeGame(0);
    expect(loadCachedAnalysis(game)).toBeNull();
  });

  it('loads from analysisCache when present', () => {
    const game = {
      ...makeGame(2),
      analysisCache: [
        makeResult({ moveQuality: 'good', evalDrop: 0 }),
        makeResult({ moveQuality: 'blunder', evalDrop: 0.5, alternativeMoves: [{} as never, {} as never] }),
      ],
    };
    const cached = loadCachedAnalysis(game);
    expect(cached).not.toBeNull();
    expect(cached?.results.length).toBe(2);
    expect(cached?.summary.blunderCount).toBe(1);
  });
});

// Simple smoke test: adapter piece types + colors compile-time check.
it('adapter mock types compile', () => {
  expect(PieceColor.White).toBeTruthy();
  expect(PieceType.Pawn).toBeTruthy();
});
