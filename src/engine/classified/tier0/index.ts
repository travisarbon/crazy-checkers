// TESTING ONLY — Tier 0 index module.
//
// Imported via `loadClassifiedTier(0)`. The loader invokes
// `registerTier0()` on every call so `_clearClassifiedRegistry` in tests
// can be followed by `_clearTierLoaderCache` + `loadClassifiedTier(0)` to
// restore a clean fixture state. `{ replace: true }` makes the function
// safe to call repeatedly within a single session.

import { asAudioPackId } from '../pieceVocabulary';
import { registerClassifiedGame } from '../registry';
import {
  testCheckersCloneRuleSet,
  TEST_CHECKERS_CLONE_ID,
} from './testCheckersClone';
import { testShogiCloneRuleSet, TEST_SHOGI_CLONE_ID } from './testShogiClone';

export function registerTier0(): void {
  registerClassifiedGame(
    {
      gameId: TEST_CHECKERS_CLONE_ID,
      classifiedNumber: 0,
      wave: 1,
      tier: 1,
      family: 'Test',
      displayName: 'Test Tier 0 Checkers Clone',
      ruleSet: testCheckersCloneRuleSet,
      boardGeometry: testCheckersCloneRuleSet.boardGeometry,
      pieceVocabularyId: testCheckersCloneRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'TESTTIERZERO',
      narrativeFlavor: {
        wave: 'Test — Fixture',
        family: 'Test',
        connection: 'Task 27.4 registration fixture for the checkers-clone path.',
      },
      mvpRuleSummary:
        'Integration-test fixture. Starting layout mirrors American Checkers on an 8×8 board.',
    },
    { allowTierZero: true, replace: true },
  );

  registerClassifiedGame(
    {
      gameId: TEST_SHOGI_CLONE_ID,
      classifiedNumber: -1,
      wave: 1,
      tier: 1,
      family: 'Test',
      displayName: 'Test Tier 0 Shogi Clone',
      ruleSet: testShogiCloneRuleSet,
      boardGeometry: testShogiCloneRuleSet.boardGeometry,
      pieceVocabularyId: testShogiCloneRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'TESTTIERSHOGI',
      narrativeFlavor: {
        wave: 'Test — Fixture',
        family: 'Test',
        connection: 'Task 27.4 registration fixture for the hand / drops pathway.',
      },
      mvpRuleSummary:
        'Integration-test fixture exercising the hand / drops registration pathway.',
    },
    { allowTierZero: true, replace: true },
  );
}
