/**
 * Russian Draughts — Tier 1 Classified registration (Task 28.3, classifiedNumber 1).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createRussianDraughtsConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { RUSSIAN_DRAUGHTS_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { RUSSIAN_DRAUGHTS_ID };

export const russianDraughtsConfig = createRussianDraughtsConfig();
// Widen to the default ClassifiedRuleSet shape so the registry spec
// (which is invariant in the move type) accepts the rule set without a
// per-call cast. The DraughtsMove subtype is internal to the engine.
export const russianDraughtsRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  russianDraughtsConfig,
) as unknown as ClassifiedRuleSet;

export function registerRussianDraughts(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: RUSSIAN_DRAUGHTS_ID,
      classifiedNumber: 1,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Russian Draughts',
      ruleSet: russianDraughtsRuleSet,
      boardGeometry: russianDraughtsRuleSet.boardGeometry,
      pieceVocabularyId: russianDraughtsRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED01',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['russian-draughts'],
      },
      mvpRuleSummary:
        'Men and flying kings on an 8×8 board. Men may capture backwards; captures are mandatory.',
    },
    options,
  );
}
