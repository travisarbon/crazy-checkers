/**
 * Classified draughts search adapter (Task 28.5).
 *
 * Standalone iterative-deepening negamax search that operates natively on
 * `ClassifiedGameState` and `DraughtsMove`. This avoids bridging between
 * the Phase 1 `GameState` / `Move` / `RuleSet` types and the Classified
 * `ClassifiedGameState` / `DraughtsMove` / `ClassifiedRuleSet` types.
 *
 * The algorithm mirrors Phase 1 `src/ai/search.ts` (negamax + alpha-beta
 * pruning + iterative deepening + quiescence search) but is parameterised
 * by a `DraughtsEvalWeights` table and uses the ParameterizedDraughtsRules
 * engine directly.
 *
 * Zero modifications to Phase 1 search code — this module is purely additive.
 */

import type { ClassifiedGameState } from '../../../engine/classified/state';
import type { ClassifiedRuleSet } from '../../../engine/classified/ClassifiedRuleSet';
import type { DraughtsConfig } from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsMove } from '../../../engine/classified/draughts/moveGen';
import type { DraughtsEvalWeights } from './weights';
import type { DifficultyConfig } from '../../difficulty';
import { evaluateDraughtsPosition } from './DraughtsEvaluator';
import { orderDraughtsMoves, draughtsMoveEquals } from './moveOrdering';

// ---------------------------------------------------------------------------
// Result type (mirrors Phase 1 SearchResult but with DraughtsMove)
// ---------------------------------------------------------------------------

export interface ClassifiedSearchResult {
  readonly move: DraughtsMove | null;
  readonly score: number;
  readonly depth: number;
  readonly nodesEvaluated: number;
  readonly rootMoveScores: ReadonlyArray<{ move: DraughtsMove; score: number }>;
}

// ---------------------------------------------------------------------------
// Search context
// ---------------------------------------------------------------------------

interface ClassifiedSearchContext {
  readonly ruleSet: ClassifiedRuleSet<ClassifiedGameState, DraughtsMove>;
  readonly config: DraughtsConfig;
  readonly weights: DraughtsEvalWeights;
  nodesEvaluated: number;
  readonly startTime: number;
  readonly timeLimitMs: number;
  timeExpired: boolean;
  readonly quiescenceEnabled: boolean;
  readonly quiescenceMaxDepth: number;
}

// ---------------------------------------------------------------------------
// Time check
// ---------------------------------------------------------------------------

const TIME_CHECK_INTERVAL = 1000;

