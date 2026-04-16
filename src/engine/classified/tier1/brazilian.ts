/**
 * Brazilian Draughts — Tier 1 Classified registration (Task 28.3, classifiedNumber 2).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createBrazilianDraughtsConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { BRAZILIAN_DRAUGHTS_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { BRAZILIAN_DRAUGHTS_ID };

export const brazilianDraughtsConfig = createBrazilianDraughtsConfig();
export const brazilianDraughtsRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  brazilianDraughtsConfig,
) as unknown as ClassifiedRuleSet;

export function registerBrazilianDraughts(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: BRAZILIAN_DRAUGHTS_ID,
      classifiedNumber: 2,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Brazilian Draughts',
      ruleSet: brazilianDraughtsRuleSet,
      boardGeometry: brazilianDraughtsRuleSet.boardGeometry,
      pieceVocabularyId: brazilianDraughtsRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED02',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['brazilian-draughts'],
      },
    },
    options,
  );
}
