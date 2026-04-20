import { describe, it, expect } from 'vitest';
import {
  createDraughtsClassifiedEvalProvider,
  normalizeDraughtsScore,
  getDraughtsEvaluationProvider,
} from './DraughtsEvaluationProvider';
import { getDraughtsWeights } from './weights';
import {
  createDraughtsConfig,
  TIER_1_DRAUGHTS_GAME_IDS,
} from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../../../engine/classified/draughts/ParameterizedDraughtsRules';

describe('DraughtsEvaluationProvider', () => {
  describe('createDraughtsClassifiedEvalProvider', () => {
    it.each(TIER_1_DRAUGHTS_GAME_IDS)(
      '%s: evaluate returns a finite score for starting position',
      (gameId: DraughtsGameId) => {
        const config = createDraughtsConfig(gameId);
        const weights = getDraughtsWeights(gameId);
        const provider = createDraughtsClassifiedEvalProvider(config, weights);
        const ruleSet = createDraughtsRuleSet(config);
        const state = ruleSet.startingPosition();

        const score = provider.evaluate(state);
        expect(Number.isFinite(score)).toBe(true);
      },
    );
  });

  describe('normalizeDraughtsScore', () => {
    it('returns 0 for a raw score of 0', () => {
      const { score } = normalizeDraughtsScore(0, 'white', 250);
      expect(score).toBe(0);
    });

    it('positive score maps to positive normalised (white perspective)', () => {
      const { score } = normalizeDraughtsScore(200, 'white', 250);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('negative score maps to negative normalised (white perspective)', () => {
      const { score } = normalizeDraughtsScore(-200, 'white', 250);
      expect(score).toBeLessThan(0);
      expect(score).toBeGreaterThan(-1);
    });

    it('inverts perspective for black', () => {
      const whiteResult = normalizeDraughtsScore(300, 'white', 250);
      const blackResult = normalizeDraughtsScore(300, 'black', 250);
      expect(whiteResult.score).toBeGreaterThan(0);
      expect(blackResult.score).toBeLessThan(0);
    });

    it('terminal scores clamp to ±1', () => {
      const { score, isTerminal } = normalizeDraughtsScore(10_000, 'white', 250);
      expect(score).toBe(1);
      expect(isTerminal).toBe(true);

      const neg = normalizeDraughtsScore(-10_000, 'white', 250);
      expect(neg.score).toBe(-1);
      expect(neg.isTerminal).toBe(true);
    });

    it('Infinity maps to terminal ±1', () => {
      const { score, isTerminal } = normalizeDraughtsScore(Infinity, 'white', 250);
      expect(score).toBe(1);
      expect(isTerminal).toBe(true);
    });

    it('normalised score is always in [-1, 1]', () => {
      for (const raw of [-5000, -500, -50, 0, 50, 500, 5000]) {
        for (const owner of ['white', 'black'] as const) {
          const { score } = normalizeDraughtsScore(raw, owner, 250);
          expect(score).toBeGreaterThanOrEqual(-1);
          expect(score).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('getDraughtsEvaluationProvider', () => {
    it('returns the same instance on repeated calls (cached)', () => {
      const p1 = getDraughtsEvaluationProvider('russian-draughts');
      const p2 = getDraughtsEvaluationProvider('russian-draughts');
      expect(p1).toBe(p2);
    });

    it.each(TIER_1_DRAUGHTS_GAME_IDS)(
      '%s: provider has evaluate and principalVariation methods',
      (gameId: DraughtsGameId) => {
        const provider = getDraughtsEvaluationProvider(gameId);
        expect(typeof provider.evaluate).toBe('function');
        expect(typeof provider.principalVariation).toBe('function');
      },
    );
  });
});
