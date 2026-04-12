/**
 * useReplayNavigation — state & side-effects for the Replay tool.
 *
 * Encapsulates:
 *   - Ply navigation (go to first/back/forward/last/specific ply).
 *   - Board reconstruction via the supplied CogitateGameAdapter.
 *   - Active-event context lookup per ply.
 *   - Lazy, debounced evaluation requests with a per-ply cache and a
 *     stale-request-ID guard.
 *   - Autoplay interval management with automatic cleanup.
 *
 * Works with any `CogitateGameAdapter` — not tied to a specific game mode.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActiveEvent, BoardState, PieceColor } from '../../engine/types';
import { CrazyEvent, PieceColor as PC } from '../../engine/types';
import type { CogitateGameAdapter } from '../../cogitate/CogitateGameAdapter';
import type { GameRecord } from '../../persistence/gameHistory';
import type { SerializedActiveEvent } from '../../persistence/serialization';
import type { NormalizedEvaluation } from '../../cogitate/types';
import { requestEvaluation as defaultRequestEvaluation } from '../../ai/workerClient';

export const DEFAULT_AUTOPLAY_INTERVAL_MS = 1500;
export const EVALUATION_DEBOUNCE_MS = 150;
const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set(Object.values(CrazyEvent));

export interface UseReplayNavigationParams {
  readonly game: GameRecord;
  readonly adapter: CogitateGameAdapter;
  readonly totalPlies: number;
  /** Test injection for the evaluation request. */
  readonly evaluationFn?: typeof defaultRequestEvaluation;
  /** Test injection to allow disabling the lazy evaluation effect. */
  readonly autoEvaluate?: boolean;
}

export interface UseReplayNavigationReturn {
  readonly currentPly: number;
  readonly currentBoard: BoardState;
  readonly currentEvents: readonly SerializedActiveEvent[];
  readonly currentDeserializedEvents: readonly ActiveEvent[];
  readonly currentEval: NormalizedEvaluation | null;
  readonly evalLoading: boolean;
  readonly isAutoPlaying: boolean;
  readonly autoPlaySpeed: number;
  goToFirst: () => void;
  goBack: () => void;
  goForward: () => void;
  goToLast: () => void;
  goToPly: (ply: number) => void;
  toggleAutoPlay: () => void;
  setAutoPlaySpeed: (ms: number) => void;
}

/**
 * Convert stored SerializedActiveEvent[] into runtime ActiveEvent[] for event
 * overlay rendering. Unknown `type` values are skipped gracefully.
 */
export function deserializeActiveEvents(
  serialized: readonly SerializedActiveEvent[],
): ActiveEvent[] {
  const out: ActiveEvent[] = [];
  for (const e of serialized) {
    if (!KNOWN_EVENT_TYPES.has(e.type)) {
      console.warn(`[Replay] Skipping unknown event type: ${e.type}`);
      continue;
    }
    out.push({
      type: e.type as CrazyEvent,
      remainingPlies: e.remainingPlies,
      triggeredBy: e.triggeredBy as PieceColor,
      triggeredAtPly: e.triggeredAtPly,
      ...(e.metadata !== undefined ? { metadata: Object.freeze(e.metadata) } : {}),
    });
  }
  return out;
}

/** American Checkers starts with White. Activate color alternates per ply. */
function activeColorForPly(ply: number): PieceColor {
  return ply % 2 === 0 ? PC.White : PC.Black;
}

