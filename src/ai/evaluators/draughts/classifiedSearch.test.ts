import { describe, it, expect } from 'vitest';
import { classifiedIterativeSearch, selectClassifiedMove } from './classifiedSearch';
import { getDraughtsWeights } from './weights';
import { getDraughtsDifficultyConfig } from './difficultyPresets';
import {
  createDraughtsConfig,
  TIER_1_DRAUGHTS_GAME_IDS,
} from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsConfig, DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../../../engine/classified/draughts/ParameterizedDraughtsRules';
import type { ClassifiedGameState } from '../../../engine/classified/state';

function getRuleSet(config: DraughtsConfig) {
  return createDraughtsRuleSet(config);
}

describe('classifiedIterativeSearch', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)(
    '%s: produces a legal move from starting position',
    (gameId: DraughtsGameId) => {
      const config = createDraughtsConfig(gameId);
      const ruleSet = getRuleSet(config);
      const weights = getDraughtsWeights(gameId);
      const diffConfig = getDraughtsDifficultyConfig(config, 'easy');

      const state = ruleSet.startingPosition();
      const result = classifiedIterativeSearch(
        state,
        ruleSet,
        config,
        weights,
        { ...diffConfig, maxDepth: 2, timeLimitMs: 500 },
      );

      expect(result.move).not.toBeNull();
      expect(result.depth).toBeGreaterThanOrEqual(1);
      expect(result.nodesEvaluated).toBeGreaterThan(0);

      // Verify the move is legal.
      const legalMoves = ruleSet.getLegalMoves(state);
      const bestMove = result.move;
      expect(bestMove).not.toBeNull();
      if (bestMove) {
        const isLegal = legalMoves.some(
          (m) => m.from === bestMove.from && m.to === bestMove.to,
        );
        expect(isLegal).toBe(true);
      }
    },
  );

  it('returns null move when no legal moves exist', () => {
    const config = createDraughtsConfig('russian-draughts');
    const weights = getDraughtsWeights('russian-draughts');
    const ruleSet = getRuleSet(config);
    const diffConfig = getDraughtsDifficultyConfig(config, 'easy');

    // Create a state with no pieces for the active side.
    const emptyState: ClassifiedGameState = {
      pieces: new Map(),
      turn: 'white',
      plyCount: 0,
    };

    const result = classifiedIterativeSearch(
      emptyState,
      ruleSet,
      config,
      weights,
      diffConfig,
    );

    expect(result.move).toBeNull();
    expect(result.score).toBe(weights.lossScore);
  });

  it('rootMoveScores contains all root-level moves', () => {
    const config = createDraughtsConfig('russian-draughts');
    const ruleSet = getRuleSet(config);
    const weights = getDraughtsWeights('russian-draughts');
    const diffConfig = getDraughtsDifficultyConfig(config, 'easy');

    const state = ruleSet.startingPosition();
    const result = classifiedIterativeSearch(
      state,
      ruleSet,
      config,
      weights,
      { ...diffConfig, maxDepth: 2, timeLimitMs: 500 },
    );

    const legalMoves = ruleSet.getLegalMoves(state);
    // rootMoveScores should have an entry for each legal move.
    expect(result.rootMoveScores.length).toBe(legalMoves.length);
  });
});

describe('selectClassifiedMove', () => {
  it('returns the only legal move when only one exists', () => {
    const config = createDraughtsConfig('russian-draughts');
    const ruleSet = getRuleSet(config);
    const weights = getDraughtsWeights('russian-draughts');
    const diffConfig = getDraughtsDifficultyConfig(config, 'hard');

    const state = ruleSet.startingPosition();
    const result = classifiedIterativeSearch(
      state,
      ruleSet,
      config,
      weights,
      { ...diffConfig, maxDepth: 1, timeLimitMs: 100 },
    );

    // Create a single-move scenario.
    expect(result.move).not.toBeNull();
    const bestMove = result.move;
    if (bestMove) {
      const singleMove = [bestMove];
      const selected = selectClassifiedMove(result, singleMove, diffConfig);
      expect(selected).toBe(singleMove[0]);
    }
  });

  it('blunder injection can select a non-best move', () => {
    const config = createDraughtsConfig('russian-draughts');
    const ruleSet = getRuleSet(config);
    const weights = getDraughtsWeights('russian-draughts');
    const easyConfig = getDraughtsDifficultyConfig(config, 'easy');

    const state = ruleSet.startingPosition();
    const result = classifiedIterativeSearch(
      state,
      ruleSet,
      config,
      weights,
      { ...easyConfig, maxDepth: 2, timeLimitMs: 500 },
    );

    const legalMoves = ruleSet.getLegalMoves(state);

    // With blunder rate 1.0 and a deterministic random, we always blunder.
    const highBlunderConfig = { ...easyConfig, blunderRate: 1.0 };
    const selected = selectClassifiedMove(
      result,
      legalMoves,
      highBlunderConfig,
      () => 0, // Always pick index 0
    );

    // Should pick a legal move (index 0).
    expect(legalMoves).toContain(selected);
  });
});
