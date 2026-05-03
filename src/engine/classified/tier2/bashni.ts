/**
 * Bashni — Tier 2 Classified registration (Task 29.7, classifiedNumber 14).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createBashniRuleSet } from '../stacking/StackingDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { BASHNI_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';

import { createBashniStackingNotationAdapter } from '../../../cogitate/notation/tier2/bashni';

export { BASHNI_ID };

const baseBashniRuleSet = createBashniRuleSet() as unknown as ClassifiedRuleSet;
export const bashniRuleSet: ClassifiedRuleSet = {
  ...baseBashniRuleSet,
  notationAdapter: createBashniStackingNotationAdapter(baseBashniRuleSet.boardGeometry),
};

export function registerBashni(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: BASHNI_ID,
      classifiedNumber: 14,
      wave: 1,
      tier: 2,
      family: 'Stacking Draughts',
      displayName: 'Bashni',
      ruleSet: bashniRuleSet,
      boardGeometry: bashniRuleSet.boardGeometry,
      pieceVocabularyId: bashniRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED14',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[1],
        family: TIER_2_FAMILY_LABELS['Stacking Draughts'],
        connection: TIER_2_CONNECTIONS['bashni'],
      },
      mvpRuleSummary:
        'Russian Lasca on the full 8×8 American board: stack-on-capture with flying kings inside towers.',
    },
    options,
  );
}
