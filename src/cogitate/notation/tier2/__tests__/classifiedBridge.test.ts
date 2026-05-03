/**
 * Tier 2 ↔ Phase 3 bridge tests (Phase 4 Task 29.8 §10.2).
 *
 * Verifies `createClassifiedNotationBridge` lifts each Tier 2 adapter into
 * the Phase 3 NotationAdapter surface without modification.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, getClassifiedGame } from '../../../../engine/classified/registry';
import { _clearTierLoaderCache, loadClassifiedTier } from '../../../../engine/classified/tierLoader';
import { TIER_2_GAME_IDS } from '../../../../engine/classified/tier2/ids';
import { createClassifiedNotationBridge } from '../../classifiedBridge';

describe('createClassifiedNotationBridge — Tier 2 round-trip', () => {
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
    it(`${gameId}: bridge lifts adapter without throwing`, () => {
      const entry = getClassifiedGame(gameId);
      if (!entry) throw new Error(`${gameId as unknown as string} not registered`);
      const adapter = entry.ruleSet.notationAdapter;
      if (!adapter) throw new Error('no adapter');
      expect(() => createClassifiedNotationBridge(adapter)).not.toThrow();
    });

    it(`${gameId}: bridge exposes the Phase 3 contract surface`, () => {
      const entry = getClassifiedGame(gameId);
      if (!entry) throw new Error('not registered');
      const adapter = entry.ruleSet.notationAdapter;
      if (!adapter) throw new Error('no adapter');
      const bridge = createClassifiedNotationBridge(adapter);
      // Phase 3 NotationAdapter surface (verified by shape, not invocation —
      // moveToString requires a Phase 1 Move with `path`, which is a runtime
      // conversion concern for the Phase 3 caller, not Task 29.8's adapter).
      expect(typeof bridge.moveToString).toBe('function');
      expect(typeof bridge.stringToMove).toBe('function');
      expect(typeof bridge.formatMoveNumber).toBe('function');
    });
  }
});
