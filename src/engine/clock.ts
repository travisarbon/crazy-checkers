/**
 * Game Clock Engine — pure functions over immutable ClockState.
 *
 * Tracks remaining time for both players across four time control modes:
 * perMove, suddenDeath, increment (Fischer), and delay (Bronstein).
 *
 * The module never calls performance.now() — timestamps are always injected
 * by the caller, enabling deterministic testing.
 */

import type { PieceColor } from './types';

// ─── Configuration ───────────────────────────────────────────────────────────

/** The four supported time control modes (Design Document §2.10.1). */
export type TimeControlMode = 'perMove' | 'suddenDeath' | 'increment' | 'delay';

/**
 * Configuration for a timed game. Which optional fields are meaningful
 * depends on the mode:
 *
 *   perMove      → perMoveTimeMs (required)
 *   suddenDeath  → totalTimeMs   (required)
 *   increment    → totalTimeMs   (required), incrementMs (required)
 *   delay        → totalTimeMs   (required), delayMs     (required)
 */
export interface TimeControlConfig {
  readonly mode: TimeControlMode;
  readonly totalTimeMs?: number;
  readonly perMoveTimeMs?: number;
  readonly incrementMs?: number;
  readonly delayMs?: number;
}

// ─── Runtime State ───────────────────────────────────────────────────────────

/**
 * Immutable snapshot of both players' clocks at a point in time.
 * All time values are in milliseconds.
 */