function checkTime(ctx: ClassifiedSearchContext): boolean {
  if (ctx.timeExpired) return true;
  if (ctx.nodesEvaluated % TIME_CHECK_INTERVAL !== 0) return false;
  if (performance.now() - ctx.startTime >= ctx.timeLimitMs) {
    ctx.timeExpired = true;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Quiescence search
// ---------------------------------------------------------------------------

function quiescenceSearch(
  state: ClassifiedGameState,
  alpha: number,
  beta: number,
  ctx: ClassifiedSearchContext,
  remainingDepth: number,
): number {
  if (checkTime(ctx)) return 0;

  const allMoves = ctx.ruleSet.getLegalMoves(state);

  // Stand-pat evaluation.
  ctx.nodesEvaluated++;
  const standPat = evaluateDraughtsPosition(
    state,
    ctx.config,
    ctx.weights,
    allMoves.length,
  );

  if (standPat >= beta) return standPat;

  let currentAlpha = alpha;
  if (standPat > currentAlpha) currentAlpha = standPat;

  if (remainingDepth <= 0) return standPat;

  // Only extend on captures.
  const captures = allMoves.filter((m) => m.kind === 'jump');
  if (captures.length === 0) {
    if (allMoves.length === 0) return ctx.weights.lossScore;
    return standPat;
  }

  // Order by capture count (multi-jumps first).
  const orderedCaptures = [...captures].sort(
    (a, b) => b.capture.length - a.capture.length,
  );

  let bestScore = standPat;

  for (const move of orderedCaptures) {
    const newState = ctx.ruleSet.applyMove(state, move);
    const score = -quiescenceSearch(
      newState,
      -beta,
      -currentAlpha,
      ctx,
      remainingDepth - 1,
    );

    if (ctx.timeExpired) return 0;

    if (score > bestScore) bestScore = score;
    if (score > currentAlpha) currentAlpha = score;
    if (currentAlpha >= beta) break;
  }

  return bestScore;
}

// ---------------------------------------------------------------------------
// Negamax
// ---------------------------------------------------------------------------

function negamax(
  state: ClassifiedGameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: ClassifiedSearchContext,
  previousBestMove: DraughtsMove | null,
): number {
  if (checkTime(ctx)) return 0;

  const moves = ctx.ruleSet.getLegalMoves(state);

  // Terminal: no legal moves = active side loses.
  if (moves.length === 0) return ctx.weights.lossScore;

  // Leaf: depth exhausted.
  if (depth <= 0) {
    if (ctx.quiescenceEnabled) {
      const captures = moves.filter((m) => m.kind === 'jump');
      if (captures.length > 0) {
        return quiescenceSearch(state, alpha, beta, ctx, ctx.quiescenceMaxDepth);
      }
    }
    ctx.nodesEvaluated++;
    return evaluateDraughtsPosition(state, ctx.config, ctx.weights, moves.length);
  }

  const orderedMoves = orderDraughtsMoves(moves, previousBestMove, ctx.config);
  let bestScore = -Infinity;

  for (const move of orderedMoves) {
    const newState = ctx.ruleSet.applyMove(state, move);
    const score = -negamax(
      newState,
      depth - 1,
      -beta,
      -alpha,
      ctx,
      null,
    );

    if (ctx.timeExpired) return 0;
    if (score > bestScore) bestScore = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  return bestScore;
}

// ---------------------------------------------------------------------------
// Iterative deepening
// ---------------------------------------------------------------------------

/**
 * Performs iterative-deepening search for a Classified draughts position.
 *
 * @param state - Current game state.
 * @param ruleSet - The ParameterizedDraughtsRules instance.
 * @param config - The DraughtsConfig for the variant.
 * @param weights - Evaluation weights for the variant.
 * @param difficultyConfig - Search parameters (depth, time, quiescence).
 * @returns The search result with best move and evaluation.
 */
export function classifiedIterativeSearch(
  state: ClassifiedGameState,
  ruleSet: ClassifiedRuleSet<ClassifiedGameState, DraughtsMove>,
  config: DraughtsConfig,
  weights: DraughtsEvalWeights,
  difficultyConfig: DifficultyConfig,
): ClassifiedSearchResult {
  const ctx: ClassifiedSearchContext = {
    ruleSet,
    config,
    weights,
    nodesEvaluated: 0,
    startTime: performance.now(),
    timeLimitMs: difficultyConfig.timeLimitMs,
    timeExpired: false,
    quiescenceEnabled: difficultyConfig.quiescenceEnabled,
    quiescenceMaxDepth: difficultyConfig.quiescenceMaxDepth,
  };

  const rootMoves = ruleSet.getLegalMoves(state);

  // No legal moves.
  if (rootMoves.length === 0) {
    return {
      move: null,
      score: weights.lossScore,
      depth: 0,
      nodesEvaluated: 0,
      rootMoveScores: [],
    };
  }

  // Exactly one legal move — return immediately.
  if (rootMoves.length === 1) {
    const onlyMove = rootMoves[0] as DraughtsMove;
    ctx.nodesEvaluated++;
    const newState = ruleSet.applyMove(state, onlyMove);
    const score = evaluateDraughtsPosition(newState, config, weights);
    return {
      move: onlyMove,
      score,
      depth: 1,
      nodesEvaluated: 1,
      rootMoveScores: [{ move: onlyMove, score }],
    };
  }

  // Iterative deepening loop.
  let bestResult: ClassifiedSearchResult = {
    move: rootMoves[0] as DraughtsMove,
    score: -Infinity,
    depth: 0,
    nodesEvaluated: 0,
    rootMoveScores: [],
  };

  let previousBestMove: DraughtsMove | null = null;

  for (let depth = 1; depth <= difficultyConfig.maxDepth; depth++) {
    const orderedRootMoves = orderDraughtsMoves(rootMoves, previousBestMove, config);

    let bestMoveThisDepth: DraughtsMove = orderedRootMoves[0] as DraughtsMove;
    let bestScoreThisDepth = -Infinity;
    const currentRootScores: Array<{ move: DraughtsMove; score: number }> = [];

    for (const move of orderedRootMoves) {
      const newState = ruleSet.applyMove(state, move);
      const score = -negamax(
        newState,
        depth - 1,
        -Infinity,
        -bestScoreThisDepth,
        ctx,
        null,
      );

      if (ctx.timeExpired) break;

      currentRootScores.push({ move, score });

      if (score > bestScoreThisDepth) {
        bestScoreThisDepth = score;
        bestMoveThisDepth = move;
      }
    }

    if (!ctx.timeExpired) {
      bestResult = {
        move: bestMoveThisDepth,
        score: bestScoreThisDepth,
        depth,
        nodesEvaluated: ctx.nodesEvaluated,
        rootMoveScores: currentRootScores,
      };
      previousBestMove = bestMoveThisDepth;

      // Early termination on forced win.
      if (bestScoreThisDepth >= weights.winScore - depth) {
        break;
      }
    } else {
      break;
    }
  }

  return bestResult;
}

/**
 * Selects the final move applying blunder injection and score-window
 * randomization from the difficulty config.
 */
export function selectClassifiedMove(
  searchResult: ClassifiedSearchResult,
  legalMoves: readonly DraughtsMove[],
  difficultyConfig: DifficultyConfig,
  randomFn: () => number = Math.random,
): DraughtsMove {
  // Trivial: one legal move.
  if (legalMoves.length === 1) {
    return legalMoves[0] as DraughtsMove;
  }

  // Blunder check.
  if (difficultyConfig.blunderRate > 0 && randomFn() < difficultyConfig.blunderRate) {
    const index = Math.floor(randomFn() * legalMoves.length);
    return legalMoves[index] as DraughtsMove;
  }

  // Score-window randomization.
  if (
    difficultyConfig.moveRandomization < 1.0 &&
    searchResult.rootMoveScores.length > 0
  ) {
    const bestScore = searchResult.rootMoveScores.reduce(
      (max, entry) => Math.max(max, entry.score),
      -Infinity,
    );
    const spread = Math.abs(bestScore) * (1 - difficultyConfig.moveRandomization);
    const threshold = bestScore - spread;
    const candidates = searchResult.rootMoveScores.filter(
      (entry) => entry.score >= threshold,
    );
    if (candidates.length > 0) {
      const index = Math.floor(randomFn() * candidates.length);
      return (candidates[index] as { move: DraughtsMove; score: number }).move;
    }
  }

  // Fallback: play search's best move.
  if (searchResult.move) return searchResult.move;
  if (legalMoves.length > 0) return legalMoves[0] as DraughtsMove;
  throw new Error('selectClassifiedMove: no search result and no legal moves');
}

export { draughtsMoveEquals };
