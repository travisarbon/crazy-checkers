/**
 * ParameterizedDraughtsEvaluationProvider — Cogitate evaluation interface for
 * Tier 1 Classified draughts variants (Task 28.5).
 *
 * Provides two adapters:
 *
 * 1. `ClassifiedRuleSet.evaluationProvider` — the Phase 4 generic interface
 *    that operates on `ClassifiedGameState` directly. Used by any Classified
 *    tooling that reads `ruleSet.evaluationProvider`.
 *
 * 2. `CogitateGameAdapter.getEvaluationProvider()` — the Phase 1 interface
 *    that the existing Cogitate Analysis/Training panels consume. This
 *    wrapper maps Phase 1 `BoardState` calls into ClassifiedGameState calls
 *    by re-constructing state from the serialised board. Requires a bound
 *    starting position and config.
 *
 * Both share a single `DraughtsEvalWeights` table per variant.
 */

import type { ClassifiedGameState } from '../../../engine/classified/state';
import type { EvaluationProvider as ClassifiedEvalProvider } from '../../../engine/classified/ClassifiedRuleSet';
import type { DraughtsConfig, DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsConfig } from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsMove } from '../../../engine/classified/draughts/moveGen';
import type { DraughtsEvalWeights } from './weights';
import { getDraughtsWeights } from './weights';
import { evaluateDraughtsPosition } from './DraughtsEvaluator';
import { classifiedIterativeSearch } from './classifiedSearch';
import { getDraughtsDifficultyConfig } from './difficultyPresets';
import { createDraughtsRuleSet } from '../../../engine/classified/draughts/ParameterizedDraughtsRules';

// ---------------------------------------------------------------------------
// ClassifiedRuleSet.evaluationProvider implementation
// ---------------------------------------------------------------------------

/**
 * Creates the `EvaluationProvider<ClassifiedGameState, DraughtsMove>` that
 * attaches to a ClassifiedRuleSet. Evaluates positions using the variant's
 * weight table and provides principal variation via classified search.
 */
export function createDraughtsClassifiedEvalProvider(
  config: DraughtsConfig,
  weights: DraughtsEvalWeights,
): ClassifiedEvalProvider<ClassifiedGameState, DraughtsMove> {
  const ruleSet = createDraughtsRuleSet(config);

  return {
    evaluate(state: ClassifiedGameState): number {
      const moves = ruleSet.getLegalMoves(state);
      return evaluateDraughtsPosition(state, config, weights, moves.length);
    },

    principalVariation(
      state: ClassifiedGameState,
      depth: number,
    ): readonly DraughtsMove[] {
      const diffConfig = getDraughtsDifficultyConfig(config, 'hard');
      const adjustedConfig = { ...diffConfig, maxDepth: depth };
      const result = classifiedIterativeSearch(
        state,
        ruleSet,
        config,
        weights,
        adjustedConfig,
      );

      // Build PV: search only returns the best move, so build a 1-deep PV.
      if (result.move) return [result.move];
      return [];
    },
  };
}

// ---------------------------------------------------------------------------
// Normalisation (sigmoid)
// ---------------------------------------------------------------------------

/**
 * Normalises a raw evaluation score to [-1.0, +1.0] using a sigmoid
 * parameterised by the variant's `sigmoidK`.
 *
 * @param rawScore - Raw score from DraughtsEvaluator.
 * @param activeOwner - Whose turn it is ('white' or 'black').
 * @param sigmoidK - The variant's sigmoid constant.
 * @returns Normalised score and terminal flag.
 */
export function normalizeDraughtsScore(
  rawScore: number,
  activeOwner: 'white' | 'black',
  sigmoidK: number,
): { score: number; isTerminal: boolean } {
  const TERMINAL_THRESHOLD = 9000;

  if (!Number.isFinite(rawScore)) {
    const sign = rawScore > 0 ? 1 : -1;
    const signed = activeOwner === 'white' ? sign : -sign;
    return { score: signed, isTerminal: true };
  }

  // Orient to white's perspective for consistency.
  const whiteOriented = activeOwner === 'white' ? rawScore : -rawScore;

  if (Math.abs(whiteOriented) >= TERMINAL_THRESHOLD) {
    return { score: whiteOriented > 0 ? 1 : -1, isTerminal: true };
  }

  const sigmoid = whiteOriented / (Math.abs(whiteOriented) + sigmoidK);
  const clamped = Math.max(-1, Math.min(1, sigmoid));
  return { score: clamped, isTerminal: false };
}

// ---------------------------------------------------------------------------
// Factory cache
// ---------------------------------------------------------------------------

const providerCache = new Map<DraughtsGameId, ClassifiedEvalProvider<ClassifiedGameState, DraughtsMove>>();

/**
 * Returns (cached) a ClassifiedRuleSet-compatible EvaluationProvider for
 * the given variant.
 */
export function getDraughtsEvaluationProvider(
  gameId: DraughtsGameId,
): ClassifiedEvalProvider<ClassifiedGameState, DraughtsMove> {
  const cached = providerCache.get(gameId);
  if (cached) return cached;

  const config = createDraughtsConfig(gameId);
  const weights = getDraughtsWeights(gameId);
  const provider = createDraughtsClassifiedEvalProvider(config, weights);
  providerCache.set(gameId, provider);
  return provider;
}
