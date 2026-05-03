/**
 * Zamma — Tier 2 Classified registration (Task 29.7, classifiedNumber 15).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createZammaRuleSet } from '../alquerque/ZammaRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { ZAMMA_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';

import { createZammaNotationAdapter } from '../../../cogitate/notation/tier2/zamma';

export { ZAMMA_ID };

const baseZammaRuleSet = createZammaRuleSet() as unknown as ClassifiedRuleSet;
export const zammaRuleSet: ClassifiedRuleSet = {
  ...baseZammaRuleSet,
  notationAdapter: createZammaNotationAdapter(baseZammaRuleSet.boardGeometry),
};

export function registerZamma(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: ZAMMA_ID,
      classifiedNumber: 15,
      wave: 2,
      tier: 2,
      family: 'Capture Game',
      displayName: 'Zamma',
      ruleSet: zammaRuleSet,
      boardGeometry: zammaRuleSet.boardGeometry,
      pieceVocabularyId: zammaRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED15',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[2],
        family: TIER_2_FAMILY_LABELS['Capture Game'],
        connection: TIER_2_CONNECTIONS['zamma'],
      },
      mvpRuleSummary:
        'Saharan capture game on the alquerque graph (9×9 + diagonals). Mullah (king) earns extra mobility.',
    },
    options,
  );
}
