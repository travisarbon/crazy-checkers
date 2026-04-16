/**
 * Tier 1 index module — registers all ten Tier 1 Classified games (Task 28.3).
 *
 * Imported via `loadClassifiedTier(1)`. The loader invokes `registerTier1()`
 * on every call so `_clearClassifiedRegistry` in tests can be followed by
 * `_clearTierLoaderCache` + `loadClassifiedTier(1)` to restore a clean
 * fixture state. `{ replace: true }` makes the function safe to call
 * repeatedly within a single session.
 *
 * Registration order matches the Wave 1 narrative and the Code mode gallery
 * order (classifiedNumber 1..10) — see Task 28.3 plan §4.2 for the
 * deterministic-order rationale.
 */

import { registerRussianDraughts } from './russian';
import { registerBrazilianDraughts } from './brazilian';
import { registerItalianDraughts } from './italian';
import { registerInternationalCheckers } from './international';
import { registerFrysk } from './frysk';
import { registerFrisianDraughts } from './frisian';
import { registerMalaysianCheckers } from './malaysian';
import { registerCanadianDraughts } from './canadian';
import { registerArmenianDraughts } from './armenian';
import { registerTurkishDraughts } from './turkish';

export function registerTier1(): void {
  registerRussianDraughts({ replace: true });
  registerBrazilianDraughts({ replace: true });
  registerItalianDraughts({ replace: true });
  registerInternationalCheckers({ replace: true });
  registerFrysk({ replace: true });
  registerFrisianDraughts({ replace: true });
  registerMalaysianCheckers({ replace: true });
  registerCanadianDraughts({ replace: true });
  registerArmenianDraughts({ replace: true });
  registerTurkishDraughts({ replace: true });
}

export {
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
  TIER_1_GAME_IDS,
} from './ids';

export {
  registerRussianDraughts,
  registerBrazilianDraughts,
  registerItalianDraughts,
  registerInternationalCheckers,
  registerFrysk,
  registerFrisianDraughts,
  registerMalaysianCheckers,
  registerCanadianDraughts,
  registerArmenianDraughts,
  registerTurkishDraughts,
};
