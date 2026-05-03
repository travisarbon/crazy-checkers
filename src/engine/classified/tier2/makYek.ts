/**
 * Mak-yek — Tier 2 Classified registration (Task 29.7, classifiedNumber 23).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createMakYekRuleSet } from '../custodian/makYek';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { MAK_YEK_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';

import { createMakYekNotationAdapter } from '../../../cogitate/notation/tier2/makYek';

export { MAK_YEK_ID };

const baseMakYekRuleSet = createMakYekRuleSet() as unknown as ClassifiedRuleSet;
export const makYekRuleSet: ClassifiedRuleSet = {
  ...baseMakYekRuleSet,
  notationAdapter: createMakYekNotationAdapter(baseMakYekRuleSet.boardGeometry),
};

export function registerMakYek(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: MAK_YEK_ID,
      classifiedNumber: 23,
      wave: 2,
      tier: 2,
      family: 'Capture Game',
      displayName: 'Mak-yek',
      ruleSet: makYekRuleSet,
      boardGeometry: makYekRuleSet.boardGeometry,
      pieceVocabularyId: makYekRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED23',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[2],
        family: TIER_2_FAMILY_LABELS['Capture Game'],
        connection: TIER_2_CONNECTIONS['mak-yek'],
      },
      mvpRuleSummary:
        'Burmese custodian capture on 8×8 — flank an opponent between two of your pieces to remove them.',
    },
    options,
  );
}
