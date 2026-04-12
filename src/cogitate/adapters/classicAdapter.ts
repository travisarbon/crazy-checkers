/**
 * ClassicAdapter — Cogitate adapter for Classic (American Rules Checkers) mode.
 */

import type { CogitateGameAdapter } from '../CogitateGameAdapter';
import { createDraughtsAdapter } from './draughtsAdapterFactory';

export const CLASSIC_MODE_ID = 'classic';

export function createClassicAdapter(): CogitateGameAdapter {
  return createDraughtsAdapter({
    modeId: CLASSIC_MODE_ID,
    supportsEvents: false,
    permanentEvent: null,
  });
}
