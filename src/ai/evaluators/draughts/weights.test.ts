import { describe, it, expect } from 'vitest';
import {
  getDraughtsWeights,
  listDraughtsWeightGameIds,
  RUSSIAN_DRAUGHTS_WEIGHTS,
  BRAZILIAN_DRAUGHTS_WEIGHTS,
  ITALIAN_DRAUGHTS_WEIGHTS,
  INTERNATIONAL_CHECKERS_WEIGHTS,
  FRYSK_WEIGHTS,
  FRISIAN_DRAUGHTS_WEIGHTS,
  MALAYSIAN_CHECKERS_WEIGHTS,
  CANADIAN_DRAUGHTS_WEIGHTS,
  ARMENIAN_DRAUGHTS_WEIGHTS,
  TURKISH_DRAUGHTS_WEIGHTS,
} from './weights';
import type { DraughtsEvalWeights } from './weights';
import { TIER_1_DRAUGHTS_GAME_IDS } from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';

describe('DraughtsEvalWeights', () => {
  describe('Registry completeness', () => {
    it('has weights for all 10 Tier 1 variants', () => {
      const registered = listDraughtsWeightGameIds();
      expect(registered).toHaveLength(10);
      for (const gameId of TIER_1_DRAUGHTS_GAME_IDS) {
        expect(registered).toContain(gameId);
      }
    });

    it('getDraughtsWeights returns a frozen object for each variant', () => {
      for (const gameId of TIER_1_DRAUGHTS_GAME_IDS) {
        const weights = getDraughtsWeights(gameId);
        expect(Object.isFrozen(weights)).toBe(true);
      }
    });

    it('throws for unknown gameId', () => {
      expect(() => getDraughtsWeights('unknown' as DraughtsGameId)).toThrow(
        'No evaluation weights registered',
      );
    });
  });

  describe('Weight invariants', () => {
    const allWeights: [DraughtsGameId, Readonly<DraughtsEvalWeights>][] = [
      ['russian-draughts', RUSSIAN_DRAUGHTS_WEIGHTS],
      ['brazilian-draughts', BRAZILIAN_DRAUGHTS_WEIGHTS],
      ['italian-draughts', ITALIAN_DRAUGHTS_WEIGHTS],
      ['international-checkers', INTERNATIONAL_CHECKERS_WEIGHTS],
      ['frysk', FRYSK_WEIGHTS],
      ['frisian-draughts', FRISIAN_DRAUGHTS_WEIGHTS],
      ['malaysian-checkers', MALAYSIAN_CHECKERS_WEIGHTS],
      ['canadian-draughts', CANADIAN_DRAUGHTS_WEIGHTS],
      ['armenian-draughts', ARMENIAN_DRAUGHTS_WEIGHTS],
      ['turkish-draughts', TURKISH_DRAUGHTS_WEIGHTS],
    ];

    it.each(allWeights)(
      '%s: kingValue > pawnValue',
      (_id, weights) => {
        expect(weights.kingValue).toBeGreaterThan(weights.pawnValue);
      },
    );

    it.each(allWeights)(
      '%s: endgameKingValue > kingValue',
      (_id, weights) => {
        expect(weights.endgameKingValue).toBeGreaterThan(weights.kingValue);
      },
    );

    it.each(allWeights)(
      '%s: winScore = 10000, lossScore = -10000',
      (_id, weights) => {
        expect(weights.winScore).toBe(10_000);
        expect(weights.lossScore).toBe(-10_000);
      },
    );

    it.each(allWeights)(
      '%s: all numeric values are finite',
      (_id, weights) => {
        for (const [key, value] of Object.entries(weights)) {
          expect(Number.isFinite(value)).toBe(true);
          void key;
        }
      },
    );

    it.each(allWeights)(
      '%s: sigmoidK > 0',
      (_id, weights) => {
        expect(weights.sigmoidK).toBeGreaterThan(0);
      },
    );
  });

  describe('Variant-specific weight properties', () => {
    it('Italian has kingImmuneFromPawnBonus > 0', () => {
      expect(ITALIAN_DRAUGHTS_WEIGHTS.kingImmuneFromPawnBonus).toBeGreaterThan(0);
    });

    it('Italian has flyingKingMobilityBonus = 0 (short kings)', () => {
      expect(ITALIAN_DRAUGHTS_WEIGHTS.flyingKingMobilityBonus).toBe(0);
    });

    it('Malaysian has huffingVulnerabilityPenalty > 0', () => {
      expect(MALAYSIAN_CHECKERS_WEIGHTS.huffingVulnerabilityPenalty).toBeGreaterThan(0);
    });

    it('Frysk and Frisian have dualAxisCaptureBonus > 0', () => {
      expect(FRYSK_WEIGHTS.dualAxisCaptureBonus).toBeGreaterThan(0);
      expect(FRISIAN_DRAUGHTS_WEIGHTS.dualAxisCaptureBonus).toBeGreaterThan(0);
    });

    it('Frysk and Frisian have consecutiveMovePenalty > 0', () => {
      expect(FRYSK_WEIGHTS.consecutiveMovePenalty).toBeGreaterThan(0);
      expect(FRISIAN_DRAUGHTS_WEIGHTS.consecutiveMovePenalty).toBeGreaterThan(0);
    });

    it('Non-huffing variants have huffingVulnerabilityPenalty = 0', () => {
      expect(RUSSIAN_DRAUGHTS_WEIGHTS.huffingVulnerabilityPenalty).toBe(0);
      expect(INTERNATIONAL_CHECKERS_WEIGHTS.huffingVulnerabilityPenalty).toBe(0);
      expect(CANADIAN_DRAUGHTS_WEIGHTS.huffingVulnerabilityPenalty).toBe(0);
    });

    it('10×10 and 12×12 variants have larger sigmoidK', () => {
      expect(INTERNATIONAL_CHECKERS_WEIGHTS.sigmoidK).toBeGreaterThan(
        RUSSIAN_DRAUGHTS_WEIGHTS.sigmoidK,
      );
      expect(CANADIAN_DRAUGHTS_WEIGHTS.sigmoidK).toBeGreaterThan(
        INTERNATIONAL_CHECKERS_WEIGHTS.sigmoidK,
      );
    });
  });
});
