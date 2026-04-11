/**
 * Pipeline configuration constants for puzzle generation.
 * All tunable parameters are centralized here to enable rapid iteration
 * without modifying pipeline logic.
 */

import type { Difficulty } from '../src/ai/difficulty.ts';

// ---------------------------------------------------------------------------
// Core pipeline parameters
// ---------------------------------------------------------------------------

/** Deterministic seed for full pipeline reproducibility. */
export const MASTER_SEED = 42;

/** Self-play games to generate. 1000 games with depth-6 self-play completes in ~17 min. */
export const TOTAL_GAMES = 1000;

/** Cap per game to prevent infinite loops in drawn positions. */
export const MAX_MOVES_PER_GAME = 200;

/** Final puzzle count. */
export const TARGET_PUZZLE_COUNT = 100;

// ---------------------------------------------------------------------------
// Position extraction parameters
// ---------------------------------------------------------------------------

/** Minimum centipawn evaluation swing between ply N and N-2 to qualify as candidate.
 * Lowered from 100 to 75 to increase candidate pool per Playbook §19 risk mitigation. */
export const EVAL_SWING_THRESHOLD_CP = 75;

/** Best move must exceed second-best by this margin at the root.
 * Relaxed from 100 to 50 for sufficient yield per Playbook §19 risk mitigation. */
export const SOLUTION_UNIQUENESS_MARGIN_CP = 50;

/** Minimum total pieces for a candidate position. */
export const MIN_PIECE_COUNT = 4;

/** Maximum total pieces for a candidate position. */
export const MAX_PIECE_COUNT = 20;

// ---------------------------------------------------------------------------
// Validation search parameters
// ---------------------------------------------------------------------------

/** Maximum search depth for solution validation. Reduced from 10 for faster pipeline. */
export const VALIDATION_SEARCH_DEPTH = 8;

/** Extended time limit for validation searches (more generous than gameplay). */
export const VALIDATION_TIME_LIMIT_MS = 3000;

/** Reduced time limit for self-play phase (sufficient for move selection). */
export const SELF_PLAY_TIME_LIMIT_MS = 300;

// ---------------------------------------------------------------------------
// Difficulty calibration
// ---------------------------------------------------------------------------

/** Weights for composite difficulty score. */
export const DIFFICULTY_WEIGHTS = {
  depth: 0.40,
  branching: 0.35,
  complexity: 0.25,
} as const;

/** Base time for star-rating threshold computation (5s per half-move for easy puzzles). */
export const BASE_TIME_PER_MOVE_MS = 5000;

/** Scaled time for expert puzzles (10s per half-move). */
export const EXPERT_TIME_PER_MOVE_MS = 10000;

/** T₂ = T₁ × 2.5. */
export const SLOW_THRESHOLD_MULTIPLIER = 2.5;

// ---------------------------------------------------------------------------
// Difficulty pairings
// ---------------------------------------------------------------------------

export interface DifficultyPairing {
  white: Difficulty;
  black: Difficulty;
  count: number;
}

/**
 * Mix of skill differentials producing different puzzle types.
 * Total: 600 games.
 */
export const DIFFICULTY_PAIRINGS: readonly DifficultyPairing[] = [
  { white: 'hard', black: 'easy', count: 200 },
  { white: 'easy', black: 'hard', count: 200 },
  { white: 'hard', black: 'hard', count: 150 },
  { white: 'easy', black: 'easy', count: 50 },
] as const;

// ---------------------------------------------------------------------------
// Solution path extraction
// ---------------------------------------------------------------------------

/** Maximum plies for solution path extraction. */
export const SOLUTION_PATH_MAX_DEPTH = 12;

/** Minimum evaluation for a position to be considered decisively won.
 * Relaxed to 50 (half-pawn advantage) to ensure sufficient yield. */
export const DECISIVE_ADVANTAGE_CP = 50;
