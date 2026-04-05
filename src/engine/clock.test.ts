import { describe, it, expect } from 'vitest';
import {
  createClock,
  restoreClock,
  startTurn,
  endTurn,
  tick,
  isExpired,
  undoMove,
  pause,
  resume,
  getRemainingTime,
  formatTime,
} from './clock';
import type { TimeControlConfig } from './clock';
import { PieceColor } from './types';

// ===========================================================================
// createClock
// ===========================================================================

describe('createClock', () => {
  it('creates perMove clock with correct initial time', () => {
    const clock = createClock({ mode: 'perMove', perMoveTimeMs: 30_000 });
    expect(clock.remainingWhiteMs).toBe(30_000);
    expect(clock.remainingBlackMs).toBe(30_000);
    expect(clock.activeColor).toBeNull();
    expect(clock.lastTickTimestamp).toBe(0);
    expect(clock.delayRemainingMs).toBeNull();
    expect(clock.pausedColor).toBeNull();
  });

  it('creates suddenDeath clock with correct initial time', () => {
    const clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    expect(clock.remainingWhiteMs).toBe(300_000);
    expect(clock.remainingBlackMs).toBe(300_000);
  });

  it('creates increment clock with correct initial time', () => {
    const clock = createClock({ mode: 'increment', totalTimeMs: 300_000, incrementMs: 2_000 });
    expect(clock.remainingWhiteMs).toBe(300_000);
    expect(clock.remainingBlackMs).toBe(300_000);
    expect(clock.config.incrementMs).toBe(2_000);
  });

  it('creates delay clock with correct initial time', () => {
    const clock = createClock({ mode: 'delay', totalTimeMs: 600_000, delayMs: 5_000 });
    expect(clock.remainingWhiteMs).toBe(600_000);
    expect(clock.remainingBlackMs).toBe(600_000);
    expect(clock.config.delayMs).toBe(5_000);
  });

  it('throws for missing perMoveTimeMs in perMove mode', () => {
    expect(() => createClock({ mode: 'perMove' } as TimeControlConfig)).toThrow();
  });

  it('throws for missing totalTimeMs in suddenDeath mode', () => {
    expect(() => createClock({ mode: 'suddenDeath' } as TimeControlConfig)).toThrow();
  });

  it('throws for missing incrementMs in increment mode', () => {
    expect(() => createClock({ mode: 'increment', totalTimeMs: 300_000 } as TimeControlConfig)).toThrow();
  });

  it('throws for missing delayMs in delay mode', () => {
    expect(() => createClock({ mode: 'delay', totalTimeMs: 600_000 } as TimeControlConfig)).toThrow();
  });

  it('throws for zero or negative time values', () => {
    expect(() => createClock({ mode: 'perMove', perMoveTimeMs: 0 })).toThrow();
    expect(() => createClock({ mode: 'perMove', perMoveTimeMs: -1 })).toThrow();
    expect(() => createClock({ mode: 'suddenDeath', totalTimeMs: 0 })).toThrow();
    expect(() => createClock({ mode: 'suddenDeath', totalTimeMs: -100 })).toThrow();
  });
});

// ===========================================================================
// startTurn
// ===========================================================================

describe('startTurn', () => {
  it('sets activeColor and lastTickTimestamp', () => {
    const clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    const started = startTurn(clock, PieceColor.White, 1000);
    expect(started.activeColor).toBe(PieceColor.White);
    expect(started.lastTickTimestamp).toBe(1000);
  });

  it('sets delayRemainingMs in delay mode', () => {
    const clock = createClock({ mode: 'delay', totalTimeMs: 600_000, delayMs: 5_000 });
    const started = startTurn(clock, PieceColor.White, 1000);
    expect(started.delayRemainingMs).toBe(5_000);
  });

  it('sets delayRemainingMs to null in non-delay mode', () => {
    const clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    const started = startTurn(clock, PieceColor.White, 1000);
    expect(started.delayRemainingMs).toBeNull();
  });
});

// ===========================================================================
// tick
// ===========================================================================

