import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { BoardState } from '../../engine/types';
import { CrazyEvent, PieceColor as PC } from '../../engine/types';
import type { CogitateGameAdapter } from '../../cogitate/CogitateGameAdapter';
import type { GameRecord } from '../../persistence/gameHistory';
import type { NormalizedEvaluation } from '../../cogitate/types';
import { DRAUGHTS_BOARD_GEOMETRY } from '../../cogitate/types';
import type { SerializedActiveEvent } from '../../persistence/serialization';
import { createInitialBoard } from '../../engine/board';
import {
  useReplayNavigation,
  deserializeActiveEvents,
  EVALUATION_DEBOUNCE_MS,
  DEFAULT_AUTOPLAY_INTERVAL_MS,
} from './useReplayNavigation';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeEval(score: number): NormalizedEvaluation {
  return { score, rawScore: score * 100, isTerminal: false, confidence: 1 };
}

function makeAdapter(overrides: Partial<CogitateGameAdapter> = {}): CogitateGameAdapter {
  const startBoard = createInitialBoard();
  const base: CogitateGameAdapter = {
    modeId: 'classic',
    getBoard: () => startBoard,
    serializeBoard: () => '',
    getRuleSet: () => ({
      getLegalMoves: () => [],
      applyMove: (b: BoardState) => b,
      isGameOver: () => null,
      isLegal: () => true,
      mustContinueCapture: () => false,
    }) as never,
    getAIConfig: () => ({ maxDepth: 4, timeLimitMs: 1000, quiescenceEnabled: false, quiescenceMaxDepth: 0 }),
    getPiecePalette: () => [],
    getBoardGeometry: () => DRAUGHTS_BOARD_GEOMETRY,
    getStartingPosition: () => startBoard,
    validatePosition: () => ({ isLegal: true, warnings: [], errors: [] }),
    getNotationAdapter: () => ({
      moveToString: () => '',
      squareToString: () => '',
      stringToSquare: () => null,
    }) as never,
    supportsEvaluation: () => true,
    getEvaluationRange: () => [-1000, 1000],
    getEvaluationProvider: () => ({
      evaluate: () => Promise.resolve(makeEval(0)),
    }) as never,
    ...overrides,
  };
  return base;
}

