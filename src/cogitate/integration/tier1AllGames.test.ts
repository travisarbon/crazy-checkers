/**
 * Integration smoke test for all 10 Tier 1 Classified draughts games
 * (Task 28.6 §7).
 *
 * Validates the end-to-end Cogitate adapter pipeline: registration →
 * adapter dispatch → notation bridge → evaluation bridge → position
 * validation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadClassifiedTier } from '../../engine/classified/tierLoader';
import {
  getClassifiedGame,
  _clearClassifiedRegistry,
} from '../../engine/classified/registry';
import { _clearTierLoaderCache } from '../../engine/classified/tierLoader';
import { getAdapter } from '../CogitateGameAdapter';
import { TIER_1_GAME_IDS } from '../../engine/classified/tier1/ids';

describe('Tier 1 Classified Draughts — Full Integration', () => {
  beforeAll(async () => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
    await loadClassifiedTier(1);
  });

  it.each([...TIER_1_GAME_IDS])(
    '%s: ruleSetFamily is "draughts"',
    (gameId) => {
      const entry = getClassifiedGame(gameId);
      expect(entry).not.toBeNull();
      expect(entry?.ruleSet.ruleSetFamily).toBe('draughts');
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: Cogitate adapter is registered and functional',
    (gameId) => {
      const entry = getClassifiedGame(gameId);
      expect(entry).not.toBeNull();
      if (!entry) return;

      const adapter = getAdapter(entry.modeId);
      expect(adapter).not.toBeNull();
      if (!adapter) return;

      // Core adapter methods are functional.
      expect(adapter.modeId).toBe(entry.modeId);
      expect(adapter.supportsEvaluation()).toBe(true);

      const geo = adapter.getBoardGeometry();
      expect(geo.rows).toBeGreaterThanOrEqual(8);
      expect(geo.playableSquares).toBeGreaterThan(0);

      const pos = adapter.getStartingPosition();
      expect(pos).toBeDefined();

      const validation = adapter.validatePosition(pos);
      expect(validation.isLegal).toBe(true);
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: evaluation provider returns finite scores',
    (gameId) => {
      const entry = getClassifiedGame(gameId);
      if (!entry) return;

      const adapter = getAdapter(entry.modeId);
      if (!adapter) return;

      const provider = adapter.getEvaluationProvider();
      expect(provider.isAvailable).toBe(true);

      const pos = adapter.getStartingPosition();
      const result = provider.evaluate(pos, 'WHITE' as never);
      expect(result).not.toBeNull();
      if (result) {
        expect(Number.isFinite(result.score)).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(-1);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: notation adapter produces non-empty PDN',
    (gameId) => {
      const entry = getClassifiedGame(gameId);
      if (!entry) return;

      const adapter = getAdapter(entry.modeId);
      if (!adapter) return;

      const notation = adapter.getNotationAdapter();
      // formatMoveNumber should produce PDN-style numbering.
      const formatted = notation.formatMoveNumber(0, '1-5');
      expect(formatted).toContain('1.');
      expect(formatted.length).toBeGreaterThan(0);
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: serialization produces non-empty string',
    (gameId) => {
      const entry = getClassifiedGame(gameId);
      if (!entry) return;

      const adapter = getAdapter(entry.modeId);
      if (!adapter) return;

      const pos = adapter.getStartingPosition();
      const serialized = adapter.serializeBoard(pos);
      expect(serialized.length).toBeGreaterThan(0);
    },
  );

  it.each([...TIER_1_GAME_IDS])(
    '%s: AI config for hard has quiescence enabled',
    (gameId) => {
      const entry = getClassifiedGame(gameId);
      if (!entry) return;

      const adapter = getAdapter(entry.modeId);
      if (!adapter) return;

      const config = adapter.getAIConfig('hard');
      expect(config.quiescenceEnabled).toBe(true);
      expect(config.maxDepth).toBeGreaterThanOrEqual(7);
    },
  );

  it('all 10 Tier 1 games have distinct modeIds', () => {
    const modeIds = new Set<string>();
    for (const gameId of TIER_1_GAME_IDS) {
      const entry = getClassifiedGame(gameId);
      expect(entry).not.toBeNull();
      if (entry) {
        expect(modeIds.has(entry.modeId)).toBe(false);
        modeIds.add(entry.modeId);
      }
    }
    expect(modeIds.size).toBe(10);
  });
});
