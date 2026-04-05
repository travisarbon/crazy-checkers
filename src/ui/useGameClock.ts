/**
 * useGameClock — manages the ClockState lifecycle for timed games.
 *
 * Drives ticking via requestAnimationFrame, pauses on tab visibility changes
 * and during animations, handles turn transitions, undo time restoration,
 * and CPU turn suppression.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { PieceColor, PlayerSetup } from '../engine/types';
import { PieceColor as PC, PlayerType } from '../engine/types';
import type { ClockState, TimeControlConfig } from '../engine/clock';
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
} from '../engine/clock';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseGameClockOptions {
  config: TimeControlConfig | null;
  activeColor: PieceColor;
  isGameOver: boolean;
  isAnimating: boolean;
  isAIThinking: boolean;
  players: PlayerSetup;
  plyCount: number;
  /** Saved remaining time for White (ms). When provided with config, restores clock state. */
  initialRemainingWhiteMs?: number;
  /** Saved remaining time for Black (ms). When provided with config, restores clock state. */
  initialRemainingBlackMs?: number;
}

interface UseGameClockReturn {
  clockState: ClockState | null;
  whiteTimeDisplay: string;
  blackTimeDisplay: string;
  whiteLowTime: boolean;
  blackLowTime: boolean;
  expiredColor: PieceColor | null;
  onMoveComplete: () => void;
  onUndo: (movesUndone: number) => void;
  isTicking: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOW_TIME_THRESHOLD_MS = 30_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameClock({
  config,
  activeColor,
  isGameOver,
  isAnimating,
  isAIThinking,
  players,
  plyCount,
  initialRemainingWhiteMs,
  initialRemainingBlackMs,
}: UseGameClockOptions): UseGameClockReturn {
  // --- Clock state ---
  const [clockState, setClockState] = useState<ClockState | null>(() => {
    if (!config) return null;
    if (initialRemainingWhiteMs !== undefined && initialRemainingBlackMs !== undefined) {
      return restoreClock(config, initialRemainingWhiteMs, initialRemainingBlackMs);
    }
    return createClock(config);
  });

  // --- Refs ---
  const rafRef = useRef(0);
  const timeHistoryRef = useRef<Array<{ color: PieceColor; remainingMs: number }>>([]);
  const lowTimeAnnouncedRef = useRef<{ white: boolean; black: boolean }>({
    white: false,
    black: false,
  });
  const prevPlyCountRef = useRef(plyCount);
  const clockStateRef = useRef(clockState);

  // Keep ref in sync
  useEffect(() => {
    clockStateRef.current = clockState;
  }, [clockState]);

  // --- Derived: is it a human's turn? ---
  const isHumanTurn = useMemo(() => {
    if (activeColor === PC.White) return players.white === PlayerType.Human;
    return players.black === PlayerType.Human;
  }, [activeColor, players]);

  // --- Combined "should tick" boolean (§12.7) ---
  const shouldTick =
    clockState !== null &&
    !isGameOver &&
    !isAnimating &&
    isHumanTurn &&
    !isAIThinking;

  // --- RAF tick loop (§5.3.1) ---
  useEffect(() => {
    if (!shouldTick) return;

    function loop() {
      const now = performance.now();
      setClockState((prev) => (prev ? tick(prev, now) : null));
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [shouldTick]);

  // --- Turn change detection (§5.3.2) ---
  useEffect(() => {
    if (!clockState) return;

    const prevPly = prevPlyCountRef.current;
    prevPlyCountRef.current = plyCount;

    if (plyCount === 0 && prevPly === 0) {
      // Game start: begin first turn
      const now = performance.now();
      setClockState((prev) => (prev ? startTurn(prev, activeColor, now) : null));
      return;
    }

    if (plyCount > prevPly) {
      // A move was committed — endTurn + startTurn
      const now = performance.now();
      setClockState((prev) => {
        if (!prev) return null;
        const ended = endTurn(prev, now);
        return startTurn(ended, activeColor, now);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plyCount, activeColor]);

  // --- Animation pause/resume (§5.3.3) ---
  const wasAnimatingRef = useRef(isAnimating);
  useEffect(() => {
    if (!clockState) return;
    const wasAnimating = wasAnimatingRef.current;
    wasAnimatingRef.current = isAnimating;

    if (isAnimating && !wasAnimating) {
      const now = performance.now();
      setClockState((prev) => (prev && prev.activeColor !== null ? pause(prev, now) : prev));
    } else if (!isAnimating && wasAnimating) {
      const now = performance.now();
      setClockState((prev) => (prev && prev.pausedColor !== null ? resume(prev, now) : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating]);

  // --- Page Visibility API (§5.3.4) ---
  useEffect(() => {
    if (!clockState) return;

    function handleVisibility() {
      const now = performance.now();
      if (document.hidden) {
        setClockState((prev) =>
          prev && prev.activeColor !== null ? pause(prev, now) : prev,
        );
      } else {
        setClockState((prev) =>
          prev && prev.pausedColor !== null ? resume(prev, now) : prev,
        );
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockState !== null]);

  // --- Expiration detection (§5.3.6) ---
  const expiredColor = useMemo(() => {
    if (!clockState) return null;
    if (isExpired(clockState, PC.White)) return PC.White;
    if (isExpired(clockState, PC.Black)) return PC.Black;
    return null;
  }, [clockState]);

  // --- Low-time detection (§5.3.7) ---
  const whiteLowTime = clockState ? getRemainingTime(clockState, PC.White) < LOW_TIME_THRESHOLD_MS && getRemainingTime(clockState, PC.White) > 0 : false;
  const blackLowTime = clockState ? getRemainingTime(clockState, PC.Black) < LOW_TIME_THRESHOLD_MS && getRemainingTime(clockState, PC.Black) > 0 : false;

  // Track first crossing of threshold for audio
  useEffect(() => {
    if (whiteLowTime && !lowTimeAnnouncedRef.current.white) {
      lowTimeAnnouncedRef.current.white = true;
    }
    if (blackLowTime && !lowTimeAnnouncedRef.current.black) {
      lowTimeAnnouncedRef.current.black = true;
    }
  }, [whiteLowTime, blackLowTime]);

  // --- onMoveComplete callback (§5.3.8 time history) ---
  const onMoveComplete = useCallback(() => {
    const cs = clockStateRef.current;
    if (!cs) return;
    const color = cs.activeColor ?? cs.pausedColor;
    if (color) {
      timeHistoryRef.current.push({
        color,
        remainingMs: getRemainingTime(cs, color),
      });
    }
  }, []);

  // --- onUndo callback (§5.3.8) ---
  const onUndo = useCallback((movesUndone: number) => {
    setClockState((prev) => {
      if (!prev) return null;
      let cs = prev;
      for (let i = 0; i < movesUndone; i++) {
        const entry = timeHistoryRef.current.pop();
        if (!entry) break;
        const elapsed = entry.remainingMs - getRemainingTime(cs, entry.color);
        cs = undoMove(cs, entry.color, Math.max(0, elapsed));
      }
      return cs;
    });
  }, []);

  // --- Formatted display ---
  const whiteTimeDisplay = clockState ? formatTime(getRemainingTime(clockState, PC.White)) : '';
  const blackTimeDisplay = clockState ? formatTime(getRemainingTime(clockState, PC.Black)) : '';

  // --- isTicking ---
  // shouldTick guarantees clockState !== null
  const isTicking = shouldTick && clockState.activeColor !== null;

  return {
    clockState,
    whiteTimeDisplay,
    blackTimeDisplay,
    whiteLowTime,
    blackLowTime,
    expiredColor,
    onMoveComplete,
    onUndo,
    isTicking,
  };
}
