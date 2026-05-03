/**
 * Hasami Shogi — Tier 2 Classified registration (Task 29.7, classifiedNumber 24).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createHasamiShogiRuleSet } from '../custodian/hasamiShogi';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { HASAMI_SHOGI_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';

import { createHasamiShogiNotationAdapter } from '../../../cogitate/notation/tier2/hasamiShogi';

export { HASAMI_SHOGI_ID };

const baseHasamiShogiRuleSet = createHasamiShogiRuleSet() as unknown as ClassifiedRuleSet;
export const hasamiShogiRuleSet: ClassifiedRuleSet = {
  ...baseHasamiShogiRuleSet,
  notationAdapter: createHasamiShogiNotationAdapter(baseHasamiShogiRuleSet.boardGeometry),
};

export function registerHasamiShogi(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: HASAMI_SHOGI_ID,
      classifiedNumber: 24,
      wave: 2,
      tier: 2,
      family: 'Capture Game',
      displayName: 'Hasami Shogi',
      ruleSet: hasamiShogiRuleSet,
      boardGeometry: hasamiShogiRuleSet.boardGeometry,
      pieceVocabularyId: hasamiShogiRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED24',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[2],
        family: TIER_2_FAMILY_LABELS['Capture Game'],
        connection: TIER_2_CONNECTIONS['hasami-shogi'],
      },
      mvpRuleSummary:
        'Japanese flanking-capture game on 9×9 — pieces move like rooks; lines flanked between two enemies are captured.',
    },
    options,
  );
}
