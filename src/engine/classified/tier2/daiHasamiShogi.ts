/**
 * Dai Hasami Shogi — Tier 2 Classified registration (Task 29.7, classifiedNumber 33).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createDaiHasamiShogiRuleSet } from '../custodian/daiHasamiShogi';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { DAI_HASAMI_SHOGI_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';

import { createDaiHasamiShogiNotationAdapter } from '../../../cogitate/notation/tier2/daiHasamiShogi';

export { DAI_HASAMI_SHOGI_ID };

const baseDaiHasamiShogiRuleSet =
  createDaiHasamiShogiRuleSet() as unknown as ClassifiedRuleSet;
export const daiHasamiShogiRuleSet: ClassifiedRuleSet = {
  ...baseDaiHasamiShogiRuleSet,
  notationAdapter: createDaiHasamiShogiNotationAdapter(
    baseDaiHasamiShogiRuleSet.boardGeometry,
  ),
};

export function registerDaiHasamiShogi(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: DAI_HASAMI_SHOGI_ID,
      classifiedNumber: 33,
      wave: 3,
      tier: 2,
      // Closed ClassifiedFamily union doesn't include "Connection/Capture
      // Game" (the placeholder data label) so we register as the closest
      // closed-union match. See RULES_NOTES.md §family-naming.
      family: 'Connection Game',
      displayName: 'Dai Hasami Shogi',
      ruleSet: daiHasamiShogiRuleSet,
      boardGeometry: daiHasamiShogiRuleSet.boardGeometry,
      pieceVocabularyId: daiHasamiShogiRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED33',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[3],
        family: TIER_2_FAMILY_LABELS['Connection Game'],
        connection: TIER_2_CONNECTIONS['dai-hasami-shogi'],
      },
      mvpRuleSummary:
        '"Big Hasami Shogi" on 9×9 — win by reducing opponent to ≤5 pieces OR by lining up 5 in a row.',
    },
    options,
  );
}
