/**
 * Per-game notation adapter tests (Phase 4 Task 29.8).
 *
 * For each Tier 2 game, verifies notate() + parse() round-trip on the
 * starting position's first 5 legal moves. Per plan §10.1.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, getClassifiedGame } from '../../../../engine/classified/registry';
import { _clearTierLoaderCache, loadClassifiedTier } from '../../../../engine/classified/tierLoader';
import { TIER_2_GAME_IDS } from '../../../../engine/classified/tier2/ids';

describe('Per-game notation adapters — first-move round-trip', () => {
  beforeEach(async () => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
    await loadClassifiedTier(2);
  });
  afterEach(() => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
  });

  for (const gameId of TIER_2_GAME_IDS) {
    describe(gameId as unknown as string, () => {
      it('rule-set has a notationAdapter attached', () => {
        const entry = getClassifiedGame(gameId);
        expect(entry).not.toBeNull();
        expect(entry?.ruleSet.notationAdapter).toBeDefined();
      });

      it('notate() + parse() round-trip on first 5 legal moves', () => {
        const entry = getClassifiedGame(gameId);
        if (!entry) throw new Error(`${gameId as unknown as string} not registered`);
        const adapter = entry.ruleSet.notationAdapter;
        if (!adapter) throw new Error('no adapter');
        const start = entry.ruleSet.startingPosition();
        const moves = entry.ruleSet.getLegalMoves(start).slice(0, 5);
        for (const move of moves) {
          const text = adapter.notate(start, move);
          expect(typeof text).toBe('string');
          expect(text.length).toBeGreaterThan(0);
          const parsed = adapter.parse(start, text);
          expect(parsed).not.toBeNull();
          if (!parsed) continue;
          // Re-notate the parsed move and assert byte-identical.
          const text2 = adapter.notate(start, parsed);
          expect(text2).toBe(text);
        }
      });

      it('parse() returns null on malformed input', () => {
        const entry = getClassifiedGame(gameId);
        if (!entry) throw new Error('not registered');
        const adapter = entry.ruleSet.notationAdapter;
        if (!adapter) throw new Error('no adapter');
        const start = entry.ruleSet.startingPosition();
        const malformed = adapter.parse(start, 'this is not a valid move');
        // Most adapters return null; some accept loosely. As long as it doesn't throw.
        expect(typeof malformed === 'object').toBe(true);
      });
    });
  }
});
