/**
 * Lasca — Tier 2 Classified registration (Task 29.7, classifiedNumber 13).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createLascaRuleSet } from '../stacking/StackingDraughtsRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { LASCA_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';

import { createLascaStackingNotationAdapter } from '../../../cogitate/notation/tier2/lasca';

export { LASCA_ID };

const baseLascaRuleSet = createLascaRuleSet() as unknown as ClassifiedRuleSet;
export const lascaRuleSet: ClassifiedRuleSet = {
  ...baseLascaRuleSet,
  notationAdapter: createLascaStackingNotationAdapter(baseLascaRuleSet.boardGeometry),
};

export function registerLasca(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: LASCA_ID,
      classifiedNumber: 13,
      wave: 1,
      tier: 2,
      family: 'Stacking Draughts',
      displayName: 'Lasca',
      ruleSet: lascaRuleSet,
      boardGeometry: lascaRuleSet.boardGeometry,
      pieceVocabularyId: lascaRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED13',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[1],
        family: TIER_2_FAMILY_LABELS['Stacking Draughts'],
        connection: TIER_2_CONNECTIONS['lasca'],
      },
      mvpRuleSummary:
        'Pieces stack on capture — the captor lands on top of the captured. 7×7 board.',
    },
    options,
  );
}
