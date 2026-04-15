import { beforeEach, describe, expect, it } from 'vitest';
import { _clearTierLoaderCache, loadClassifiedTier } from './tierLoader';
import { _clearClassifiedRegistry, isClassifiedRegistered } from './registry';
import { TEST_CHECKERS_CLONE_ID } from './tier0/testCheckersClone';
import { TEST_SHOGI_CLONE_ID } from './tier0/testShogiClone';

beforeEach(() => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
});

describe('loadClassifiedTier — tier 0 fixture pathway', () => {
  it('resolves and registers both Tier 0 fixtures', async () => {
    await loadClassifiedTier(0);
    expect(isClassifiedRegistered(TEST_CHECKERS_CLONE_ID)).toBe(true);
    expect(isClassifiedRegistered(TEST_SHOGI_CLONE_ID)).toBe(true);
  });

  it('repeated calls share the same underlying promise', () => {
    const first = loadClassifiedTier(0);
    const second = loadClassifiedTier(0);
    expect(first).toBe(second);
  });
});

describe('loadClassifiedTier — unknown tier', () => {
  it('rejects on tier numbers outside 0..7', async () => {
    await expect(loadClassifiedTier(99)).rejects.toThrow(/invalid tier number/);
  });

  it('rejects on a not-yet-authored tier (1..7)', async () => {
    await expect(loadClassifiedTier(1)).rejects.toThrow(/not yet authored/);
  });
});
