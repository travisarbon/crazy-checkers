/**
 * Malaysian Checkers — Tier 1 Classified registration (Task 28.3, classifiedNumber 7).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createMalaysianCheckersConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { MALAYSIAN_CHECKERS_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { MALAYSIAN_CHECKERS_ID };

export const malaysianCheckersConfig = createMalaysianCheckersConfig();
export const malaysianCheckersRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  malaysianCheckersConfig,
) as unknown as ClassifiedRuleSet;

export function registerMalaysianCheckers(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: MALAYSIAN_CHECKERS_ID,
      classifiedNumber: 7,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Malaysian Checkers',
      ruleSet: malaysianCheckersRuleSet,
      boardGeometry: malaysianCheckersRuleSet.boardGeometry,
      pieceVocabularyId: malaysianCheckersRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED07',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['malaysian-checkers'],
      },
    },
    options,
  );
}
