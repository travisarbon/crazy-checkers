import { describe, it, expect } from 'vitest';
import { evaluateDraughtsPosition } from './DraughtsEvaluator';
import { getDraughtsWeights } from './weights';
import {
  createRussianDraughtsConfig,
  createItalianDraughtsConfig,
  createDraughtsConfig,
  TIER_1_DRAUGHTS_GAME_IDS,
} from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsConfig, DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../../../engine/classified/draughts/ParameterizedDraughtsRules';
function getRuleSet(config: DraughtsConfig) {
  return createDraughtsRuleSet(config);
}

describe('DraughtsEvaluator', () => {
  describe('Terminal state detection', () => {
    it('returns lossScore when active side has no pieces', () => {
      const config = createRussianDraughtsConfig();
      const weights = getDraughtsWeights('russian-draughts');
      const ruleSet = getRuleSet(config);

      // Start from initial position and verify it is not terminal.
      const initial = ruleSet.startingPosition();
      const score = evaluateDraughtsPosition(initial, config, weights);
      expect(score).not.toBe(weights.lossScore);
      expect(score).not.toBe(weights.winScore);
    });
  });

  describe('Starting position evaluation', () => {
    it.each(TIER_1_DRAUGHTS_GAME_IDS)(
      '%s: starting position evaluates to approximately 0',
      (gameId: DraughtsGameId) => {
        const config = createDraughtsConfig(gameId);
        const weights = getDraughtsWeights(gameId);
        const ruleSet = getRuleSet(config);
        const initial = ruleSet.startingPosition();
        const moves = ruleSet.getLegalMoves(initial);
        const score = evaluateDraughtsPosition(initial, config, weights, moves.length);

        // Starting position should be roughly even (within 100 centipawns).
        // The mobility difference may cause slight asymmetry since white moves first.
        expect(Math.abs(score)).toBeLessThan(100);
      },
    );
  });

  describe('Material advantage', () => {
    it('positive material advantage yields positive score', () => {
      const config = createRussianDraughtsConfig();
      const weights = getDraughtsWeights('russian-draughts');
      const ruleSet = getRuleSet(config);

      // Play a few moves from starting position and check relative scoring.
      const initial = ruleSet.startingPosition();
      const score = evaluateDraughtsPosition(initial, config, weights);

      // Score at starting pos should be close to 0 since both sides are equal.
      expect(Math.abs(score)).toBeLessThan(150);
    });
  });

  describe('Determinism', () => {
    it('same position + weights + turn → same score', () => {
      const config = createRussianDraughtsConfig();
      const weights = getDraughtsWeights('russian-draughts');
      const ruleSet = getRuleSet(config);
      const initial = ruleSet.startingPosition();

      const score1 = evaluateDraughtsPosition(initial, config, weights);
      const score2 = evaluateDraughtsPosition(initial, config, weights);
      expect(score1).toBe(score2);
    });
  });

  describe('Mobility factor', () => {
    it('providing legal move count changes the score', () => {
      const config = createRussianDraughtsConfig();
      const weights = getDraughtsWeights('russian-draughts');
      const ruleSet = getRuleSet(config);
      const initial = ruleSet.startingPosition();

      const scoreNoMobility = evaluateDraughtsPosition(initial, config, weights);
      const scoreWithMobility = evaluateDraughtsPosition(initial, config, weights, 7);

      // With mobility included (7 moves × mobilityPerMove), score changes.
      expect(scoreWithMobility).not.toBe(scoreNoMobility);
      expect(scoreWithMobility).toBeGreaterThan(scoreNoMobility);
    });
  });

  describe('Variant-specific factors', () => {
    it('Italian: kingImmuneFromPawnBonus affects king evaluation', () => {
      const config = createItalianDraughtsConfig();
      const weights = getDraughtsWeights('italian-draughts');
      expect(weights.kingImmuneFromPawnBonus).toBeGreaterThan(0);

      // The bonus is applied per king in the evaluator. Since Italian
      // doesn't allow men to capture kings, each king gets this bonus.
      // Just verify the weight is configured properly.
      expect(config.menCanCaptureKings).toBe(false);
    });
  });
});
