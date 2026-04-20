/**
 * Per-variant difficulty presets for Tier 1 Classified draughts games
 * (Task 28.5).
 *
 * Board-size-aware `DifficultyConfig` overrides. Larger boards (10×10, 12×12)
 * get reduced search depth but increased time limits to compensate for the
 * higher branching factor. Per-variant overrides handle special cases
 * (e.g. Frysk! with only 5 pieces per side has a lower branching factor
 * and can search deeper).
 */

import type { Difficulty, DifficultyConfig } from '../../difficulty';
import type { DraughtsConfig, DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';
import { boardSizeOf } from '../../../engine/classified/draughts/DraughtsConfig';

// ---------------------------------------------------------------------------
// Board-size base configs
// ---------------------------------------------------------------------------

const HARD_8x8: DifficultyConfig = {
  difficulty: 'hard',
  maxDepth: 10,
  timeLimitMs: 2_000,
  quiescenceEnabled: true,
  quiescenceMaxDepth: 4,
  blunderRate: 0,
  moveRandomization: 1.0,
};

const HARD_10x10: DifficultyConfig = {
  difficulty: 'hard',
  maxDepth: 8,
  timeLimitMs: 2_500,
  quiescenceEnabled: true,
  quiescenceMaxDepth: 6,
  blunderRate: 0,
  moveRandomization: 1.0,
};

const HARD_12x12: DifficultyConfig = {
  difficulty: 'hard',
  maxDepth: 7,
  timeLimitMs: 3_500,
  quiescenceEnabled: true,
  quiescenceMaxDepth: 6,
  blunderRate: 0,
  moveRandomization: 1.0,
};

const EASY_8x8: DifficultyConfig = {
  difficulty: 'easy',
  maxDepth: 4,
  timeLimitMs: 500,
  quiescenceEnabled: false,
  quiescenceMaxDepth: 0,
  blunderRate: 0.12,
  moveRandomization: 0.9,
};

const EASY_10x10: DifficultyConfig = {
  difficulty: 'easy',
  maxDepth: 3,
  timeLimitMs: 600,
  quiescenceEnabled: false,
  quiescenceMaxDepth: 0,
  blunderRate: 0.12,
  moveRandomization: 0.9,
};

const EASY_12x12: DifficultyConfig = {
  difficulty: 'easy',
  maxDepth: 3,
  timeLimitMs: 800,
  quiescenceEnabled: false,
  quiescenceMaxDepth: 0,
  blunderRate: 0.12,
  moveRandomization: 0.9,
};

// ---------------------------------------------------------------------------
// Per-variant overrides
// ---------------------------------------------------------------------------

/**
 * Per-variant hard overrides. Keys present here replace the board-size
 * base config for that specific gameId.
 */
const HARD_OVERRIDES: Partial<Record<DraughtsGameId, Partial<DifficultyConfig>>> = {
  // Frysk!: only 5 pieces → much lower branching factor → can search deeper.
  'frysk': {
    maxDepth: 10,
    timeLimitMs: 2_500,
  },
  // Frisian: dual-axis captures increase branching → reduce depth.
  'frisian-draughts': {
    maxDepth: 7,
    timeLimitMs: 2_500,
  },
  // Malaysian: huffing reduces tactical complexity → lower quiescence.
  'malaysian-checkers': {
    quiescenceMaxDepth: 4,
  },
};

/**
 * Per-variant easy overrides.
 */
const EASY_OVERRIDES: Partial<Record<DraughtsGameId, Partial<DifficultyConfig>>> = {
  // Frysk!: lower branching, can search a bit deeper even on Easy.
  'frysk': {
    maxDepth: 5,
    timeLimitMs: 600,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the DifficultyConfig for a Classified draughts variant.
 *
 * Applies board-size-based defaults first, then per-variant overrides.
 */
export function getDraughtsDifficultyConfig(
  config: DraughtsConfig,
  difficulty: Difficulty,
): DifficultyConfig {
  const boardSize = boardSizeOf(config);

  let base: DifficultyConfig;
  let overrides: Partial<DifficultyConfig> | undefined;

  if (difficulty === 'hard') {
    switch (boardSize) {
      case 8:
        base = HARD_8x8;
        break;
      case 10:
        base = HARD_10x10;
        break;
      case 12:
        base = HARD_12x12;
        break;
    }
    overrides = HARD_OVERRIDES[config.gameId];
  } else {
    switch (boardSize) {
      case 8:
        base = EASY_8x8;
        break;
      case 10:
        base = EASY_10x10;
        break;
      case 12:
        base = EASY_12x12;
        break;
    }
    overrides = EASY_OVERRIDES[config.gameId];
  }

  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    difficulty,
  };
}

/**
 * Returns the response time cap in milliseconds for the given board size.
 * Used by validation to assert timing requirements.
 */
export function getResponseTimeCap(boardSize: 8 | 10 | 12): number {
  switch (boardSize) {
    case 8:
      return 2_000;
    case 10:
      return 2_500;
    case 12:
      return 3_500;
  }
}
