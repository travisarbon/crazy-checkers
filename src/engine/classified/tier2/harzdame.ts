/**
 * Harzdame — Tier 2 Classified registration (Task 29.7, classifiedNumber 12).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createHarzdameRuleSet } from '../harzdame/HarzdameRules';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { HARZDAME_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';
import { createTier2StubAdapter } from './tier2StubAdapter';
import { createHarzdameNotationAdapter } from '../../../cogitate/notation/tier2/harzdame';

export { HARZDAME_ID };

const baseHarzdameRuleSet = createHarzdameRuleSet() as unknown as ClassifiedRuleSet;
export const harzdameRuleSet: ClassifiedRuleSet = {
  ...baseHarzdameRuleSet,
  notationAdapter: createHarzdameNotationAdapter(baseHarzdameRuleSet.boardGeometry),
};

export function registerHarzdame(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  // Harzdame's rule-set declares ruleSetFamily: 'draughts' — the default
  // adapter dispatches that to the Tier 1 draughts adapter, which then
  // tries to look up Tier 1 evaluator weights for "harzdame" and throws.
  // Override with the Tier 2 stub adapter; per-game subtask 29.G.2-C
  // ships the bespoke Cogitate adapter.
  const adapter = createTier2StubAdapter({
    gameId: HARZDAME_ID,
    modeId: `classified-${HARZDAME_ID}`,
    ruleSet: harzdameRuleSet,
    boardGeometry: harzdameRuleSet.boardGeometry,
  });
  return registerClassifiedGame(
    {
      gameId: HARZDAME_ID,
      classifiedNumber: 12,
      // Wave 1 per playbook + Tier 2 review checklist; the Phase 4 plan's
      // per-game subtask wording reads "wave 2" but is treated as a typo
      // (see RULES_NOTES.md §wave-anomaly).
      wave: 1,
      tier: 2,
      family: 'Draughts',
      displayName: 'Harzdame',
      ruleSet: harzdameRuleSet,
      adapter,
      boardGeometry: harzdameRuleSet.boardGeometry,
      pieceVocabularyId: harzdameRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED12',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[1],
        family: TIER_2_FAMILY_LABELS['Draughts'],
        connection: TIER_2_CONNECTIONS['harzdame'],
      },
      mvpRuleSummary:
        'Asymmetric men + senior-king tier earned by completing the longest capture chain in a position.',
    },
    options,
  );
}
