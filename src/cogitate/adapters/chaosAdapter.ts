/**
 * ChaosAdapter — Cogitate adapter for Chaos mode.
 *
 * Structurally identical to Crazy mode in the engine — both use
 * CompositeEventRuleSet with runtime-active events. Chaos's gameplay
 * difference (Double Trouble on every capture) is handled by the runtime
 * event-selection logic, not by the rule set itself. For Cogitate purposes
 * (replay, analysis) the adapter behavior mirrors CrazyAdapter.
 */

import type { CogitateGameAdapter } from '../CogitateGameAdapter';
import { createDraughtsAdapter } from './draughtsAdapterFactory';

export const CHAOS_MODE_ID = 'chaos';

export function createChaosAdapter(): CogitateGameAdapter {
  return createDraughtsAdapter({
    modeId: CHAOS_MODE_ID,
    supportsEvents: true,
    permanentEvent: null,
  });
}
