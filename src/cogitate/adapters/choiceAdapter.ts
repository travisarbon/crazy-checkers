/**
 * ChoiceAdapter — parameterized Cogitate adapter for Choice modes.
 *
 * Each Choice mode has a permanent event that is always active. This factory
 * builds one adapter per Choice mode. `registerAllChoiceAdapters()` iterates
 * CHOICE_MODE_DATA to produce + register every adapter.
 */

import { CHOICE_MODE_DATA } from '../../persistence/choiceModeData';
import type { CrazyEvent } from '../../engine/types';
import type { CogitateGameAdapter } from '../CogitateGameAdapter';
import { registerAdapter } from '../CogitateGameAdapter';
import { createDraughtsAdapter } from './draughtsAdapterFactory';

/**
 * Computes the choice mode registry ID from the display name.
 * Must mirror the logic in persistence/gameModeRegistry.ts buildRegistry().
 */
export function choiceDisplayNameToId(displayName: string): string {
  const kebab = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `choice-${kebab}`;
}

export function createChoiceAdapter(
  modeId: string,
  permanentEvent: CrazyEvent | null,
): CogitateGameAdapter {
  return createDraughtsAdapter({
    modeId,
    supportsEvents: true,
    permanentEvent,
  });
}

/** Iterates CHOICE_MODE_DATA and returns all 40 Choice adapters. */
export function buildAllChoiceAdapters(): readonly CogitateGameAdapter[] {
  return CHOICE_MODE_DATA.map((def) =>
    createChoiceAdapter(choiceDisplayNameToId(def.displayName), def.event),
  );
}

/** Registers every Choice adapter into the shared CogitateGameAdapter registry. */
export function registerAllChoiceAdapters(): void {
  for (const adapter of buildAllChoiceAdapters()) {
    registerAdapter(adapter);
  }
}