export function useReplayNavigation({
  game,
  adapter,
  totalPlies,
  evaluationFn = defaultRequestEvaluation,
  autoEvaluate = true,
}: UseReplayNavigationParams): UseReplayNavigationReturn {
  const [currentPly, setCurrentPly] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(DEFAULT_AUTOPLAY_INTERVAL_MS);
  const [evalByPly, setEvalByPly] = useState<Map<number, NormalizedEvaluation>>(
    () => new Map(),
  );

  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clampPly = useCallback(
    (ply: number) => Math.max(0, Math.min(totalPlies, ply)),
    [totalPlies],
  );

  const currentBoard = useMemo<BoardState>(() => {
    const snapshot = game.boardStates[currentPly];
    if (snapshot === undefined) {
      // Defensive fallback: use the final board state if available.
      const fallback = game.boardStates[game.boardStates.length - 1];
      if (fallback !== undefined) return adapter.getBoard(fallback);
      return adapter.getStartingPosition();
    }
    return adapter.getBoard(snapshot);
  }, [adapter, game.boardStates, currentPly]);

  const currentEvents = useMemo<readonly SerializedActiveEvent[]>(
    () => game.activeEventsPerPly?.[currentPly] ?? [],
    [game.activeEventsPerPly, currentPly],
  );

  const currentDeserializedEvents = useMemo(
    () => deserializeActiveEvents(currentEvents),
    [currentEvents],
  );

  const currentEval = evalByPly.get(currentPly) ?? null;
  const evalLoading =
    autoEvaluate && adapter.supportsEvaluation() && !evalByPly.has(currentPly);

  // Lazy, debounced evaluation for the current ply.
  useEffect(() => {
    if (!autoEvaluate) return;
    if (!adapter.supportsEvaluation()) return;
    if (evalByPly.has(currentPly)) return;

    const id = ++requestIdRef.current;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const board = currentBoard;
    const events = currentEvents;
    const modeId = adapter.modeId;
    const color = activeColorForPly(currentPly);
    const plySnapshot = currentPly;

    debounceTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const result = await evaluationFn(board, color, modeId, events);
          if (requestIdRef.current === id) {
            setEvalByPly((prev) => {
              if (prev.has(plySnapshot)) return prev;
              const next = new Map(prev);
              next.set(plySnapshot, result);
              return next;
            });
          }
        } catch (err) {
          console.warn('[Replay] Evaluation request failed:', err);
        }
      })();
    }, EVALUATION_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    adapter,
    autoEvaluate,
    currentBoard,
    currentEvents,
    currentPly,
    evalByPly,
    evaluationFn,
  ]);

  // Clean up timers on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, []);

  const stopAutoPlayTimer = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  // Autoplay interval: advance by one ply every `autoPlaySpeed` ms.
  useEffect(() => {
    if (!isAutoPlaying) {
      stopAutoPlayTimer();
      return;
    }
    autoPlayTimerRef.current = setInterval(() => {
      setCurrentPly((prev) => {
        const next = prev + 1;
        if (next >= totalPlies) {
          setIsAutoPlaying(false);
          return totalPlies;
        }
        return next;
      });
    }, autoPlaySpeed);
    return () => {
      stopAutoPlayTimer();
    };
  }, [isAutoPlaying, autoPlaySpeed, totalPlies, stopAutoPlayTimer]);

  const goToPly = useCallback(
    (ply: number) => {
      setIsAutoPlaying(false);
      setCurrentPly(clampPly(ply));
    },
    [clampPly],
  );

  const goToFirst = useCallback(() => {
    setIsAutoPlaying(false);
    setCurrentPly(0);
  }, []);

  const goToLast = useCallback(() => {
    setIsAutoPlaying(false);
    setCurrentPly(totalPlies);
  }, [totalPlies]);

  const goBack = useCallback(() => {
    setIsAutoPlaying(false);
    setCurrentPly((p) => Math.max(0, p - 1));
  }, []);

  const goForward = useCallback(() => {
    setIsAutoPlaying(false);
    setCurrentPly((p) => Math.min(totalPlies, p + 1));
  }, [totalPlies]);

  const toggleAutoPlay = useCallback(() => {
    setIsAutoPlaying((playing) => {
      if (playing) return false;
      // If at end, restart from beginning.
      setCurrentPly((p) => (p >= totalPlies ? 0 : p));
      return true;
    });
  }, [totalPlies]);

  return {
    currentPly,
    currentBoard,
    currentEvents,
    currentDeserializedEvents,
    currentEval,
    evalLoading,
    isAutoPlaying,
    autoPlaySpeed,
    goToFirst,
    goBack,
    goForward,
    goToLast,
    goToPly,
    toggleAutoPlay,
    setAutoPlaySpeed,
  };
}