function makeGame(overrides: Partial<GameRecord> = {}): GameRecord {
  const moves = ['11-15', '22-18', '8-11', '18-14'];
  const boardStates = ['p0', 'p1', 'p2', 'p3', 'p4'];
  return {
    id: 'game-' + Math.random().toString(36).slice(2),
    mode: 'classic',
    playerWhite: 'HUMAN',
    playerBlack: 'CPU_HARD',
    result: 'WHITE_WIN',
    reason: 'NO_LEGAL_MOVES',
    moves,
    boardStates,
    startedAt: 1000,
    completedAt: 2000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('deserializeActiveEvents', () => {
  it('converts valid SerializedActiveEvents into ActiveEvents', () => {
    const serialized: SerializedActiveEvent[] = [
      {
        type: CrazyEvent.KingForADay,
        remainingPlies: 4,
        triggeredBy: PC.White,
        triggeredAtPly: 3,
      },
    ];
    const result = deserializeActiveEvents(serialized);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe(CrazyEvent.KingForADay);
    expect(result[0]?.remainingPlies).toBe(4);
  });

  it('skips unknown event types gracefully', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const serialized: SerializedActiveEvent[] = [
      {
        type: 'DOES_NOT_EXIST',
        remainingPlies: 1,
        triggeredBy: PC.White,
        triggeredAtPly: 0,
      },
      {
        type: CrazyEvent.LiveGrenade,
        remainingPlies: -1,
        triggeredBy: PC.Black,
        triggeredAtPly: 1,
      },
    ];
    const result = deserializeActiveEvents(serialized);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe(CrazyEvent.LiveGrenade);
    warn.mockRestore();
  });
});

describe('useReplayNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at ply 0 with initial board', () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const evaluationFn = vi.fn().mockResolvedValue(makeEval(0));
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        evaluationFn,
      }),
    );
    expect(result.current.currentPly).toBe(0);
  });

  it('goForward and goBack navigate within bounds', () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        autoEvaluate: false,
      }),
    );
    act(() => { result.current.goForward(); });
    expect(result.current.currentPly).toBe(1);
    act(() => { result.current.goBack(); });
    expect(result.current.currentPly).toBe(0);
    act(() => { result.current.goBack(); });
    expect(result.current.currentPly).toBe(0);
  });

  it('goToLast jumps to total plies', () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        autoEvaluate: false,
      }),
    );
    act(() => { result.current.goToLast(); });
    expect(result.current.currentPly).toBe(game.moves.length);
  });

  it('goToPly clamps out-of-range values', () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        autoEvaluate: false,
      }),
    );
    act(() => { result.current.goToPly(99); });
    expect(result.current.currentPly).toBe(game.moves.length);
    act(() => { result.current.goToPly(-5); });
    expect(result.current.currentPly).toBe(0);
  });

  it('returns active events for the current ply', () => {
    const game = makeGame({
      activeEventsPerPly: [
        [],
        [
          {
            type: CrazyEvent.KingForADay,
            remainingPlies: 4,
            triggeredBy: PC.White,
            triggeredAtPly: 1,
          },
        ],
      ],
    });
    const adapter = makeAdapter({ modeId: 'crazy' });
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        autoEvaluate: false,
      }),
    );
    expect(result.current.currentEvents).toHaveLength(0);
    act(() => { result.current.goForward(); });
    expect(result.current.currentEvents).toHaveLength(1);
  });

  it('requests an evaluation (debounced) and caches it', async () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const evaluationFn = vi.fn().mockResolvedValue(makeEval(0.25));
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        evaluationFn,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVALUATION_DEBOUNCE_MS + 50);
    });
    expect(evaluationFn).toHaveBeenCalledTimes(1);
    expect(result.current.currentEval?.score).toBe(0.25);
  });

  it('returns cached evaluation on revisit without redundant worker call', async () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const evaluationFn = vi.fn().mockResolvedValue(makeEval(0.1));
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        evaluationFn,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVALUATION_DEBOUNCE_MS + 50);
    });
    const callsAfterPly0 = evaluationFn.mock.calls.length;
    // Navigate to ply 1 and let the debounce complete so ply 1 is cached.
    act(() => { result.current.goForward(); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVALUATION_DEBOUNCE_MS + 50);
    });
    const callsAfterPly1 = evaluationFn.mock.calls.length;
    expect(callsAfterPly1).toBe(callsAfterPly0 + 1);
    // Revisit ply 0 — already cached, no new call.
    act(() => { result.current.goBack(); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVALUATION_DEBOUNCE_MS + 50);
    });
    expect(evaluationFn.mock.calls.length).toBe(callsAfterPly1);
  });

  it('debounces evaluation requests during rapid scrubbing', async () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const evaluationFn = vi.fn().mockResolvedValue(makeEval(0));
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        evaluationFn,
      }),
    );
    act(() => { result.current.goForward(); });
    act(() => { result.current.goForward(); });
    act(() => { result.current.goForward(); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVALUATION_DEBOUNCE_MS + 10);
    });
    // Initial ply 0 request is also debounced; both should land on their
    // final plies only — not every intermediate one.
    const calledPlies = new Set(
      evaluationFn.mock.calls.map((c) => (c[0] as BoardState).length),
    );
    expect(evaluationFn.mock.calls.length).toBeLessThanOrEqual(2);
    expect(calledPlies.size).toBeGreaterThan(0);
  });

  it('autoplay advances ply on interval and stops at end', () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        autoEvaluate: false,
      }),
    );
    act(() => { result.current.toggleAutoPlay(); });
    expect(result.current.isAutoPlaying).toBe(true);
    for (let i = 0; i < game.moves.length + 2; i++) {
      act(() => {
        vi.advanceTimersByTime(DEFAULT_AUTOPLAY_INTERVAL_MS);
      });
    }
    expect(result.current.currentPly).toBe(game.moves.length);
    expect(result.current.isAutoPlaying).toBe(false);
  });

  it('autoplay stops when manually navigating', () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        autoEvaluate: false,
      }),
    );
    act(() => { result.current.toggleAutoPlay(); });
    expect(result.current.isAutoPlaying).toBe(true);
    act(() => { result.current.goForward(); });
    expect(result.current.isAutoPlaying).toBe(false);
  });

  it('toggling autoplay at last ply restarts from the beginning', () => {
    const game = makeGame();
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        autoEvaluate: false,
      }),
    );
    act(() => { result.current.goToLast(); });
    expect(result.current.currentPly).toBe(game.moves.length);
    act(() => { result.current.toggleAutoPlay(); });
    expect(result.current.isAutoPlaying).toBe(true);
    expect(result.current.currentPly).toBe(0);
  });

  it('skips evaluation when adapter.supportsEvaluation returns false', async () => {
    const game = makeGame();
    const adapter = makeAdapter({ supportsEvaluation: () => false });
    const evaluationFn = vi.fn().mockResolvedValue(makeEval(0));
    renderHook(() =>
      useReplayNavigation({
        game,
        adapter,
        totalPlies: game.moves.length,
        evaluationFn,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVALUATION_DEBOUNCE_MS + 10);
    });
    expect(evaluationFn).not.toHaveBeenCalled();
  });
});
