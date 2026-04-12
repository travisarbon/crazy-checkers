import { describe, it, expect, vi } from 'vitest';
import {
  createSessionStats,
  updateSessionStats,
  loadTrainingPositions,
  evaluateAttempt,
  movesEqual,
  type TrainingAttemptResult,
  type TrainingPosition,
} from './trainingEngine';
import type { CogitateGameAdapter } from './CogitateGameAdapter';
import type { AnalysisResult } from './types';
import { ANALYSIS_SEARCH_CONFIG } from './types';
import type { GameRecord } from '../persistence/gameHistory';
import { PieceColor, square, type BoardState, type Move, type RuleSet } from '../engine/types';

function makeMove(from: number, to: number, captured: number[] = []): Move {
  return {
    from: square(from),
    path: [square(to)],
    captured: captured.map((c) => square(c)),
  };
}

function makeEmptyBoard(): BoardState {
  return new Array(32).fill(null) as BoardState;
}

function makeAdapter(modeId = 'classic'): CogitateGameAdapter {
  const stubRuleSet: RuleSet = {
    getLegalMoves: () => [],
    applyMove: (board) => board,
    checkGameOver: () => null,
    shouldPromote: () => false,
  };
  return {
    modeId,
    // Encode the snapshot string into the board so serialization can round-trip
    // and dedup compares unique keys per ply.
    getBoard: (snapshot: string) => {
      const b = makeEmptyBoard() as unknown as { snapshotKey?: string };
      Object.defineProperty(b, 'snapshotKey', {
        value: snapshot,
        enumerable: false,
      });
      return b as BoardState;
    },
    serializeBoard: (board) =>
      (board as unknown as { snapshotKey?: string }).snapshotKey ?? `board-${modeId}`,
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
    getStartingPosition: () => makeEmptyBoard(),
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

function makeAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    evaluation: 0.3,
    bestMove: makeMove(11, 15),
    bestMoveNotation: '11-15',
    principalVariation: [],
    pvNotation: ['11-15', '22-18'],
    alternativeMoves: [
      { move: makeMove(11, 15), notation: '11-15', score: 30, normalizedScore: 0.3 },
      { move: makeMove(12, 16), notation: '12-16', score: 10, normalizedScore: 0.1 },
      { move: makeMove(9, 13), notation: '9-13', score: 5, normalizedScore: 0.05 },
    ],
    depth: 8,
    nodesEvaluated: 1000,
    rawScore: 30,
    evalDrop: 0.2,
    moveQuality: 'mistake',
    ...overrides,
  };
}

function makeGame(id: string, plies: number[], analysis: AnalysisResult[]): GameRecord {
  const totalPlies = Math.max(...plies, 0) + 1;
  return {
    id,
    mode: 'CLASSIC',
    playerWhite: 'Alice',
    playerBlack: 'Bob',
    result: 'WHITE_WIN',
    reason: 'NO_LEGAL_MOVES',
    moves: Array.from({ length: totalPlies }, (_, i) => `m${String(i)}`),
    boardStates: Array.from({ length: totalPlies + 1 }, (_, i) => `${id}-snapshot-${String(i)}`),
    startedAt: 0,
    completedAt: Date.now(),
    analysisCache: analysis,
    trainingPositions: plies,
  };
}

describe('movesEqual', () => {
  it('returns true for identical moves', () => {
    expect(movesEqual(makeMove(11, 15), makeMove(11, 15))).toBe(true);
  });
  it('returns false for different from', () => {
    expect(movesEqual(makeMove(11, 15), makeMove(12, 15))).toBe(false);
  });
  it('returns false for different path length (multi-jump)', () => {
    const a: Move = { from: square(11), path: [square(18), square(25)], captured: [square(14), square(22)] };
    const b: Move = { from: square(11), path: [square(18)], captured: [square(14)] };
    expect(movesEqual(a, b)).toBe(false);
  });
  it('returns false when either is null', () => {
    expect(movesEqual(null, makeMove(11, 15))).toBe(false);
    expect(movesEqual(makeMove(11, 15), null)).toBe(false);
  });
});

describe('createSessionStats', () => {
  it('returns zeroed stats', () => {
    const s = createSessionStats(5);
    expect(s).toEqual({
      totalPositions: 5,
      completedPositions: 0,
      correctCount: 0,
      acceptableCount: 0,
      currentStreak: 0,
      bestStreak: 0,
      accuracy: 0,
    });
  });
});

