import { describe, it, expect } from 'vitest';
import { getDraughtsDifficultyConfig, getResponseTimeCap } from './difficultyPresets';
import {
  createDraughtsConfig,
  TIER_1_DRAUGHTS_GAME_IDS,
  boardSizeOf,
} from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';

describe('difficultyPresets', () => {
  describe('getDraughtsDifficultyConfig', () => {
    it.each(TIER_1_DRAUGHTS_GAME_IDS)(
      '%s: hard difficulty has higher maxDepth than easy',
      (gameId: DraughtsGameId) => {
        const config = createDraughtsConfig(gameId);
        const hard = getDraughtsDifficultyConfig(config, 'hard');
        const easy = getDraughtsDifficultyConfig(config, 'easy');
        expect(hard.maxDepth).toBeGreaterThan(easy.maxDepth);
      },
    );

    it.each(TIER_1_DRAUGHTS_GAME_IDS)(
      '%s: hard has 0 blunder rate',
      (gameId: DraughtsGameId) => {
        const config = createDraughtsConfig(gameId);
        const hard = getDraughtsDifficultyConfig(config, 'hard');
        expect(hard.blunderRate).toBe(0);
      },
    );

    it.each(TIER_1_DRAUGHTS_GAME_IDS)(
      '%s: easy has positive blunder rate',
      (gameId: DraughtsGameId) => {
        const config = createDraughtsConfig(gameId);
        const easy = getDraughtsDifficultyConfig(config, 'easy');
        expect(easy.blunderRate).toBeGreaterThan(0);
      },
    );

    it.each(TIER_1_DRAUGHTS_GAME_IDS)(
      '%s: hard has quiescence enabled',
      (gameId: DraughtsGameId) => {
        const config = createDraughtsConfig(gameId);
        const hard = getDraughtsDifficultyConfig(config, 'hard');
        expect(hard.quiescenceEnabled).toBe(true);
      },
    );

    it('Frysk! hard has deeper search than 10×10 base (lower branching)', () => {
      const fryskConfig = createDraughtsConfig('frysk');
      const intlConfig = createDraughtsConfig('international-checkers');
      const fryskHard = getDraughtsDifficultyConfig(fryskConfig, 'hard');
      const intlHard = getDraughtsDifficultyConfig(intlConfig, 'hard');
      expect(fryskHard.maxDepth).toBeGreaterThan(intlHard.maxDepth);
    });

    it('12×12 hard has lower maxDepth than 8×8 hard', () => {
      const config8 = createDraughtsConfig('russian-draughts');
      const config12 = createDraughtsConfig('canadian-draughts');
      const hard8 = getDraughtsDifficultyConfig(config8, 'hard');
      const hard12 = getDraughtsDifficultyConfig(config12, 'hard');
      expect(hard12.maxDepth).toBeLessThan(hard8.maxDepth);
    });

    it('time limits scale with board size', () => {
      const config8 = createDraughtsConfig('russian-draughts');
      const config12 = createDraughtsConfig('canadian-draughts');
      const hard8 = getDraughtsDifficultyConfig(config8, 'hard');
      const hard12 = getDraughtsDifficultyConfig(config12, 'hard');
      expect(hard12.timeLimitMs).toBeGreaterThan(hard8.timeLimitMs);
    });
  });

  describe('getResponseTimeCap', () => {
    it('8×8 cap is 2000ms', () => {
      expect(getResponseTimeCap(8)).toBe(2000);
    });

    it('10×10 cap is 2500ms', () => {
      expect(getResponseTimeCap(10)).toBe(2500);
    });

    it('12×12 cap is 3500ms', () => {
      expect(getResponseTimeCap(12)).toBe(3500);
    });

    it.each(TIER_1_DRAUGHTS_GAME_IDS)(
      '%s: hard time limit does not exceed response cap',
      (gameId: DraughtsGameId) => {
        const config = createDraughtsConfig(gameId);
        const boardSize = boardSizeOf(config);
        const hard = getDraughtsDifficultyConfig(config, 'hard');
        const cap = getResponseTimeCap(boardSize);
        expect(hard.timeLimitMs).toBeLessThanOrEqual(cap);
      },
    );
  });
});
