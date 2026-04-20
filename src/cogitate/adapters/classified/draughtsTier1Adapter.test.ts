import { describe, it, expect, beforeAll } from 'vitest';
import { createDraughtsTier1Adapter } from './draughtsTier1Adapter';
import { loadClassifiedTier } from '../../../engine/classified/tierLoader';
import {
  getClassifiedGame,
  _clearClassifiedRegistry,
} from '../../../engine/classified/registry';
import { _clearTierLoaderCache } from '../../../engine/classified/tierLoader';
import { TIER_1_GAME_IDS } from '../../../engine/classified/tier1/ids';
import type { ClassifiedRegistryEntry } from '../../../engine/classified/registry';
import type { ClassifiedGameId } from '../../../engine/classified/ClassifiedRuleSet';

describe('draughtsTier1Adapter', () => {
  beforeAll(async () => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
    await loadClassifiedTier(1);
  });

  function getEntry(gameId: string): ClassifiedRegistryEntry {
    const entry = getClassifiedGame(gameId as ClassifiedGameId);
    if (!entry) throw new Error(`Game ${gameId} not registered`);
    return entry;
  }

  it.each([...TIER_1_GAME_IDS])(
    '%s: factory returns a functional adapter',
    (gameId) => {
      const entry = getEntry(gameId);
      const adapter = createDraughtsTier1Adapter(entry);
      expect(adapter.modeId).toBe(entry.modeId);
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: supportsEvaluation returns true',
    (gameId) => {
      const entry = getEntry(gameId);
      const adapter = createDraughtsTier1Adapter(entry);
      expect(adapter.supportsEvaluation()).toBe(true);
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: getBoardGeometry returns valid geometry',
    (gameId) => {
      const entry = getEntry(gameId);
      const adapter = createDraughtsTier1Adapter(entry);
      const geo = adapter.getBoardGeometry();
      expect(geo.rows).toBeGreaterThanOrEqual(8);
      expect(geo.cols).toBeGreaterThanOrEqual(8);
      expect(geo.playableSquares).toBeGreaterThan(0);
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: getStartingPosition returns a ClassifiedGameState',
    (gameId) => {
      const entry = getEntry(gameId);
      const adapter = createDraughtsTier1Adapter(entry);
      const pos = adapter.getStartingPosition();
      // ClassifiedGameState has a pieces Map
      const state = pos as unknown as { pieces: unknown };
      expect(state.pieces).toBeInstanceOf(Map);
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: getEvaluationProvider returns an available provider',
    (gameId) => {
      const entry = getEntry(gameId);
      const adapter = createDraughtsTier1Adapter(entry);
      const provider = adapter.getEvaluationProvider();
      expect(provider.isAvailable).toBe(true);
      expect(provider.providerType).toBe('classified-draughts');
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: getNotationAdapter returns a working notation adapter',
    (gameId) => {
      const entry = getEntry(gameId);
      const adapter = createDraughtsTier1Adapter(entry);
      const notation = adapter.getNotationAdapter();
      // formatMoveNumber produces PDN-format numbering.
      const formatted = notation.formatMoveNumber(0, '1-5');
      expect(formatted).toContain('1.');
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: getAIConfig returns valid search config for hard',
    (gameId) => {
      const entry = getEntry(gameId);
      const adapter = createDraughtsTier1Adapter(entry);
      const config = adapter.getAIConfig('hard');
      expect(config.maxDepth).toBeGreaterThanOrEqual(7);
      expect(config.timeLimitMs).toBeGreaterThan(0);
      expect(config.quiescenceEnabled).toBe(true);
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: validatePosition validates the starting position as legal',
    (gameId) => {
      const entry = getEntry(gameId);
      const adapter = createDraughtsTier1Adapter(entry);
      const pos = adapter.getStartingPosition();
      const result = adapter.validatePosition(pos);
      expect(result.isLegal).toBe(true);
      expect(result.errors).toHaveLength(0);
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: serializeBoard produces a non-empty string',
    (gameId) => {
      const entry = getEntry(gameId);
      const adapter = createDraughtsTier1Adapter(entry);
      const pos = adapter.getStartingPosition();
      const serialized = adapter.serializeBoard(pos);
      expect(serialized.length).toBeGreaterThan(0);
    },
  );

  it('getRuleSet throws with clear message', () => {
    const entry = getEntry(TIER_1_GAME_IDS[0] as string);
    const adapter = createDraughtsTier1Adapter(entry);
    expect(() => adapter.getRuleSet()).toThrow('not supported for Classified game');
  });
});
