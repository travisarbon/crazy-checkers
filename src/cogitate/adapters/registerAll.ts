/**
 * Central registration of all Phase 3 Cogitate adapters.
 *
 * Importing this module for its side effects registers adapters for Classic,
 * Crazy, Chaos, and all 40 Choice modes. Idempotent: safe to import multiple
 * times.
 */

import { registerAdapter, hasAdapter } from '../CogitateGameAdapter';
import { CLASSIC_MODE_ID, createClassicAdapter } from './classicAdapter';
import { CRAZY_MODE_ID, createCrazyAdapter } from './crazyAdapter';
import { CHAOS_MODE_ID, createChaosAdapter } from './chaosAdapter';
import { registerAllChoiceAdapters } from './choiceAdapter';

let registered = false;

/** Registers all Phase 3 adapters into the shared registry. Idempotent. */
export function registerAllCogitateAdapters(): void {
  if (registered) return;
  registered = true;

  if (!hasAdapter(CLASSIC_MODE_ID)) registerAdapter(createClassicAdapter());
  if (!hasAdapter(CRAZY_MODE_ID)) registerAdapter(createCrazyAdapter());
  if (!hasAdapter(CHAOS_MODE_ID)) registerAdapter(createChaosAdapter());
  registerAllChoiceAdapters();
}

// Register on module load for normal application use.
registerAllCogitateAdapters();

/** Test-only: allow tests to re-run registration after clearing the registry. */
export function _resetRegisteredFlag(): void {
  registered = false;
}