describe('tick', () => {
  it('deducts from active player only', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const ticked = tick(clock, 2000);
    expect(ticked.remainingWhiteMs).toBe(299_000);
    expect(ticked.remainingBlackMs).toBe(300_000);
  });

  it('does nothing when clock is paused', () => {
    const clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    const ticked = tick(clock, 5000);
    expect(ticked.remainingWhiteMs).toBe(300_000);
    expect(ticked.remainingBlackMs).toBe(300_000);
  });

  it('does not deduct for zero elapsed time', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const ticked = tick(clock, 1000);
    expect(ticked.remainingWhiteMs).toBe(300_000);
  });

  it('clamps at zero (no negative time)', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 5_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const ticked = tick(clock, 100_000);
    expect(ticked.remainingWhiteMs).toBe(0);
  });

  it('delay mode: elapsed within delay window', () => {
    let clock = createClock({ mode: 'delay', totalTimeMs: 600_000, delayMs: 5_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const ticked = tick(clock, 3000); // 2s elapsed, within 5s delay
    expect(ticked.delayRemainingMs).toBe(3_000);
    expect(ticked.remainingWhiteMs).toBe(600_000); // main time untouched
  });

  it('delay mode: elapsed exceeds delay window', () => {
    let clock = createClock({ mode: 'delay', totalTimeMs: 600_000, delayMs: 5_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const ticked = tick(clock, 8000); // 7s elapsed, 5s delay + 2s overflow
    expect(ticked.delayRemainingMs).toBe(0);
    expect(ticked.remainingWhiteMs).toBe(598_000); // 600000 - 2000
  });

  it('delay mode: delay already exhausted', () => {
    let clock = createClock({ mode: 'delay', totalTimeMs: 600_000, delayMs: 5_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = tick(clock, 7000); // exhaust delay (6s elapsed, 5s delay + 1s overflow)
    expect(clock.delayRemainingMs).toBe(0);
    const ticked = tick(clock, 9000); // 2s more
    expect(ticked.remainingWhiteMs).toBe(600_000 - 1_000 - 2_000);
  });

  it('multiple consecutive ticks accumulate correctly', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = tick(clock, 2000);
    clock = tick(clock, 3000);
    clock = tick(clock, 4000);
    expect(clock.remainingWhiteMs).toBe(297_000);
  });

  it('updates lastTickTimestamp', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const ticked = tick(clock, 5000);
    expect(ticked.lastTickTimestamp).toBe(5000);
  });
});

// ===========================================================================
// endTurn
// ===========================================================================

describe('endTurn', () => {
  it('deducts elapsed time and pauses in suddenDeath', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const ended = endTurn(clock, 4000); // 3s elapsed
    expect(ended.remainingWhiteMs).toBe(297_000);
    expect(ended.activeColor).toBeNull();
  });

  it('resets time in perMove mode', () => {
    let clock = createClock({ mode: 'perMove', perMoveTimeMs: 30_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = tick(clock, 6000); // 5s used
    const ended = endTurn(clock, 6000);
    expect(ended.remainingWhiteMs).toBe(30_000);
  });

  it('adds increment in increment mode', () => {
    let clock = createClock({ mode: 'increment', totalTimeMs: 300_000, incrementMs: 2_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const ended = endTurn(clock, 6000); // 5s elapsed, +2s increment
    expect(ended.remainingWhiteMs).toBe(300_000 - 5_000 + 2_000);
  });

  it('no adjustment in delay mode', () => {
    let clock = createClock({ mode: 'delay', totalTimeMs: 600_000, delayMs: 5_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const ended = endTurn(clock, 8000); // 7s elapsed: 5s delay + 2s main
    expect(ended.remainingWhiteMs).toBe(598_000);
    expect(ended.delayRemainingMs).toBeNull();
  });

  it('no-op on already-paused clock', () => {
    const clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    const ended = endTurn(clock, 5000);
    expect(ended).toEqual(clock);
  });
});

// ===========================================================================
// isExpired
// ===========================================================================

describe('isExpired', () => {
  it('returns false when time remains', () => {
    const clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    expect(isExpired(clock, PieceColor.White)).toBe(false);
  });

  it('returns true at exactly zero', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 5_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = tick(clock, 6000); // exactly 5s
    expect(isExpired(clock, PieceColor.White)).toBe(true);
  });

  it('returns true below zero (edge case)', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 5_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = tick(clock, 100_000);
    expect(isExpired(clock, PieceColor.White)).toBe(true);
  });
});

// ===========================================================================
// undoMove
// ===========================================================================

describe('undoMove', () => {
  it('restores consumed time in suddenDeath', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = endTurn(clock, 6000); // 5s consumed
    const undone = undoMove(clock, PieceColor.White, 5_000);
    expect(undone.remainingWhiteMs).toBe(300_000);
  });

  it('resets timer in perMove mode', () => {
    let clock = createClock({ mode: 'perMove', perMoveTimeMs: 30_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = endTurn(clock, 6000);
    const undone = undoMove(clock, PieceColor.White, 5_000);
    expect(undone.remainingWhiteMs).toBe(30_000);
  });

  it('subtracts increment in increment mode', () => {
    let clock = createClock({ mode: 'increment', totalTimeMs: 300_000, incrementMs: 2_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = endTurn(clock, 6000); // 5s consumed + 2s increment = 297_000
    // undo: +5000 (elapsed) -2000 (remove increment) = net +3000
    const undone = undoMove(clock, PieceColor.White, 5_000);
    expect(undone.remainingWhiteMs).toBe(300_000);
  });
});

// ===========================================================================
// pause / resume
// ===========================================================================

describe('pause / resume', () => {
  it('pause stops the clock and stores pausedColor', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    const paused = pause(clock, 3000);
    expect(paused.activeColor).toBeNull();
    expect(paused.pausedColor).toBe(PieceColor.White);
    expect(paused.remainingWhiteMs).toBe(298_000); // 2s deducted
  });

  it('no time passes during pause', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = pause(clock, 3000);
    const ticked = tick(clock, 100_000); // huge elapsed
    expect(ticked.remainingWhiteMs).toBe(298_000); // unchanged
  });

  it('resume restores active color and clears pausedColor', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = pause(clock, 3000);
    const resumed = resume(clock, 10_000);
    expect(resumed.activeColor).toBe(PieceColor.White);
    expect(resumed.pausedColor).toBeNull();
    expect(resumed.lastTickTimestamp).toBe(10_000);
  });

  it('resume resets lastTickTimestamp so pause time is not counted', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = pause(clock, 3000); // 2s used → 298_000
    clock = resume(clock, 50_000); // 47s paused
    clock = tick(clock, 51_000); // 1s after resume
    expect(clock.remainingWhiteMs).toBe(297_000); // 298_000 - 1_000
  });

  it('pause in delay mode preserves delayRemainingMs', () => {
    let clock = createClock({ mode: 'delay', totalTimeMs: 600_000, delayMs: 5_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = tick(clock, 3000); // 2s of delay used → 3_000 delay remaining
    const paused = pause(clock, 3000);
    expect(paused.delayRemainingMs).toBe(3_000);
    const resumed = resume(paused, 50_000);
    expect(resumed.delayRemainingMs).toBe(3_000);
  });
});

// ===========================================================================
// getRemainingTime
// ===========================================================================

describe('getRemainingTime', () => {
  it('returns correct time for each color', () => {
    const clock = restoreClock(
      { mode: 'suddenDeath', totalTimeMs: 300_000 },
      100_000,
      200_000,
    );
    expect(getRemainingTime(clock, PieceColor.White)).toBe(100_000);
    expect(getRemainingTime(clock, PieceColor.Black)).toBe(200_000);
  });
});

// ===========================================================================
// formatTime
// ===========================================================================

describe('formatTime', () => {
  it('formats 1h 1m 1s', () => {
    expect(formatTime(3_661_000)).toBe('1:01:01');
  });

  it('formats 5 min', () => {
    expect(formatTime(300_000)).toBe('05:00');
  });

  it('formats 1m 5s', () => {
    expect(formatTime(65_000)).toBe('01:05');
  });

  it('formats < 30s with tenths', () => {
    expect(formatTime(29_999)).toBe('29.9');
  });

  it('formats 5.1s', () => {
    expect(formatTime(5_100)).toBe('5.1');
  });

  it('formats 0ms', () => {
    expect(formatTime(0)).toBe('0.0');
  });

  it('formats negative ms as 0.0', () => {
    expect(formatTime(-100)).toBe('0.0');
  });
});

// ===========================================================================
// restoreClock
// ===========================================================================

describe('restoreClock', () => {
  it('restores with custom remaining times', () => {
    const clock = restoreClock(
      { mode: 'suddenDeath', totalTimeMs: 300_000 },
      150_000,
      200_000,
    );
    expect(clock.remainingWhiteMs).toBe(150_000);
    expect(clock.remainingBlackMs).toBe(200_000);
    expect(clock.config.mode).toBe('suddenDeath');
  });

  it('restored clock is functional', () => {
    let clock = restoreClock(
      { mode: 'increment', totalTimeMs: 300_000, incrementMs: 2_000 },
      100_000,
      200_000,
    );
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = tick(clock, 4000); // 3s
    clock = endTurn(clock, 4000);
    expect(clock.remainingWhiteMs).toBe(100_000 - 3_000 + 2_000);
  });
});

// ===========================================================================
// Integration Scenarios
// ===========================================================================

describe('integration scenarios', () => {
  it('full game sequence: create → turns → tick → endTurn', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 300_000 });

    // White's turn: 5s
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = tick(clock, 3000);
    clock = endTurn(clock, 6000);

    // Black's turn: 3s
    clock = startTurn(clock, PieceColor.Black, 6000);
    clock = tick(clock, 8000);
    clock = endTurn(clock, 9000);

    expect(clock.remainingWhiteMs).toBe(295_000);
    expect(clock.remainingBlackMs).toBe(297_000);
    expect(clock.activeColor).toBeNull();
  });

  it('increment accumulates over multiple turns', () => {
    let clock = createClock({ mode: 'increment', totalTimeMs: 300_000, incrementMs: 2_000 });

    for (let i = 0; i < 3; i++) {
      clock = startTurn(clock, PieceColor.White, i * 10_000);
      clock = endTurn(clock, i * 10_000 + 1_000); // 1s per move
    }

    // 3 moves × 1s consumed + 3 moves × 2s increment = -3000 + 6000 = +3000
    expect(clock.remainingWhiteMs).toBe(303_000);
  });

  it('perMove timer resets every turn', () => {
    let clock = createClock({ mode: 'perMove', perMoveTimeMs: 30_000 });

    clock = startTurn(clock, PieceColor.White, 1000);
    clock = endTurn(clock, 11_000); // 10s used
    expect(clock.remainingWhiteMs).toBe(30_000); // reset

    clock = startTurn(clock, PieceColor.White, 20_000);
    clock = endTurn(clock, 35_000); // 15s used
    expect(clock.remainingWhiteMs).toBe(30_000); // reset again
  });

  it('delay absorbs short turns completely', () => {
    let clock = createClock({ mode: 'delay', totalTimeMs: 600_000, delayMs: 5_000 });

    clock = startTurn(clock, PieceColor.White, 1000);
    clock = endTurn(clock, 4000); // 3s turn, within 5s delay
    expect(clock.remainingWhiteMs).toBe(600_000); // zero main time consumed
  });

  it('time expiry mid-turn', () => {
    let clock = createClock({ mode: 'suddenDeath', totalTimeMs: 5_000 });
    clock = startTurn(clock, PieceColor.White, 1000);
    clock = tick(clock, 6000); // 5s → exactly zero
    expect(isExpired(clock, PieceColor.White)).toBe(true);
    expect(isExpired(clock, PieceColor.Black)).toBe(false);
  });
});
