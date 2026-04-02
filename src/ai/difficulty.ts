/**
 * Difficulty presets for Easy and Hard AI levels.
 * Task 3.3 defines DifficultyConfig and the two preset configurations,
 * plus post-search move selection with blunder injection and score-window
 * randomization.
 */

import type { Move } from '../engine/types';
import type { SearchConfig, SearchResult } from './search';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Identifier for difficulty levels. */
export type Difficulty = 'easy' | 'hard';

/**
 * Complete configuration for an AI turn at a given difficulty.
 * Contains both search parameters (passed to iterativeSearch) and
 * move selection parameters (applied after search returns).
 */
export interface DifficultyConfig {
  /** Human-readable difficulty label. */
  readonly difficulty: Difficulty;

  // --- Search parameters (map to SearchConfig) ---

  /** Maximum search depth in plies. */
  readonly maxDepth: number;
  /** Time limit in milliseconds. Whichever limit is hit first stops the search. */
  readonly timeLimitMs: number;
  /** Whether quiescence search is enabled at the search horizon. */
  readonly quiescenceEnabled: boolean;
  /** Maximum additional plies for quiescence search (ignored if quiescence disabled). */
  readonly quiescenceMaxDepth: number;

  // --- Move selection parameters (applied post-search) ---

  /** Probability (0.0-1.0) of ignoring the search and playing a random legal move. */
  readonly blunderRate: number;
  /**
   * Score window for move randomization, as a fraction of the best score (0.0-1.0).
   * A value of 0.9 means: pick randomly among moves scoring >= 90% of the best.
   * A value of 1.0 means: always play the highest-scoring move.
   */
  readonly moveRandomization: number;
}

// ---------------------------------------------------------------------------
// Preset configurations
// ---------------------------------------------------------------------------

/**
 * Easy AI configuration.
 *
 * Design Document specifies:
 *   - Search depth: 3-4 ply
 *   - Move randomization: randomly among moves within 90% of the best score
 *   - Quiescence: disabled
 *   - Blunder injection: 10-15% of moves are random
 */
export const EASY_CONFIG: DifficultyConfig = {
  difficulty: 'easy',

  // Search parameters
  maxDepth: 4,
  timeLimitMs: 5_000,
  quiescenceEnabled: false,
  quiescenceMaxDepth: 0,

  // Move selection parameters
  blunderRate: 0.12,
  moveRandomization: 0.9,
} as const;

/**
 * Hard AI configuration.
 *
 * Design Document specifies:
 *   - Search depth: 8-10 ply (or time-limited at ~2 seconds)
 *   - Move randomization: always plays the best found move
 *   - Quiescence: enabled
 *   - Blunder injection: never
 */
export const HARD_CONFIG: DifficultyConfig = {
  difficulty: 'hard',

  // Search parameters
  maxDepth: 10,
  timeLimitMs: 2_000,
  quiescenceEnabled: true,
  quiescenceMaxDepth: 4,

  // Move selection parameters
  blunderRate: 0,
  moveRandomization: 1.0,
} as const;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns the DifficultyConfig for a given difficulty label.
 *
 * @throws Error if an unknown difficulty is provided.
 */
export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  switch (difficulty) {
    case 'easy':
      return EASY_CONFIG;
    case 'hard':
      return HARD_CONFIG;
    default: {
      const exhaustive: never = difficulty;
      throw new Error(`Unknown difficulty: ${String(exhaustive)}`);
    }
  }
}

/**
 * Extracts the SearchConfig subset from a DifficultyConfig.
 * This is what gets passed to iterativeSearch.
 */
export function toSearchConfig(config: DifficultyConfig): SearchConfig {
  return {
    maxDepth: config.maxDepth,
    timeLimitMs: config.timeLimitMs,
    quiescenceEnabled: config.quiescenceEnabled,
    quiescenceMaxDepth: config.quiescenceMaxDepth,
  };
}

/**
 * Applies post-search move selection (blunder injection and score-window
 * randomization) to choose the final move the AI will play.
 *
 * Decision flow:
 * 1. If only one legal move exists, play it (no choice to make).
 * 2. Roll for blunder. If triggered, pick a uniformly random legal move.
 * 3. Otherwise, apply score-window randomization.
 * 4. Fallback: play the search's best move.
 */
export function selectMove(
  searchResult: SearchResult,
  allMoveScores: ReadonlyArray<{ move: Move; score: number }>,
  legalMoves: readonly Move[],
  config: DifficultyConfig,
  randomFn: () => number = Math.random,
): Move {
  // --- Trivial case: only one legal move ---
  if (legalMoves.length === 1) {
    return legalMoves[0] as Move;
  }

  // --- Blunder check ---
  if (config.blunderRate > 0 && randomFn() < config.blunderRate) {
    const index = Math.floor(randomFn() * legalMoves.length);
    return legalMoves[index] as Move;
  }

  // --- Score-window randomization ---
  if (
    config.moveRandomization < 1.0 &&
    allMoveScores.length > 0
  ) {
    // Find the best score among all root moves.
    const bestScore = allMoveScores.reduce(
      (max, entry) => Math.max(max, entry.score),
      -Infinity,
    );

    // Compute the threshold. Works for both positive and negative scores:
    //   positive best=100, 0.9 window -> threshold = 100 - 10 = 90
    //   negative best=-50, 0.9 window -> threshold = -50 - 5 = -55
    const spread = Math.abs(bestScore) * (1 - config.moveRandomization);
    const threshold = bestScore - spread;

    const candidates = allMoveScores.filter(
      (entry) => entry.score >= threshold,
    );

    if (candidates.length > 0) {
      const index = Math.floor(randomFn() * candidates.length);
      return (candidates[index] as { move: Move; score: number }).move;
    }
  }

  // --- Fallback: play the search's best move ---
  return searchResult.move ?? (legalMoves[0] as Move);
}
