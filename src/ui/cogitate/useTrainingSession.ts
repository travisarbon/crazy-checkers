/**
 * useTrainingSession — state management for a Training session.
 *
 * Manages a two-phase cycle per position (playing → feedback), position queue
 * navigation, move submission, and session statistics.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Move } from '../../engine/types';
import type { CogitateGameAdapter } from '../../cogitate/CogitateGameAdapter';
import {
  createSessionStats,
  evaluateAttempt,
  updateSessionStats,
  type EvaluateAttemptOptions,
  type TrainingAttemptResult,
  type TrainingPosition,
  type TrainingSessionStats,
} from '../../cogitate/trainingEngine';

export type TrainingPhase = 'playing' | 'feedback';

export interface UseTrainingSessionOptions {
  readonly positions: readonly TrainingPosition[];
  readonly getAdapter: (modeId: string) => CogitateGameAdapter | null;
  /** Test injection for worker call. */
  readonly evaluateOptions?: EvaluateAttemptOptions;
}

export interface UseTrainingSessionReturn {
  readonly currentPosition: TrainingPosition | null;
  readonly currentIndex: number;
  readonly currentAdapter: CogitateGameAdapter | null;
  readonly phase: TrainingPhase;
  readonly attemptResult: TrainingAttemptResult | null;
  readonly attemptResults: readonly (TrainingAttemptResult | null)[];
  readonly skippedIndexes: ReadonlySet<number>;
  readonly isEvaluating: boolean;
  readonly evaluationError: string | null;
  readonly stats: TrainingSessionStats;
  readonly submitMove: (move: Move) => Promise<void>;
  readonly nextPosition: () => void;
  readonly skipCurrent: () => void;
  readonly hasNext: boolean;
  readonly isSessionComplete: boolean;
  readonly restartSession: () => void;
}

export function useTrainingSession({
  positions,
  getAdapter,
  evaluateOptions,
}: UseTrainingSessionOptions): UseTrainingSessionReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<TrainingPhase>('playing');
  const [attemptResults, setAttemptResults] = useState<readonly (TrainingAttemptResult | null)[]>(
    () => new Array(positions.length).fill(null) as (TrainingAttemptResult | null)[],
  );
  const [skippedIndexes, setSkippedIndexes] = useState(new Set<number>());
  const [stats, setStats] = useState<TrainingSessionStats>(() =>
    createSessionStats(positions.length),
  );
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const positionsSignatureRef = useRef(positions);
  if (positionsSignatureRef.current !== positions) {
    positionsSignatureRef.current = positions;
    setCurrentIndex(0);
    setPhase('playing');
    setAttemptResults(
      new Array(positions.length).fill(null) as (TrainingAttemptResult | null)[],
    );
    setSkippedIndexes(new Set());
    setStats(createSessionStats(positions.length));
    setEvaluationError(null);
    setIsEvaluating(false);
  }

  const currentPosition = positions[currentIndex] ?? null;
  const currentAdapter = currentPosition ? getAdapter(currentPosition.modeId) : null;
  const attemptResult = attemptResults[currentIndex] ?? null;

  const isSessionComplete =
    positions.length > 0 && currentIndex >= positions.length;
  const hasNext = currentIndex + 1 < positions.length;

  const submitMove = useCallback(
    async (move: Move) => {
      if (!currentPosition || !currentAdapter) return;
      if (phase !== 'playing') return;
      setIsEvaluating(true);
      setEvaluationError(null);
      try {
        const result = await evaluateAttempt(
          currentPosition,
          move,
          currentAdapter,
          evaluateOptions,
        );
        setAttemptResults((prev) => {
          const next = [...prev];
          next[currentIndex] = result;
          return next;
        });
        setStats((prev) => updateSessionStats(prev, result));
        setPhase('feedback');
      } catch (err) {
        console.warn('[Training] submitMove failed:', err);
        setEvaluationError(
          err instanceof Error ? err.message : 'Failed to evaluate move',
        );
      } finally {
        setIsEvaluating(false);
      }
    },
    [currentAdapter, currentIndex, currentPosition, evaluateOptions, phase],
  );

  const nextPosition = useCallback(() => {
    setCurrentIndex((idx) => Math.min(idx + 1, positions.length));
    setPhase('playing');
    setEvaluationError(null);
  }, [positions.length]);

  const skipCurrent = useCallback(() => {
    if (!currentPosition) return;
    setSkippedIndexes((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });
    setCurrentIndex((idx) => Math.min(idx + 1, positions.length));
    setPhase('playing');
    setEvaluationError(null);
  }, [currentIndex, currentPosition, positions.length]);

  const restartSession = useCallback(() => {
    setCurrentIndex(0);
    setPhase('playing');
    setAttemptResults(
      new Array(positions.length).fill(null) as (TrainingAttemptResult | null)[],
    );
    setSkippedIndexes(new Set());
    setStats(createSessionStats(positions.length));
    setEvaluationError(null);
    setIsEvaluating(false);
  }, [positions.length]);

  return useMemo<UseTrainingSessionReturn>(
    () => ({
      currentPosition,
      currentIndex,
      currentAdapter,
      phase,
      attemptResult,
      attemptResults,
      skippedIndexes,
      isEvaluating,
      evaluationError,
      stats,
      submitMove,
      nextPosition,
      skipCurrent,
      hasNext,
      isSessionComplete,
      restartSession,
    }),
    [
      currentPosition,
      currentIndex,
      currentAdapter,
      phase,
      attemptResult,
      attemptResults,
      skippedIndexes,
      isEvaluating,
      evaluationError,
      stats,
      submitMove,
      nextPosition,
      skipCurrent,
      hasNext,
      isSessionComplete,
      restartSession,
    ],
  );
}
