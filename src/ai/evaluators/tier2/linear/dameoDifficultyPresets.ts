/**
 * Dameo difficulty presets (Phase 4 Task 29.G.1-A §5.3).
 *
 * Per per-game subtask wording:
 *   - Easy: depth 3, ~1.5s per move, no transposition table.
 *   - Hard: depth 7, ~4s per move, with quiescence depth 4 + transposition table.
 *
 * The depth-7 Hard target is more conservative than the playbook §6.3
 * suggestion of 8–10 ply (~10–14 branching factor); per-game subtask
 * wording wins per plan §1.1 + CLAUDE.md §6 guidance. Iterative-deepening
 * + alpha-beta pruning + transposition table mean depth 7 effective
 * nodes are typically ~10⁴–10⁵ — comfortable on a developer laptop.
 *
 * The presets layer over Task 29.7's `getTier2DifficultyConfig` which
 * defaults to depth 3/7 for Dameo at 2000/4000ms. This file's exports
 * are reusable by per-game-subtask harnesses + the `validate:tier2
 * --gameId dameo` runner; they are NOT re-wired into the Task 29.7
 * dispatch (which uses the generic preset table from `common/`).
 */

import type { Tier2DifficultyConfig } from '../common/types';

export interface DameoDifficultyConfig extends Tier2DifficultyConfig {
  readonly enableTranspositionTable: boolean;
}

export function getDameoDifficultyConfig(opts: {
  level: 'easy' | 'hard';
}): DameoDifficultyConfig {
  switch (opts.level) {
    case 'easy':
      return Object.freeze({
        maxDepth: 3,
        maxTimeMs: 1500,
        quiescenceDepth: 2,
        enableTranspositionTable: false,
      });
    case 'hard':
      return Object.freeze({
        maxDepth: 7,
        maxTimeMs: 4000,
        quiescenceDepth: 4,
        enableTranspositionTable: true,
      });
  }
}
