/**
 * Frysk! — Tier 1 Classified registration (Task 28.3, classifiedNumber 5).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createFryskConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { FRYSK_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { FRYSK_ID };

export const fryskConfig = createFryskConfig();
export const fryskRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  fryskConfig,
) as unknown as ClassifiedRuleSet;

export function registerFrysk(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: FRYSK_ID,
      classifiedNumber: 5,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Frysk!',
      ruleSet: fryskRuleSet,
      boardGeometry: fryskRuleSet.boardGeometry,
      pieceVocabularyId: fryskRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED05',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['frysk'],
      },
    },
    options,
  );
}
