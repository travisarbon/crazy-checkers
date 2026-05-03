/**
 * Dameo — Tier 2 Classified registration (Task 29.7 + 29.G.1).
 *
 * classifiedNumber 11. Christian Freeling, 2000 — phalanx movement on
 * full 8×8. Per Task 29.G.1-D registration polish: refined narrativeFlavor
 * connection text, mvpRuleSummary cites the phalanx mechanic + capture
 * obligation, and the per-game Cogitate adapter is supplied directly so
 * the default-adapter dispatch doesn't have to guess the family.
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import { asAudioPackId } from '../pieceVocabulary';
import { createDameoRuleSet } from '../linear/LinearMovementEngine';
import {
  registerClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../registry';
import { DAMEO_ID } from './ids';
import {
  TIER_2_WAVE_LABELS,
  TIER_2_FAMILY_LABELS,
  TIER_2_CONNECTIONS,
} from './narratives';
import { createDameoNotationAdapter } from '../../../cogitate/notation/tier2/dameo';
import { createDameoAdapter } from '../../../cogitate/adapters/classified/dameoAdapter';

export { DAMEO_ID };

const baseDameoRuleSet = createDameoRuleSet() as unknown as ClassifiedRuleSet;
export const dameoRuleSet: ClassifiedRuleSet = {
  ...baseDameoRuleSet,
  notationAdapter: createDameoNotationAdapter(baseDameoRuleSet.boardGeometry),
};

export function registerDameo(
  options?: { replace?: boolean },
): ClassifiedRegistryEntry {
  // Build the per-game Cogitate adapter from a partial entry (the real
  // entry doesn't exist yet). The adapter only reads `gameId`, `modeId`,
  // `boardGeometry`, and `ruleSet` from the entry — same fields are
  // available pre-registration.
  const adapter = createDameoAdapter({
    gameId: DAMEO_ID,
    modeId: `classified-${DAMEO_ID}`,
    classifiedNumber: 11,
    wave: 1,
    tier: 2,
    family: 'Draughts',
    displayName: 'Dameo',
    ruleSet: dameoRuleSet,
    boardGeometry: dameoRuleSet.boardGeometry,
    pieceVocabularyId: dameoRuleSet.pieceVocabulary.id,
    audioPackId: asAudioPackId('default-draughts'),
    codeUnlockKey: 'CLASSIFIED11',
    narrativeFlavor: {
      wave: TIER_2_WAVE_LABELS[1],
      family: TIER_2_FAMILY_LABELS['Draughts'],
      connection: TIER_2_CONNECTIONS['dameo'],
    },
    registeredAt: 0,
  });
  return registerClassifiedGame(
    {
      gameId: DAMEO_ID,
      classifiedNumber: 11,
      wave: 1,
      tier: 2,
      family: 'Draughts',
      displayName: 'Dameo',
      ruleSet: dameoRuleSet,
      adapter,
      boardGeometry: dameoRuleSet.boardGeometry,
      pieceVocabularyId: dameoRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED11',
      narrativeFlavor: {
        wave: TIER_2_WAVE_LABELS[1],
        family: TIER_2_FAMILY_LABELS['Draughts'],
        // Task 29.G.1-D refined connection text per playbook §4.1
        // (Christian Freeling, 2000 attribution explicit).
        connection:
          'Christian Freeling, 2000 — full 8×8 board, 18 pawns per side, phalanx movement. ' +
          TIER_2_CONNECTIONS['dameo'],
      },
      mvpRuleSummary:
        '8×8 full board, 18 pawns per side. Men slide forward, sideways, or diagonally; capture orthogonally only. Linear groups (phalanxes) advance as a unit. Kings fly all 8 directions. Maximum captures mandatory.',
    },
    options,
  );
}
