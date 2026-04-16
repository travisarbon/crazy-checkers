/**
 * Frisian Draughts — Tier 1 Classified registration (Task 28.3, classifiedNumber 6).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createFrisianDraughtsConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { FRISIAN_DRAUGHTS_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { FRISIAN_DRAUGHTS_ID };

export const frisianDraughtsConfig = createFrisianDraughtsConfig();
export const frisianDraughtsRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  frisianDraughtsConfig,
) as unknown as ClassifiedRuleSet;

export function registerFrisianDraughts(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: FRISIAN_DRAUGHTS_ID,
      classifiedNumber: 6,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Frisian Draughts',
      ruleSet: frisianDraughtsRuleSet,
      boardGeometry: frisianDraughtsRuleSet.boardGeometry,
      pieceVocabularyId: frisianDraughtsRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED06',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['frisian-draughts'],
      },
    },
    options,
  );
}
