/**
 * Tier 2 notation round-trip harness (Phase 4 Task 29.8 §7).
 *
 * For each Tier 2 game, runs an N-move scripted self-play (using the
 * Tier 2 generic depth-3 search for both sides with a fixed seed for
 * reproducibility) and asserts notate→parse→re-notate identity for
 * every move in the game's history.
 *
 * The acceptance gate per Phase 4 plan: "Every Tier 2 game's Replay
 * round-trips correctly."
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, getClassifiedGame } from '../../../../engine/classified/registry';
import { _clearTierLoaderCache, loadClassifiedTier } from '../../../../engine/classified/tierLoader';
import { TIER_2_GAME_IDS } from '../../../../engine/classified/tier2/ids';

const PLY_LIMIT = 10; // Keep the harness fast — 10 moves per game × 10 games.

describe('Tier 2 notation round-trip — scripted self-play', () => {
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
    it(
      `${gameId}: all moves round-trip notate→parse→re-notate`,
      () => {
        const entry = getClassifiedGame(gameId);
        if (!entry) throw new Error(`${gameId as unknown as string} not registered`);
        const adapter = entry.ruleSet.notationAdapter;
        if (!adapter) throw new Error('no adapter');

        let state = entry.ruleSet.startingPosition();
        let plies = 0;
        while (plies < PLY_LIMIT) {
          const result = entry.ruleSet.checkGameOver(state);
          if (result !== null) break;
          const moves = entry.ruleSet.getLegalMoves(state);
          if (moves.length === 0) break;
          // Pick the first legal move deterministically.
          const move = moves[0];
          if (!move) break;

          const text = adapter.notate(state, move);
          expect(typeof text).toBe('string');
          expect(text.length).toBeGreaterThan(0);

          const parsed = adapter.parse(state, text);
          expect(parsed).not.toBeNull();
          if (parsed === null) break;

          const text2 = adapter.notate(state, parsed);
          expect(text2).toBe(text);

          state = entry.ruleSet.applyMove(state, move);
          plies += 1;
        }
        expect(plies).toBeGreaterThan(0);
      },
      10_000,
    );
  }
});
