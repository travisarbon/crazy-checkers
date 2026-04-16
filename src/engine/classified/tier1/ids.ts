/**
 * Tier 1 gameId barrel — Task 28.3.
 *
 * Ten branded `ClassifiedGameId` constants, one per Tier 1 variant.
 * Kept in their own module so tests and UI surfaces can import the
 * identifiers without paying for the full per-game rule set bundle
 * at import time (Vite tree-shakes pure re-exports).
 */

import type { ClassifiedGameId } from '../ClassifiedRuleSet';
import { asClassifiedGameId } from '../ClassifiedRuleSet';

export const RUSSIAN_DRAUGHTS_ID: ClassifiedGameId =
  asClassifiedGameId('russian-draughts');
export const BRAZILIAN_DRAUGHTS_ID: ClassifiedGameId =
  asClassifiedGameId('brazilian-draughts');
export const ITALIAN_DRAUGHTS_ID: ClassifiedGameId =
  asClassifiedGameId('italian-draughts');
export const INTERNATIONAL_CHECKERS_ID: ClassifiedGameId =
  asClassifiedGameId('international-checkers');
export const FRYSK_ID: ClassifiedGameId = asClassifiedGameId('frysk');
export const FRISIAN_DRAUGHTS_ID: ClassifiedGameId =
  asClassifiedGameId('frisian-draughts');
export const MALAYSIAN_CHECKERS_ID: ClassifiedGameId =
  asClassifiedGameId('malaysian-checkers');
export const CANADIAN_DRAUGHTS_ID: ClassifiedGameId =
  asClassifiedGameId('canadian-draughts');
export const ARMENIAN_DRAUGHTS_ID: ClassifiedGameId =
  asClassifiedGameId('armenian-draughts');
export const TURKISH_DRAUGHTS_ID: ClassifiedGameId =
  asClassifiedGameId('turkish-draughts');

/**
 * classifiedNumber-ordered list of every Tier 1 gameId. Consumed by tests
 * that iterate the wave in canonical presentation order; consumers may not
 * mutate this array.
 */
export const TIER_1_GAME_IDS: readonly ClassifiedGameId[] = Object.freeze([
  RUSSIAN_DRAUGHTS_ID,
  BRAZILIAN_DRAUGHTS_ID,
  ITALIAN_DRAUGHTS_ID,
  INTERNATIONAL_CHECKERS_ID,
  FRYSK_ID,
  FRISIAN_DRAUGHTS_ID,
  MALAYSIAN_CHECKERS_ID,
  CANADIAN_DRAUGHTS_ID,
  ARMENIAN_DRAUGHTS_ID,
  TURKISH_DRAUGHTS_ID,
]);
