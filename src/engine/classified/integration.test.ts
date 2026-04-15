/**
 * Integration test — Task 27.4 registration pipeline end-to-end.
 * Covers engine dispatch (`createNewGame(gameId, ...)`), worker
 * `registerRuleSet` / `getRuleSet` round-trip, and GameModeRegistry
 * surface visibility.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry } from './registry';
import { _clearTierLoaderCache, loadClassifiedTier } from './tierLoader';
import { createNewGame } from '../game';
import { PlayerType } from '../types';
import {
  getRuleSet,
  registerRuleSet,
  listRegisteredRuleSetIds,
} from '../../ai/worker';
import { createAmericanRules } from '../rules';
import { TEST_CHECKERS_CLONE_ID } from './tier0/testCheckersClone';
import { getClassifiedGames } from '../../persistence/gameModeRegistry';

beforeEach(() => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
});

describe('Task 27.4 integration', () => {
  const players = { white: PlayerType.Human, black: PlayerType.Human };

  it('createNewGame(<Phase 3 RuleSet>, ...) keeps the Phase 3 path intact', () => {
    const state = createNewGame(createAmericanRules(), players);
    expect(state.classifiedGameId).toBeUndefined();
    expect(state.board.length).toBe(32);
  });

  it('createNewGame("unknown-id", ...) throws a descriptive error', () => {
    expect(() => createNewGame('not-registered' as never, players)).toThrow(
      /not a registered Classified gameId/,
    );
  });

  it('createNewGame(<registered Classified gameId>, ...) returns a Classified state', async () => {
    await loadClassifiedTier(0);
    const state = createNewGame(TEST_CHECKERS_CLONE_ID, players);
    expect(state.classifiedGameId).toBe(TEST_CHECKERS_CLONE_ID);
    expect(state.classifiedState?.pieces.size).toBe(24);
    expect(state.board).toHaveLength(0);
  });

  it('shim RuleSet throws descriptively on Phase-1 method calls', async () => {
    await loadClassifiedTier(0);
    const state = createNewGame(TEST_CHECKERS_CLONE_ID, players);
    expect(() => state.ruleSet.getLegalMoves([], 'WHITE' as never)).toThrow(
      /ClassifiedRuleSet/,
    );
  });

  it('worker registerRuleSet / getRuleSet round-trips for american', () => {
    const rs = getRuleSet('american');
    expect(rs).not.toBeNull();
    expect(listRegisteredRuleSetIds()).toContain('american');
  });

  it('registerRuleSet installs a new factory and getRuleSet resolves it', () => {
    const factory = () => createAmericanRules();
    registerRuleSet('extra-test', factory);
    expect(getRuleSet('extra-test')).not.toBeNull();
    expect(listRegisteredRuleSetIds()).toContain('extra-test');
  });

  it('getRuleSet returns null for an unknown id', () => {
    expect(getRuleSet('never-heard-of-it')).toBeNull();
  });

  it('getClassifiedGames includes the Tier 0 fixture entries', async () => {
    await loadClassifiedTier(0);
    const games = getClassifiedGames();
    // Tier 0 fixtures use classifiedNumber 0 / -1; placeholders use 1..64.
    expect(games.some((g) => g.id === 'classified-classified-test-tier-0')).toBe(true);
    expect(games.some((g) => g.id === 'classified-classified-test-tier-shogi')).toBe(true);
  });
});
