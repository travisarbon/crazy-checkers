/**
 * Turkish Draughts — Tier 1 Classified registration (Task 28.3, classifiedNumber 10).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createTurkishDraughtsConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { TURKISH_DRAUGHTS_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { TURKISH_DRAUGHTS_ID };

export const turkishDraughtsConfig = createTurkishDraughtsConfig();
export const turkishDraughtsRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  turkishDraughtsConfig,
) as unknown as ClassifiedRuleSet;

export function registerTurkishDraughts(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: TURKISH_DRAUGHTS_ID,
      classifiedNumber: 10,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Turkish Draughts',
      ruleSet: turkishDraughtsRuleSet,
      boardGeometry: turkishDraughtsRuleSet.boardGeometry,
      pieceVocabularyId: turkishDraughtsRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED10',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['turkish-draughts'],
      },
    },
    options,
  );
}
