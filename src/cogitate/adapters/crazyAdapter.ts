/**
 * CrazyAdapter — Cogitate adapter for Crazy mode (random events, American base rules).
 */

import type { CogitateGameAdapter } from '../CogitateGameAdapter';
import { createDraughtsAdapter } from './draughtsAdapterFactory';

export const CRAZY_MODE_ID = 'crazy';

export function createCrazyAdapter(): CogitateGameAdapter {
  return createDraughtsAdapter({
    modeId: CRAZY_MODE_ID,
    supportsEvents: true,
    permanentEvent: null,
  });
}
