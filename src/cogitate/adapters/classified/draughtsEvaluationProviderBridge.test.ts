import { describe, it, expect, beforeAll } from 'vitest';
import { createDraughtsEvaluationProviderBridge } from './draughtsEvaluationProviderBridge';
import { loadClassifiedTier } from '../../../engine/classified/tierLoader';
import { _clearClassifiedRegistry } from '../../../engine/classified/registry';
import { _clearTierLoaderCache } from '../../../engine/classified/tierLoader';
import { TIER_1_DRAUGHTS_GAME_IDS, createDraughtsConfig } from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../../../engine/classified/draughts/ParameterizedDraughtsRules';
import type { BoardState } from '../../../engine/types';
import { PieceColor } from '../../../engine/types';

describe('draughtsEvaluationProviderBridge', () => {
  beforeAll(async () => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
    await loadClassifiedTier(1);
  });

  it.each([...TIER_1_DRAUGHTS_GAME_IDS])(
    '%s: isAvailable returns true',
    (gameId: DraughtsGameId) => {
      const provider = createDraughtsEvaluationProviderBridge(gameId);
      expect(provider.isAvailable).toBe(true);
    },
  );

  it.each([...TIER_1_DRAUGHTS_GAME_IDS])(
    '%s: evaluate returns normalised score in [-1, 1] for starting position',
    (gameId: DraughtsGameId) => {
      const provider = createDraughtsEvaluationProviderBridge(gameId);
      const config = createDraughtsConfig(gameId);
      const ruleSet = createDraughtsRuleSet(config);
      const state = ruleSet.startingPosition();

      // Pass ClassifiedGameState as BoardState (bridged).
      const result = provider.evaluate(
        state as unknown as BoardState,
        PieceColor.White,
      );

      expect(result).not.toBeNull();
      if (result) {
        expect(result.score).toBeGreaterThanOrEqual(-1);
        expect(result.score).toBeLessThanOrEqual(1);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    },
  );

  it('evaluate returns null for non-ClassifiedGameState', () => {
    const provider = createDraughtsEvaluationProviderBridge('russian-draughts');
    // Pass a raw Phase 1 BoardState array.
    const result = provider.evaluate(
      [] as unknown as BoardState,
      PieceColor.White,
    );
    expect(result).toBeNull();
  });

  it('getTopMoves returns empty array for non-ClassifiedGameState', () => {
    const provider = createDraughtsEvaluationProviderBridge('russian-draughts');
    const moves = provider.getTopMoves(
      [] as unknown as BoardState,
      PieceColor.White,
      3,
      {} as never,
      { maxDepth: 2, timeLimitMs: 200, quiescenceEnabled: false, quiescenceMaxDepth: 0 },
    );
    expect(moves).toHaveLength(0);
  });

  it('getTopMoves returns scored moves for starting position', () => {
    const provider = createDraughtsEvaluationProviderBridge('russian-draughts');
    const config = createDraughtsConfig('russian-draughts');
    const ruleSet = createDraughtsRuleSet(config);
    const state = ruleSet.startingPosition();

    const moves = provider.getTopMoves(
      state as unknown as BoardState,
      PieceColor.White,
      3,
      {} as never,
      { maxDepth: 2, timeLimitMs: 500, quiescenceEnabled: false, quiescenceMaxDepth: 0 },
    );

    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(3);
    for (const m of moves) {
      expect(m.normalizedScore).toBeGreaterThanOrEqual(-1);
      expect(m.normalizedScore).toBeLessThanOrEqual(1);
    }
  });

  it('providerType is "classified-draughts"', () => {
    const provider = createDraughtsEvaluationProviderBridge('russian-draughts');
    expect(provider.providerType).toBe('classified-draughts');
  });
});
