/**
 * Cheskers — Tier 2 Classified registration (Task 29.7, classifiedNumber 49).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createCheskersRuleSet } from '../cheskers/CheskersRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { CHESKERS_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';

import { createCheskersNotationAdapter } from '../../../cogitate/notation/tier2/cheskers';

export { CHESKERS_ID };

const baseCheskersRuleSet = createCheskersRuleSet() as unknown as ClassifiedRuleSet;
export const cheskersRuleSet: ClassifiedRuleSet = {
  ...baseCheskersRuleSet,
  notationAdapter: createCheskersNotationAdapter(baseCheskersRuleSet.boardGeometry),
};

export function registerCheskers(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  return registerClassifiedGame(
    {
      gameId: CHESKERS_ID,
      classifiedNumber: 49,
      wave: 6,
      tier: 2,
      // Closed ClassifiedFamily union doesn't include "Chess/Draughts
      // Hybrid" — register under "Abstract Strategy" as the catch-all.
      // See RULES_NOTES.md §family-naming.
      family: 'Abstract Strategy',
      displayName: 'Cheskers',
      ruleSet: cheskersRuleSet,
      boardGeometry: cheskersRuleSet.boardGeometry,
      pieceVocabularyId: cheskersRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED49',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[6],
        family: TIER_2_FAMILY_LABELS['Abstract Strategy'],
        connection: TIER_2_CONNECTIONS['cheskers'],
      },
      mvpRuleSummary:
        'Solomon Golomb 1948 hybrid: 4 piece types (Pawn, King, Bishop, Camel). Pawn/King mandatory jumps, Bishop/Camel optional displacement.',
    },
    options,
  );
}
