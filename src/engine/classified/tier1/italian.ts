/**
 * Italian Draughts — Tier 1 Classified registration (Task 28.3, classifiedNumber 3).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createItalianDraughtsConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { ITALIAN_DRAUGHTS_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { ITALIAN_DRAUGHTS_ID };

export const italianDraughtsConfig = createItalianDraughtsConfig();
export const italianDraughtsRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  italianDraughtsConfig,
) as unknown as ClassifiedRuleSet;

export function registerItalianDraughts(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: ITALIAN_DRAUGHTS_ID,
      classifiedNumber: 3,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Italian Draughts',
      ruleSet: italianDraughtsRuleSet,
      boardGeometry: italianDraughtsRuleSet.boardGeometry,
      pieceVocabularyId: italianDraughtsRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED03',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['italian-draughts'],
      },
      mvpRuleSummary:
        'Non-flying kings on an 8×8 board; men cannot capture kings and must take the longest capture.',
    },
    options,
  );
}
