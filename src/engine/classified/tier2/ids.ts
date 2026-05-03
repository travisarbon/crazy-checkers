/**
 * Tier 2 gameId barrel — Task 29.7.
 *
 * Ten branded `ClassifiedGameId` constants, one per Tier 2 game. Mirrors
 * the Tier 1 layout in `tier1/ids.ts`. Kept in their own module so tests
 * and UI surfaces can import the identifiers without paying for the full
 * per-game rule set bundle at import time (Vite tree-shakes pure re-exports).
 *
 * Plan §4 catalogue ordering by classifiedNumber:
 *   11 dameo, 12 harzdame, 13 lasca, 14 bashni, 15 zamma,
 *   23 mak-yek, 24 hasami-shogi, 25 rek, 33 dai-hasami-shogi, 49 cheskers.
 */

import type { ClassifiedGameId } from '../ClassifiedRuleSet';
import { asClassifiedGameId } from '../ClassifiedRuleSet';

export const DAMEO_ID: ClassifiedGameId = asClassifiedGameId('dameo');
export const HARZDAME_ID: ClassifiedGameId = asClassifiedGameId('harzdame');
export const LASCA_ID: ClassifiedGameId = asClassifiedGameId('lasca');
export const BASHNI_ID: ClassifiedGameId = asClassifiedGameId('bashni');
export const ZAMMA_ID: ClassifiedGameId = asClassifiedGameId('zamma');
export const MAK_YEK_ID: ClassifiedGameId = asClassifiedGameId('mak-yek');
export const HASAMI_SHOGI_ID: ClassifiedGameId = asClassifiedGameId('hasami-shogi');
export const REK_ID: ClassifiedGameId = asClassifiedGameId('rek');
export const DAI_HASAMI_SHOGI_ID: ClassifiedGameId =
  asClassifiedGameId('dai-hasami-shogi');
export const CHESKERS_ID: ClassifiedGameId = asClassifiedGameId('cheskers');

/**
 * classifiedNumber-ordered list of every Tier 2 gameId. Consumed by tests
 * that iterate the wave in canonical presentation order; consumers may not
 * mutate this array.
 */
export const TIER_2_GAME_IDS: readonly ClassifiedGameId[] = Object.freeze([
  DAMEO_ID,
  HARZDAME_ID,
  LASCA_ID,
  BASHNI_ID,
  ZAMMA_ID,
  MAK_YEK_ID,
  HASAMI_SHOGI_ID,
  REK_ID,
  DAI_HASAMI_SHOGI_ID,
  CHESKERS_ID,
]);
