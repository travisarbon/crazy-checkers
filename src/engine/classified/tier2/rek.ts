/**
 * Rek — Tier 2 Classified registration (Task 29.7, classifiedNumber 25).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createRekRuleSet } from '../custodian/rek';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { REK_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';

import { createRekNotationAdapter } from '../../../cogitate/notation/tier2/rek';

export { REK_ID };

const baseRekRuleSet = createRekRuleSet() as unknown as ClassifiedRuleSet;
export const rekRuleSet: ClassifiedRuleSet = {
  ...baseRekRuleSet,
  notationAdapter: createRekNotationAdapter(baseRekRuleSet.boardGeometry),
};

export function registerRek(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: REK_ID,
      classifiedNumber: 25,
      wave: 2,
      tier: 2,
      family: 'Capture Game',
      displayName: 'Rek',
      ruleSet: rekRuleSet,
      boardGeometry: rekRuleSet.boardGeometry,
      pieceVocabularyId: rekRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED25',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[2],
        family: TIER_2_FAMILY_LABELS['Capture Game'],
        connection: TIER_2_CONNECTIONS['rek'],
      },
      mvpRuleSummary:
        'Mak-yek with a King — capturing the opponent\'s King wins the game.',
    },
    options,
  );
}
