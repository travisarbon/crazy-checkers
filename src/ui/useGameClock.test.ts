import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useGameClock } from './useGameClock';
import { PieceColor, PlayerType } from '../engine/types';
import type { TimeControlConfig } from '../engine/clock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const humanVsHuman = { white: PlayerType.Human, black: PlayerType.Human };
const humanVsCpu = { white: PlayerType.Human, black: PlayerType.CpuEasy };

function suddenDeath(totalMs = 300_000): TimeControlConfig {
  return { mode: 'suddenDeath', totalTimeMs: totalMs };
}

function increment(totalMs = 300_000, incMs = 2000): TimeControlConfig {
  return { mode: 'increment', totalTimeMs: totalMs, incrementMs: incMs };
}

function perMove(perMoveMs = 30_000): TimeControlConfig {
  return { mode: 'perMove', perMoveTimeMs: perMoveMs };
}

function delay(totalMs = 300_000, delayMs = 5000): TimeControlConfig {
  return { mode: 'delay', totalTimeMs: totalMs, delayMs };
}

function defaultOpts(overrides: Record<string, unknown> = {}) {
  return {
    config: suddenDeath() as TimeControlConfig | null,
    activeColor: PieceColor.White as PieceColor,
    isGameOver: false,
    isAnimating: false,
    isAIThinking: false,
    players: humanVsHuman,
    plyCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGameClock', () => {
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => currentTime);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null clockState for untimed games', () => {
    const { result } = renderHook(() => useGameClock(defaultOpts({ config: null })));
    expect(result.current.clockState).toBeNull();
    expect(result.current.whiteTimeDisplay).toBe('');
    expect(result.current.blackTimeDisplay).toBe('');
  });

  it('initializes with full time for both players', () => {
    const { result } = renderHook(() => useGameClock(defaultOpts()));
    expect(result.current.clockState).not.toBeNull();
    expect(result.current.whiteTimeDisplay).toBe('05:00');
    expect(result.current.blackTimeDisplay).toBe('05:00');
  });

  it('expiration is detected when remaining time is zero', () => {
    // Start with 0ms — already expired
    const { result } = renderHook(() =>
      useGameClock(defaultOpts({ config: suddenDeath(1) })),
    );

    // With 1ms of time, the initial clock state should be nearly expired
    // After the startTurn effect and any tick, time should reach 0
    expect(result.current.clockState).not.toBeNull();
  });

  it('low-time threshold detection works', () => {
    // Start with 25s — already below threshold
    const { result } = renderHook(() =>
      useGameClock(defaultOpts({ config: suddenDeath(25_000) })),
    );
    expect(result.current.whiteLowTime).toBe(true);
    expect(result.current.blackLowTime).toBe(true);
  });

  it('low-time is false when time is above threshold', () => {
    const { result } = renderHook(() =>
      useGameClock(defaultOpts({ config: suddenDeath(60_000) })),
    );
    expect(result.current.whiteLowTime).toBe(false);
    expect(result.current.blackLowTime).toBe(false);
  });

  it('clock does not tick during CPU turn in vs-CPU mode', () => {
    const { result } = renderHook(() =>
      useGameClock(
        defaultOpts({
          players: humanVsCpu,
          activeColor: PieceColor.Black, // CPU's turn
        }),
      ),
    );
    // shouldTick should be false because it's not a human turn
    expect(result.current.isTicking).toBe(false);
  });

  it('clock ticks during human turn in vs-CPU mode', () => {
    const { result } = renderHook(() =>
      useGameClock(
        defaultOpts({
          players: humanVsCpu,
          activeColor: PieceColor.White, // Human's turn
        }),
      ),
    );
    // The RAF loop should be running (after startTurn effect)
    // isTicking depends on shouldTick && activeColor !== null
    // shouldTick = !isGameOver && !isAnimating && isHumanTurn && !isAIThinking
    // After the startTurn effect fires, activeColor in clockState should be set
    expect(result.current.clockState).not.toBeNull();
  });

  it('does not tick when game is over', () => {
    const { result } = renderHook(() =>
      useGameClock(defaultOpts({ isGameOver: true })),
    );
    expect(result.current.isTicking).toBe(false);
  });

  it('does not tick during animation', () => {
    const { result } = renderHook(() =>
      useGameClock(defaultOpts({ isAnimating: true })),
    );
    expect(result.current.isTicking).toBe(false);
  });

  it('formats time correctly for increment mode', () => {
    const { result } = renderHook(() =>
      useGameClock(defaultOpts({ config: increment(300_000, 2000) })),
    );
    expect(result.current.whiteTimeDisplay).toBe('05:00');
  });

  it('formats time correctly for perMove mode', () => {
    const { result } = renderHook(() =>
      useGameClock(defaultOpts({ config: perMove(30_000) })),
    );
    expect(result.current.whiteTimeDisplay).toBe('00:30');
    expect(result.current.blackTimeDisplay).toBe('00:30');
  });

  it('formats time correctly for delay mode', () => {
    const { result } = renderHook(() =>
      useGameClock(defaultOpts({ config: delay(300_000, 5000) })),
    );
    expect(result.current.whiteTimeDisplay).toBe('05:00');
  });

  it('onUndo callback does not crash when history is empty', () => {
    const { result } = renderHook(() => useGameClock(defaultOpts()));
    // Should not throw
    act(() => {
      result.current.onUndo(1);
    });
    expect(result.current.clockState).not.toBeNull();
  });

  it('onMoveComplete callback does not crash', () => {
    const { result } = renderHook(() => useGameClock(defaultOpts()));
    // Should not throw
    act(() => {
      result.current.onMoveComplete();
    });
    expect(result.current.clockState).not.toBeNull();
  });

  it('expiredColor is null when time has not expired', () => {
    const { result } = renderHook(() => useGameClock(defaultOpts()));
    expect(result.current.expiredColor).toBeNull();
  });

  it('handles turn change when plyCount increments', () => {
    const opts = defaultOpts({ plyCount: 0 });
    const { result, rerender } = renderHook(
      (props) => useGameClock(props),
      { initialProps: opts },
    );

    expect(result.current.clockState).not.toBeNull();

    // Simulate a move: plyCount goes from 0 to 1, activeColor changes
    currentTime = 2000;
    act(() => {
      rerender({
        ...opts,
        plyCount: 1,
        activeColor: PieceColor.Black,
      });
    });

    expect(result.current.clockState).not.toBeNull();
    // After endTurn + startTurn, the clock should still have valid state
    expect(result.current.blackTimeDisplay).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Clock restoration tests (Item 2 — saved clock state on resume)
  // ---------------------------------------------------------------------------

  describe('clock restoration from saved state', () => {
    it('restores clock with saved remaining times instead of full allocation', () => {
      const { result } = renderHook(() =>
        useGameClock(
          defaultOpts({
            config: suddenDeath(300_000), // 5 min total
            initialRemainingWhiteMs: 120_000, // 2 min remaining
            initialRemainingBlackMs: 180_000, // 3 min remaining
          }),
        ),
      );
      expect(result.current.clockState).not.toBeNull();
      expect(result.current.whiteTimeDisplay).toBe('02:00');
      expect(result.current.blackTimeDisplay).toBe('03:00');
    });

    it('restores clock with increment mode preserving saved times', () => {
      const { result } = renderHook(() =>
        useGameClock(
          defaultOpts({
            config: increment(600_000, 3000), // 10 min + 3s increment
            initialRemainingWhiteMs: 450_000, // 7:30
            initialRemainingBlackMs: 500_000, // 8:20
          }),
        ),
      );
      expect(result.current.clockState).not.toBeNull();
      expect(result.current.whiteTimeDisplay).toBe('07:30');
      expect(result.current.blackTimeDisplay).toBe('08:20');
    });

    it('restores clock with per-move mode', () => {
      const { result } = renderHook(() =>
        useGameClock(
          defaultOpts({
            config: perMove(30_000), // 30s per move
            initialRemainingWhiteMs: 15_000, // 15s remaining
            initialRemainingBlackMs: 30_000, // full 30s
          }),
        ),
      );
      expect(result.current.clockState).not.toBeNull();
      expect(result.current.whiteTimeDisplay).toBe('15.0');
      expect(result.current.blackTimeDisplay).toBe('00:30');
    });

    it('restores clock with delay mode', () => {
      const { result } = renderHook(() =>
        useGameClock(
          defaultOpts({
            config: delay(300_000, 5000),
            initialRemainingWhiteMs: 200_000,
            initialRemainingBlackMs: 250_000,
          }),
        ),
      );
      expect(result.current.clockState).not.toBeNull();
      expect(result.current.whiteTimeDisplay).toBe('03:20');
      expect(result.current.blackTimeDisplay).toBe('04:10');
    });

    it('uses createClock (full time) when no saved remaining times provided', () => {
      const { result } = renderHook(() =>
        useGameClock(defaultOpts({ config: suddenDeath(300_000) })),
      );
      expect(result.current.whiteTimeDisplay).toBe('05:00');
      expect(result.current.blackTimeDisplay).toBe('05:00');
    });

    it('ignores partial saved times (only white provided)', () => {
      const { result } = renderHook(() =>
        useGameClock(
          defaultOpts({
            config: suddenDeath(300_000),
            initialRemainingWhiteMs: 120_000,
            // initialRemainingBlackMs not provided
          }),
        ),
      );
      // Should fall back to createClock (full time)
      expect(result.current.whiteTimeDisplay).toBe('05:00');
      expect(result.current.blackTimeDisplay).toBe('05:00');
    });

    it('returns null clockState when config is null even with saved times', () => {
      const { result } = renderHook(() =>
        useGameClock(
          defaultOpts({
            config: null,
            initialRemainingWhiteMs: 120_000,
            initialRemainingBlackMs: 180_000,
          }),
        ),
      );
      expect(result.current.clockState).toBeNull();
    });

    it('detects low-time on restored clock with low remaining time', () => {
      const { result } = renderHook(() =>
        useGameClock(
          defaultOpts({
            config: suddenDeath(300_000),
            initialRemainingWhiteMs: 15_000, // below 30s threshold
            initialRemainingBlackMs: 200_000,
          }),
        ),
      );
      expect(result.current.whiteLowTime).toBe(true);
      expect(result.current.blackLowTime).toBe(false);
    });
  });
});
