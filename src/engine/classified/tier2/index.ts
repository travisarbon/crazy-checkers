/**
 * Tier 2 index module — registers all ten Tier 2 Classified games (Task 29.7).
 *
 * Imported via `loadClassifiedTier(2)`. Registration order matches the §4
 * catalogue (classifiedNumber-ordered): 11 dameo, 12 harzdame, 13 lasca,
 * 14 bashni, 15 zamma, 23 mak-yek, 24 hasami-shogi, 25 rek, 33 dai-hasami-
 * shogi, 49 cheskers.
 *
 * `{ replace: true }` makes the function idempotent across repeated calls
 * within a session — the loader caches its `Promise<void>` so it normally
 * runs at most once, but tests can clear the cache and re-register cleanly.
 */

import { registerDameo } from './dameo';
import { registerHarzdame } from './harzdame';
import { registerLasca } from './lasca';
import { registerBashni } from './bashni';
import { registerZamma } from './zamma';
import { registerMakYek } from './makYek';
import { registerHasamiShogi } from './hasamiShogi';
import { registerRek } from './rek';
import { registerDaiHasamiShogi } from './daiHasamiShogi';
import { registerCheskers } from './cheskers';

export function registerTier2(): void {
  registerDameo({ replace: true });
  registerHarzdame({ replace: true });
  registerLasca({ replace: true });
  registerBashni({ replace: true });
  registerZamma({ replace: true });
  registerMakYek({ replace: true });
  registerHasamiShogi({ replace: true });
  registerRek({ replace: true });
  registerDaiHasamiShogi({ replace: true });
  registerCheskers({ replace: true });
}

export {
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
  TIER_2_GAME_IDS,
} from './ids';

export {
  registerDameo,
  registerHarzdame,
  registerLasca,
  registerBashni,
  registerZamma,
  registerMakYek,
  registerHasamiShogi,
  registerRek,
  registerDaiHasamiShogi,
  registerCheskers,
};
