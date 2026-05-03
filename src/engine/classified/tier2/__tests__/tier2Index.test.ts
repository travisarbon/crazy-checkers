import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, getClassifiedGames } from '../../registry';
import { _clearTierLoaderCache, loadClassifiedTier } from '../../tierLoader';
import { registerTier2 } from '../index';
import { TIER_2_GAME_IDS } from '../ids';

describe('registerTier2()', () => {
  beforeEach(() => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
  });
  afterEach(() => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
  });

  it('registers all 10 games in classifiedNumber order', () => {
    registerTier2();
    const games = getClassifiedGames().filter((g) => g.tier === 2);
    expect(games).toHaveLength(10);
    const order = games.map((g) => g.classifiedNumber);
    expect(order).toEqual([11, 12, 13, 14, 15, 23, 24, 25, 33, 49]);
  });

  it('is idempotent (replace mode) — running twice does not throw', () => {
    registerTier2();
    expect(() => {
      registerTier2();
    }).not.toThrow();
  });

  it('TIER_2_GAME_IDS lists all 10 ids in classifiedNumber order', () => {
    expect(TIER_2_GAME_IDS).toHaveLength(10);
    expect(TIER_2_GAME_IDS[0]).toBe('dameo');
    expect(TIER_2_GAME_IDS[9]).toBe('cheskers');
  });
});

describe('loadClassifiedTier(2) integration', () => {
  beforeEach(() => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
  });
  afterEach(() => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
  });

  it('resolves and registers all 10 Tier 2 games', async () => {
    await loadClassifiedTier(2);
    const games = getClassifiedGames().filter((g) => g.tier === 2);
    expect(games).toHaveLength(10);
  });

  it('caches the load promise (calling twice resolves the same value)', async () => {
    const a = loadClassifiedTier(2);
    const b = loadClassifiedTier(2);
    expect(a).toBe(b);
    await a;
  });
});
