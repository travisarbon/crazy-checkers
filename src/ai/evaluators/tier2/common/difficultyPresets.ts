/**
 * Per-engine difficulty presets (Task 29.7).
 *
 * Depths from playbook §6.3 + plan §4 catalogue. Time caps default to
 * 2000 ms for Easy, 4000 ms for Hard per playbook §6.3 ("Iterative
 * deepening with time limits (2–4 seconds for Hard)"). Per-game tweaks
 * live in the engine-specific `getXDifficultyConfig` switches.
 *
 * The unified shape (`Tier2DifficultyConfig`) lets the generic
 * `tier2IterativeSearch` dispatch uniformly across all 10 games without
 * baking engine-specific knobs into the search core.
 */

import type { ClassifiedGameId } from '../../../../engine/classified/ClassifiedRuleSet';
import type { Tier2DifficultyConfig } from './types';

/** Game-specific depth presets for Easy and Hard. Mirrors the §4 catalogue. */
export const TIER_2_DEPTH_PRESETS: Readonly<
  Record<string, { readonly easy: number; readonly hard: number }>
> = Object.freeze({
  dameo: { easy: 3, hard: 7 },
  harzdame: { easy: 4, hard: 8 },
  lasca: { easy: 3, hard: 6 },
  bashni: { easy: 3, hard: 6 },
  zamma: { easy: 4, hard: 7 },
  'mak-yek': { easy: 4, hard: 7 },
  'hasami-shogi': { easy: 4, hard: 7 },
  rek: { easy: 4, hard: 7 },
  'dai-hasami-shogi': { easy: 4, hard: 7 },
  cheskers: { easy: 3, hard: 6 },
});

export function getTier2DifficultyConfig(opts: {
  gameId: ClassifiedGameId;
  level: 'easy' | 'hard';
}): Tier2DifficultyConfig {
  const presets = TIER_2_DEPTH_PRESETS[opts.gameId as unknown as string];
  if (!presets) {
    throw new Error(`getTier2DifficultyConfig: no presets for gameId "${opts.gameId}"`);
  }
  return Object.freeze({
    maxDepth: opts.level === 'hard' ? presets.hard : presets.easy,
    maxTimeMs: opts.level === 'hard' ? 4000 : 2000,
  });
}

export function listTier2DifficultyGameIds(): readonly ClassifiedGameId[] {
  return Object.freeze(
    Object.keys(TIER_2_DEPTH_PRESETS) as unknown as readonly ClassifiedGameId[],
  );
}
