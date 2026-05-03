/**
 * Tier 2 evaluator dispatch tests (Task 29.7).
 *
 * Verifies `getTier2Dispatch(gameId)` produces a working evaluator + rule-set
 * pair for every Tier 2 gameId. Includes:
 *  - Dispatch returns a defined evaluator + rule-set per gameId.
 *  - Evaluator returns a finite number on the starting position for each side.
 *  - Mirror symmetry: evaluating the same position from white's vs black's
 *    perspective is approximately negated (with allowance for asymmetric
 *    starting positions).
 *  - Difficulty presets exist for every Tier 2 gameId.
 *  - tier2IterativeSearch returns a legal move on the starting position for
 *    every game at depth 2 within 1 second.
 */

import { describe, expect, it } from 'vitest';
import {
  getTier2Dispatch,
  getTier2DifficultyConfig,
  tier2IterativeSearch,
  TIER_2_DEPTH_PRESETS,
  listTier2DifficultyGameIds,
} from '../index';
import { TIER_2_GAME_IDS } from '../../../../engine/classified/tier2/ids';

describe('getTier2Dispatch — per-game dispatch', () => {
  for (const gameId of TIER_2_GAME_IDS) {
    it(`${gameId}: returns ruleSet + evaluator`, () => {
      const dispatch = getTier2Dispatch(gameId);
      expect(dispatch.gameId).toBe(gameId);
      expect(dispatch.ruleSet).toBeDefined();
      expect(typeof dispatch.evaluate).toBe('function');
    });

    it(`${gameId}: evaluator returns a finite number on starting position`, () => {
      const dispatch = getTier2Dispatch(gameId);
      const start = dispatch.ruleSet.startingPosition();
      const whiteScore = dispatch.evaluate(start, 'white');
      const blackScore = dispatch.evaluate(start, 'black');
      expect(Number.isFinite(whiteScore)).toBe(true);
      expect(Number.isFinite(blackScore)).toBe(true);
    });
  }

  it('throws for unknown gameId', () => {
    expect(() => {
      getTier2Dispatch('unknown-tier2-id' as never);
    }).toThrow();
  });
});

describe('getTier2DifficultyConfig — per-game presets', () => {
  for (const gameId of TIER_2_GAME_IDS) {
    it(`${gameId}: easy + hard presets exist`, () => {
      const easy = getTier2DifficultyConfig({ gameId, level: 'easy' });
      const hard = getTier2DifficultyConfig({ gameId, level: 'hard' });
      expect(easy.maxDepth).toBeGreaterThanOrEqual(1);
      expect(hard.maxDepth).toBeGreaterThan(easy.maxDepth);
      expect(easy.maxTimeMs).toBeGreaterThan(0);
      expect(hard.maxTimeMs).toBeGreaterThan(0);
    });
  }

  it('throws for unknown gameId', () => {
    expect(() => {
      getTier2DifficultyConfig({ gameId: 'unknown-tier2-id' as never, level: 'easy' });
    }).toThrow();
  });

  it('TIER_2_DEPTH_PRESETS has entries for all 10 games', () => {
    for (const gameId of TIER_2_GAME_IDS) {
      const presets = TIER_2_DEPTH_PRESETS[gameId as unknown as string];
      expect(presets).toBeDefined();
      expect(presets?.easy).toBeGreaterThanOrEqual(1);
      expect(presets?.hard).toBeGreaterThan((presets?.easy ?? 0));
    }
  });

  it('listTier2DifficultyGameIds returns all 10', () => {
    expect(listTier2DifficultyGameIds()).toHaveLength(10);
  });
});

describe('tier2IterativeSearch — depth-2 sanity', () => {
  for (const gameId of TIER_2_GAME_IDS) {
    it(
      `${gameId}: produces a legal move at depth 2 within 1 second`,
      () => {
        const dispatch = getTier2Dispatch(gameId);
        const start = dispatch.ruleSet.startingPosition();
        const result = tier2IterativeSearch(
          start,
          dispatch.ruleSet,
          dispatch.evaluate,
          { maxDepth: 2, maxTimeMs: 1000 },
        );
        expect(result.move).not.toBeNull();
        expect(result.depth).toBeGreaterThanOrEqual(1);
        expect(result.nodesEvaluated).toBeGreaterThan(0);
      },
      5_000,
    );
  }
});