export interface ClockState {
  readonly config: TimeControlConfig;
  readonly remainingWhiteMs: number;
  readonly remainingBlackMs: number;
  readonly activeColor: PieceColor | null;
  readonly lastTickTimestamp: number;
  readonly delayRemainingMs: number | null;
  /** Tracks which color was active before a pause, so resume() can restore it. */
  readonly pausedColor: PieceColor | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRemaining(clock: ClockState, color: PieceColor): number {
  return color === 'WHITE' ? clock.remainingWhiteMs : clock.remainingBlackMs;
}

function setRemaining(clock: ClockState, color: PieceColor, ms: number): ClockState {
  return color === 'WHITE'
    ? { ...clock, remainingWhiteMs: ms }
    : { ...clock, remainingBlackMs: ms };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Initialize a clock for a new timed game with full time for both players. */
export function createClock(config: TimeControlConfig): ClockState {
  let initialMs: number;

  switch (config.mode) {
    case 'perMove':
      if (config.perMoveTimeMs == null || config.perMoveTimeMs <= 0) {
        throw new Error('perMove mode requires perMoveTimeMs > 0');
      }
      initialMs = config.perMoveTimeMs;
      break;
    case 'suddenDeath':
      if (config.totalTimeMs == null || config.totalTimeMs <= 0) {
        throw new Error('suddenDeath mode requires totalTimeMs > 0');
      }
      initialMs = config.totalTimeMs;
      break;
    case 'increment':
      if (config.totalTimeMs == null || config.totalTimeMs <= 0) {
        throw new Error('increment mode requires totalTimeMs > 0');
      }
      if (config.incrementMs == null || config.incrementMs < 0) {
        throw new Error('increment mode requires incrementMs >= 0');
      }
      initialMs = config.totalTimeMs;
      break;
    case 'delay':
      if (config.totalTimeMs == null || config.totalTimeMs <= 0) {
        throw new Error('delay mode requires totalTimeMs > 0');
      }
      if (config.delayMs == null || config.delayMs < 0) {
        throw new Error('delay mode requires delayMs >= 0');
      }
      initialMs = config.totalTimeMs;
      break;
  }

  return {
    config,
    remainingWhiteMs: initialMs,
    remainingBlackMs: initialMs,
    activeColor: null,
    lastTickTimestamp: 0,
    delayRemainingMs: null,
    pausedColor: null,
  };
}

/** Restore a clock from persisted data with custom remaining times. */
export function restoreClock(
  config: TimeControlConfig,
  remainingWhiteMs: number,
  remainingBlackMs: number,
): ClockState {
  return {
    ...createClock(config),
    remainingWhiteMs,
    remainingBlackMs,
  };
}

/** Begin counting down the clock for the specified player. */
export function startTurn(clock: ClockState, color: PieceColor, nowMs: number): ClockState {
  return {
    ...clock,
    activeColor: color,
    lastTickTimestamp: nowMs,
    delayRemainingMs: clock.config.mode === 'delay' ? (clock.config.delayMs ?? 0) : null,
    pausedColor: null,
  };
}

/** Stop the active player's clock and apply post-move adjustments. */
export function endTurn(clock: ClockState, nowMs: number): ClockState {
  const ticked = tick(clock, nowMs);
  const color = ticked.activeColor;
  if (color === null) return ticked;

  let result: ClockState = { ...ticked, activeColor: null, delayRemainingMs: null };

  switch (ticked.config.mode) {
    case 'perMove':
      result = setRemaining(result, color, ticked.config.perMoveTimeMs ?? 0);
      break;
    case 'increment':
      result = setRemaining(result, color, getRemaining(result, color) + (ticked.config.incrementMs ?? 0));
      break;
    case 'suddenDeath':
    case 'delay':
      break;
  }

  return result;
}

/** Advance the active player's clock by elapsed time since the last tick. */
export function tick(clock: ClockState, nowMs: number): ClockState {
  if (clock.activeColor === null) return clock;

  const elapsedMs = nowMs - clock.lastTickTimestamp;
  if (elapsedMs <= 0) {
    return { ...clock, lastTickTimestamp: nowMs };
  }

  const color = clock.activeColor;
  let remaining = getRemaining(clock, color);
  let delayRemainingMs = clock.delayRemainingMs;

  if (clock.config.mode === 'delay' && delayRemainingMs !== null && delayRemainingMs > 0) {
    const afterDelay = delayRemainingMs - elapsedMs;
    if (afterDelay >= 0) {
      delayRemainingMs = afterDelay;
    } else {
      remaining = Math.max(0, remaining + afterDelay); // afterDelay is negative = overflow
      delayRemainingMs = 0;
    }
  } else {
    remaining = Math.max(0, remaining - elapsedMs);
  }

  return {
    ...setRemaining(clock, color, remaining),
    lastTickTimestamp: nowMs,
    delayRemainingMs,
  };
}

/** Check if a player has run out of time. */
export function isExpired(clock: ClockState, color: PieceColor): boolean {
  return getRemaining(clock, color) <= 0;
}

/** Restore time consumed by an undone move. */
export function undoMove(clock: ClockState, color: PieceColor, elapsedMs: number): ClockState {
  if (clock.config.mode === 'perMove') {
    return setRemaining(clock, color, clock.config.perMoveTimeMs ?? 0);
  }

  let restored = getRemaining(clock, color) + elapsedMs;
  if (clock.config.mode === 'increment') {
    restored -= clock.config.incrementMs ?? 0;
  }

  return setRemaining(clock, color, restored);
}

/** Pause the clock without ending a turn. */
export function pause(clock: ClockState, nowMs: number): ClockState {
  const ticked = tick(clock, nowMs);
  return {
    ...ticked,
    pausedColor: ticked.activeColor,
    activeColor: null,
  };
}

/** Resume the clock after a pause. */
export function resume(clock: ClockState, nowMs: number): ClockState {
  return {
    ...clock,
    activeColor: clock.pausedColor,
    pausedColor: null,
    lastTickTimestamp: nowMs,
  };
}

/** Convenience accessor for a player's remaining time. */
export function getRemainingTime(clock: ClockState, color: PieceColor): number {
  return getRemaining(clock, color);
}

/** Format a millisecond value into a display string. */
export function formatTime(ms: number): string {
  if (ms <= 0) return '0.0';

  if (ms >= 3_600_000) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  if (ms >= 30_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // < 30 seconds: show tenths
  const s = Math.floor(ms / 1_000);
  const tenths = Math.floor((ms % 1_000) / 100);
  return `${String(s)}.${String(tenths)}`;
}
