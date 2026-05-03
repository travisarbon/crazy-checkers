/**
 * Common types for Tier 2 evaluators (Task 29.7).
 *
 * Per-engine evaluators implement `EvaluateClassifiedPosition` against a
 * weight table. The shared `Tier2Search` consumes any conforming evaluator
 * + difficulty config and runs alpha-beta minimax.
 */

import type { ClassifiedGameState } from '../../../../engine/classified/state';
import type { ClassifiedMove } from '../../../../engine/classified/ClassifiedRuleSet';

export type Tier2Side = 'white' | 'black';

export interface Tier2DifficultyConfig {
  /** Maximum search depth (plies). */
  readonly maxDepth: number;
  /** Iterative-deepening time cap in milliseconds. */
  readonly maxTimeMs: number;
  /** Quiescence search depth — typically 2–4. Default 0 (off). */
  readonly quiescenceDepth?: number;
  /** Whether to enable a transposition table. Default false. */
  readonly enableTranspositionTable?: boolean;
}

/**
 * Pure scoring function. Returns positive scores for `side`'s perspective
 * (+10000 = won; -10000 = lost; 0 = even). Stateless and allocation-free.
 */
export type EvaluateClassifiedPosition<S extends ClassifiedGameState = ClassifiedGameState> = (
  state: S,
  side: Tier2Side,
) => number;

export interface Tier2SearchResult<M extends ClassifiedMove> {
  readonly move: M | null;
  readonly score: number;
  readonly depth: number;
  readonly nodesEvaluated: number;
}

export const TIER_2_WIN_SCORE = 10_000;
export const TIER_2_LOSS_SCORE = -10_000;
