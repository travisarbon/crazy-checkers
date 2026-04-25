/**
 * Canadian Draughts — Tier 1 Classified registration (Task 28.3, classifiedNumber 8).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createCanadianDraughtsConfig } from '../draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../draughts/ParameterizedDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { CANADIAN_DRAUGHTS_ID } from './ids';
import {
  TIER_1_WAVE_LABEL,
  TIER_1_FAMILY_LABEL,
  TIER_1_CONNECTIONS,
} from './narratives';

export { CANADIAN_DRAUGHTS_ID };

export const canadianDraughtsConfig = createCanadianDraughtsConfig();
export const canadianDraughtsRuleSet: ClassifiedRuleSet = createDraughtsRuleSet(
  canadianDraughtsConfig,
) as unknown as ClassifiedRuleSet;

export function registerCanadianDraughts(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: CANADIAN_DRAUGHTS_ID,
      classifiedNumber: 8,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Canadian Draughts',
      ruleSet: canadianDraughtsRuleSet,
      boardGeometry: canadianDraughtsRuleSet.boardGeometry,
      pieceVocabularyId: canadianDraughtsRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED08',
      narrativeFlavor: {
        wave: TIER_1_WAVE_LABEL,
        family: TIER_1_FAMILY_LABEL,
        connection: TIER_1_CONNECTIONS['canadian-draughts'],
      },
      mvpRuleSummary:
        'International-style rules on a 12×12 board — thirty men per side with flying kings.',
    },
    options,
  );
}
