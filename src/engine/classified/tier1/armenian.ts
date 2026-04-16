/**
 * Armenian Draughts — Tier 1 Classified registration (Task 28.3, classifiedNumber 9).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createArmenianDraughtsConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { ARMENIAN_DRAUGHTS_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { ARMENIAN_DRAUGHTS_ID };

export const armenianDraughtsConfig = createArmenianDraughtsConfig();
export const armenianDraughtsRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  armenianDraughtsConfig,
) as unknown as ClassifiedRuleSet;

export function registerArmenianDraughts(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: ARMENIAN_DRAUGHTS_ID,
      classifiedNumber: 9,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Armenian Draughts',
      ruleSet: armenianDraughtsRuleSet,
      boardGeometry: armenianDraughtsRuleSet.boardGeometry,
      pieceVocabularyId: armenianDraughtsRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED09',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['armenian-draughts'],
      },
    },
    options,
  );
}
