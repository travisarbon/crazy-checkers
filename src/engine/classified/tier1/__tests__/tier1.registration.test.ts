/**
 * Tier 1 smoke test (Task 28.3 §7.2).
 *
 * Validates that `registerTier1()` runs cleanly from a clean registry and
 * produces ten entries in the expected order, and that
 * `loadClassifiedTier(1)` is idempotent.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearClassifiedRegistry,
  getClassifiedGames,
  getClassifiedGamesByTier,
} from '../../registry';
import { _clearTierLoaderCache, loadClassifiedTier } from '../../tierLoader';

beforeEach(() => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
});

describe('registerTier1', () => {
  it('registers all ten Tier 1 games', async () => {
    await loadClassifiedTier(1);
    const entries = getClassifiedGamesByTier(1);
    expect(entries).toHaveLength(10);
    expect(entries.map((e) => e.classifiedNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(entries.map((e) => e.gameId)).toEqual([
      'russian-draughts',
      'brazilian-draughts',
      'italian-draughts',
      'international-checkers',
      'frysk',
      'frisian-draughts',
      'malaysian-checkers',
      'canadian-draughts',
      'armenian-draughts',
      'turkish-draughts',
    ]);
  });

  it('loadClassifiedTier(1) returns the same in-flight promise on repeat calls', async () => {
    const p1 = loadClassifiedTier(1);
    const p2 = loadClassifiedTier(1);
    expect(p1).toBe(p2);
    await p1;
    expect(getClassifiedGamesByTier(1)).toHaveLength(10);
  });

  it('registerTier1 can be called directly with clean state', async () => {
    const mod = await import('../index');
    mod.registerTier1();
    expect(getClassifiedGamesByTier(1)).toHaveLength(10);
  });

  it('registerTier1 is safe to call repeatedly within a session', async () => {
    const mod = await import('../index');
    mod.registerTier1();
    expect(() => {
      mod.registerTier1();
    }).not.toThrow();
    // Total count remains ten — { replace: true } overwrites the prior entries.
    expect(getClassifiedGames()).toHaveLength(10);
  });
});