describe('updateSessionStats', () => {
  const baseResult: TrainingAttemptResult = {
    playerMove: makeMove(11, 15),
    playerMoveNotation: '11-15',
    playerMoveEval: { score: 0.3, rawScore: 30, isTerminal: false, confidence: 1 },
    bestMove: makeMove(11, 15),
    bestMoveNotation: '11-15',
    bestMoveEval: { score: 0.3, rawScore: 30, isTerminal: false, confidence: 1 },
    evalDifference: 0,
    isCorrect: true,
    isAcceptable: true,
    attemptQuality: 'good',
    alternatives: [],
    bestMovePV: [],
  };

  it('increments correctCount and streak on correct', () => {
    const s1 = updateSessionStats(createSessionStats(3), baseResult);
    expect(s1.correctCount).toBe(1);
    expect(s1.currentStreak).toBe(1);
    expect(s1.bestStreak).toBe(1);
    expect(s1.accuracy).toBe(100);
  });

  it('resets streak on incorrect but keeps bestStreak', () => {
    let s = createSessionStats(4);
    s = updateSessionStats(s, baseResult);
    s = updateSessionStats(s, baseResult);
    const incorrect = { ...baseResult, isCorrect: false, isAcceptable: false };
    s = updateSessionStats(s, incorrect);
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(2);
    expect(s.accuracy).toBe(Math.round((2 / 3) * 100));
  });

  it('counts acceptable separately from correct', () => {
    const acceptable = { ...baseResult, isCorrect: false, isAcceptable: true };
    const s = updateSessionStats(createSessionStats(2), acceptable);
    expect(s.correctCount).toBe(0);
    expect(s.acceptableCount).toBe(1);
    expect(s.currentStreak).toBe(0);
  });
});

describe('loadTrainingPositions', () => {
  it('loads positions from all analyzed games and sorts by eval drop descending', async () => {
    const adapter = makeAdapter('classic');
    const gameA = makeGame('game-a', [0, 1], [
      makeAnalysisResult({ evalDrop: 0.1 }),
      makeAnalysisResult({ evalDrop: 0.4 }),
    ]);
    const gameB = makeGame('game-b', [0], [
      makeAnalysisResult({ evalDrop: 0.25 }),
    ]);

    const positions = await loadTrainingPositions(
      {},
      () => adapter,
      { getAllGameRecordsFn: () => Promise.resolve([gameA, gameB]) },
    );

    expect(positions).toHaveLength(3);
    expect(positions[0]?.originalEvalDrop).toBe(0.4);
    expect(positions[1]?.originalEvalDrop).toBe(0.25);
    expect(positions[2]?.originalEvalDrop).toBe(0.1);
  });

  it('filters by gameId', async () => {
    const adapter = makeAdapter('classic');
    const gameA = makeGame('game-a', [0], [makeAnalysisResult({ evalDrop: 0.2 })]);
    const getGameRecordFn = vi.fn(() => Promise.resolve(gameA));

    const positions = await loadTrainingPositions(
      { gameId: 'game-a' },
      () => adapter,
      {
        getAllGameRecordsFn: () => Promise.resolve([]),
        getGameRecordFn,
      },
    );
    expect(getGameRecordFn).toHaveBeenCalledWith('game-a');
    expect(positions).toHaveLength(1);
    expect(positions[0]?.gameId).toBe('game-a');
  });

  it('filters by mode', async () => {
    const classicAdapter = makeAdapter('classic');
    const crazyAdapter = makeAdapter('crazy');
    const classicGame = makeGame('g-classic', [0], [makeAnalysisResult()]);
    const crazyGame: GameRecord = {
      ...makeGame('g-crazy', [0], [makeAnalysisResult()]),
      mode: 'CRAZY',
    };

    const positions = await loadTrainingPositions(
      { modeFilter: ['CRAZY'] },
      (modeId) => (modeId === 'crazy' ? crazyAdapter : classicAdapter),
      { getAllGameRecordsFn: () => Promise.resolve([classicGame, crazyGame]) },
    );

    expect(positions).toHaveLength(1);
    expect(positions[0]?.gameId).toBe('g-crazy');
  });

  it('truncates to maxPositions', async () => {
    const adapter = makeAdapter('classic');
    const game = makeGame('g', [0, 1, 2], [
      makeAnalysisResult({ evalDrop: 0.3 }),
      makeAnalysisResult({ evalDrop: 0.2 }),
      makeAnalysisResult({ evalDrop: 0.1 }),
    ]);

    const positions = await loadTrainingPositions(
      { maxPositions: 2 },
      () => adapter,
      { getAllGameRecordsFn: () => Promise.resolve([game]) },
    );
    expect(positions).toHaveLength(2);
  });

  it('skips games without a registered adapter', async () => {
    const game = makeGame('g', [0], [makeAnalysisResult()]);
    const positions = await loadTrainingPositions(
      {},
      () => null,
      { getAllGameRecordsFn: () => Promise.resolve([game]) },
    );
    expect(positions).toHaveLength(0);
  });

  it('skips games without analysis cache', async () => {
    const adapter = makeAdapter('classic');
    const game: GameRecord = {
      ...makeGame('g', [0], [makeAnalysisResult()]),
      analysisCache: undefined,
    };
    const positions = await loadTrainingPositions(
      {},
      () => adapter,
      { getAllGameRecordsFn: () => Promise.resolve([game]) },
    );
    expect(positions).toHaveLength(0);
  });

  it('deduplicates by board state keeping the largest eval drop', async () => {
    const adapter: CogitateGameAdapter = {
      ...makeAdapter('classic'),
      // Force all positions to serialize to the same key so dedup fires.
      serializeBoard: () => 'same-board',
    };
    const gameA = makeGame('a', [0], [makeAnalysisResult({ evalDrop: 0.1 })]);
    const gameB = makeGame('b', [0], [makeAnalysisResult({ evalDrop: 0.5 })]);

    const positions = await loadTrainingPositions(
      {},
      () => adapter,
      { getAllGameRecordsFn: () => Promise.resolve([gameA, gameB]) },
    );
    expect(positions).toHaveLength(1);
    expect(positions[0]?.originalEvalDrop).toBe(0.5);
  });
});

