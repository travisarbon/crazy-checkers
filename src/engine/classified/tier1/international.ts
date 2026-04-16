/**
 * International Checkers — Tier 1 Classified registration (Task 28.3, classifiedNumber 4).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createInternationalCheckersConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { INTERNATIONAL_CHECKERS_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { INTERNATIONAL_CHECKERS_ID };

export const internationalCheckersConfig = createInternationalCheckersConfig();
export const internationalCheckersRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  internationalCheckersConfig,
) as unknown as ClassifiedRuleSet;

export function registerInternationalCheckers(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: INTERNATIONAL_CHECKERS_ID,
      classifiedNumber: 4,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'International Checkers',
      ruleSet: internationalCheckersRuleSet,
      boardGeometry: internationalCheckersRuleSet.boardGeometry,
      pieceVocabularyId: internationalCheckersRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED04',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['international-checkers'],
      },
    },
    options,
  );
}
