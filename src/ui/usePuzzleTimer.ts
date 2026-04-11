/**
 * Count-up stopwatch hook for Challenge mode puzzles.
 *
 * Uses performance.now() for high-resolution timing and
 * requestAnimationFrame for display updates. Pauses automatically
 * when the browser tab loses visibility.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { formatTime, formatPreciseTime } from './challengeGameUtils';

export interface UsePuzzleTimerReturn {
  /** Elapsed time in milliseconds. */
  readonly elapsedMs: number;

  /** Formatted display string: "M:SS". */
  readonly displayTime: string;

  /** Formatted competitive display: "M:SS.T" (with tenths). */
  readonly preciseDisplayTime: string;

  /** Start or resume the timer. */
  readonly start: () => void;

  /** Pause the timer (preserves elapsed). */
  readonly pause: () => void;

  /** Stop the timer permanently. Returns final elapsed ms. */
  readonly stop: () => number;

  /** Reset the timer to zero. */
  readonly reset: () => void;
}

export function usePuzzleTimer(): UsePuzzleTimerReturn {
  const [displayElapsedMs, setDisplayElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const startTimestampRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const pauseTimestampRef = useRef<number | null>(null);
  const finalElapsedMsRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (finalElapsedMsRef.current !== null) return; // Stopped permanently

    const now = performance.now();
    if (startTimestampRef.current === null) {
      // First start
      startTimestampRef.current = now;
    } else if (pauseTimestampRef.current !== null) {
      // Resume from pause
      totalPausedMsRef.current += now - pauseTimestampRef.current;
      pauseTimestampRef.current = null;
    }
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (!isRunning || finalElapsedMsRef.current !== null) return;
    pauseTimestampRef.current = performance.now();
    setIsRunning(false);
  }, [isRunning]);

  const stop = useCallback((): number => {
    if (finalElapsedMsRef.current !== null) return finalElapsedMsRef.current;

    const now = performance.now();
    let elapsed = 0;
    if (startTimestampRef.current !== null) {
      const pauseAccum = pauseTimestampRef.current !== null
        ? totalPausedMsRef.current + (now - pauseTimestampRef.current)
        : totalPausedMsRef.current;
      elapsed = Math.max(0, now - startTimestampRef.current - pauseAccum);
    }
    finalElapsedMsRef.current = elapsed;
    setIsRunning(false);
    setDisplayElapsedMs(elapsed);
    return elapsed;
  }, []);

  const reset = useCallback(() => {
    startTimestampRef.current = null;
    pauseTimestampRef.current = null;
    totalPausedMsRef.current = 0;
    finalElapsedMsRef.current = null;
    setIsRunning(false);
    setDisplayElapsedMs(0);
  }, []);

  // RAF tick loop for display updates
  useEffect(() => {
    if (!isRunning || finalElapsedMsRef.current !== null) return;

    let rafId: number;
    function tick() {
      const now = performance.now();
      if (startTimestampRef.current !== null) {
        const elapsed = now - startTimestampRef.current - totalPausedMsRef.current;
        setDisplayElapsedMs(Math.max(0, elapsed));
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafId); };
  }, [isRunning]);

  // Pause on tab blur, resume on focus
  useEffect(() => {
    function handleVisibilityChange() {
      if (finalElapsedMsRef.current !== null) return;
      if (document.hidden) {
        if (isRunning) {
          pauseTimestampRef.current = performance.now();
          setIsRunning(false);
        }
      } else {
        if (startTimestampRef.current !== null && pauseTimestampRef.current !== null) {
          totalPausedMsRef.current += performance.now() - pauseTimestampRef.current;
          pauseTimestampRef.current = null;
          setIsRunning(true);
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => { document.removeEventListener('visibilitychange', handleVisibilityChange); };
  }, [isRunning]);

  return {
    elapsedMs: displayElapsedMs,
    displayTime: formatTime(displayElapsedMs),
    preciseDisplayTime: formatPreciseTime(displayElapsedMs),
    start,
    pause,
    stop,
    reset,
  };
}