describe('evaluateAttempt', () => {
  function makePosition(overrides: Partial<TrainingPosition> = {}): TrainingPosition {
    const stubRuleSet: RuleSet = {
      getLegalMoves: () => [],
      applyMove: (board) => board,
      checkGameOver: () => null,
      shouldPromote: () => false,
    };
    const analysis = makeAnalysisResult();
    return {
      plyIndex: 4,
      board: makeEmptyBoard(),
      activeColor: PieceColor.White,
      activeEvents: [],
      serializedEvents: [],
      ruleSet: stubRuleSet,
      analysisResult: analysis,
      gameId: 'g',
      modeId: 'classic',
      gameLabel: 'Classic game',
      moveNumber: 3,
      originalEvalDrop: 0.2,
      originalMoveQuality: 'mistake',
      ...overrides,
    };
  }

  it('returns isCorrect without calling the worker when player finds the best move', async () => {
    const adapter = makeAdapter();
    const position = makePosition();
    const requestAnalysisFn = vi.fn();
    const result = await evaluateAttempt(
      position,
      makeMove(11, 15),
      adapter,
      { requestAnalysisFn: requestAnalysisFn as never },
    );
    expect(result.isCorrect).toBe(true);
    expect(result.isAcceptable).toBe(true);
    expect(result.evalDifference).toBe(0);
    expect(requestAnalysisFn).not.toHaveBeenCalled();
  });

  it('calls the worker for non-best moves and computes eval difference', async () => {
    const adapter = makeAdapter();
    const position = makePosition();
    const requestAnalysisFn = vi.fn(() => Promise.resolve({
      evaluation: -0.05, // from opponent's perspective
      rawScore: -5,
      bestMove: null,
      bestMoveNotation: '',
      principalVariation: [],
      pvNotation: [],
      alternativeMoves: [],
      depth: 8,
      nodesEvaluated: 100,
    } satisfies AnalysisResult));

    const result = await evaluateAttempt(
      position,
      makeMove(12, 16),
      adapter,
      { requestAnalysisFn: requestAnalysisFn as never },
    );
    expect(requestAnalysisFn).toHaveBeenCalled();
    expect(result.isCorrect).toBe(false);
    // Player eval is -(-0.05) = 0.05; best = 0.3; diff = 0.25.
    expect(result.playerMoveEval.score).toBeCloseTo(0.05, 5);
    expect(result.evalDifference).toBeCloseTo(0.25, 5);
    expect(result.isAcceptable).toBe(false);
    expect(result.attemptQuality).toBe('mistake');
  });

  it('marks close moves as acceptable even when not best', async () => {
    const adapter = makeAdapter();
    const position = makePosition();
    // Opponent sees -0.27 → player sees 0.27 → diff from best (0.3) is 0.03.
    const requestAnalysisFn = vi.fn(() => Promise.resolve({
      evaluation: -0.27,
      rawScore: -27,
      bestMove: null,
      bestMoveNotation: '',
      principalVariation: [],
      pvNotation: [],
      alternativeMoves: [],
      depth: 8,
      nodesEvaluated: 100,
    } satisfies AnalysisResult));

    const result = await evaluateAttempt(
      position,
      makeMove(12, 16),
      adapter,
      { requestAnalysisFn: requestAnalysisFn as never },
    );
    expect(result.isCorrect).toBe(false);
    expect(result.isAcceptable).toBe(true);
    expect(result.evalDifference).toBeLessThan(0.05);
  });

  it('populates alternatives and PV from the original analysis', async () => {
    const adapter = makeAdapter();
    const position = makePosition();
    const result = await evaluateAttempt(
      position,
      makeMove(11, 15),
      adapter,
    );
    expect(result.alternatives).toHaveLength(3);
    expect(result.bestMovePV).toEqual(['11-15', '22-18']);
  });
});
