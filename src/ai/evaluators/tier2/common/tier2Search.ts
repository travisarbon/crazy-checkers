/**
 * Generic Tier 2 search (Task 29.7).
 *
 * Iterative-deepening alpha-beta minimax over any `ClassifiedRuleSet`.
 * Rule-set-agnostic per playbook §6.1: "All 10 Tier 2 games are two-player,
 * zero-sum, perfect-information games with moderate branching factors."
 *
 * Tier 1's `classifiedSearch.ts` is hard-coded to `DraughtsMove` so cannot
 * be reused directly; this Tier 2 generic mirrors its shape and idioms but
 * is parameterised over the move type. Tests verify the search produces
 * stable, deterministic move selections.
 *
 * Time-cap enforcement: at the start of each ply, check `Date.now()` vs.
 * `startTime + maxTimeMs`. If exceeded, abort the current ply and return
 * the best move from the previous (completed) ply. Matches Tier 1 behavior.
 */

import type {
  ClassifiedGameState,
} from '../../../../engine/classified/state';
import type {
  ClassifiedMove,
  ClassifiedRuleSet,
} from '../../../../engine/classified/ClassifiedRuleSet';
import { GameResultType } from '../../../../engine/types';
import type {
  EvaluateClassifiedPosition,
  Tier2DifficultyConfig,
  Tier2SearchResult,
  Tier2Side,
} from './types';
import { TIER_2_LOSS_SCORE, TIER_2_WIN_SCORE } from './types';

interface SearchContext<M extends ClassifiedMove> {
  readonly ruleSet: ClassifiedRuleSet<ClassifiedGameState, M>;
  readonly evalFn: EvaluateClassifiedPosition;
  readonly rootSide: Tier2Side;
  readonly startTime: number;
  readonly timeLimitMs: number;
  nodesEvaluated: number;
  timeExpired: boolean;
}

function isTimeExpired<M extends ClassifiedMove>(ctx: SearchContext<M>): boolean {
  if (ctx.timeExpired) return true;
  if (Date.now() - ctx.startTime > ctx.timeLimitMs) {
    ctx.timeExpired = true;
    return true;
  }
  return false;
}

/** Negamax with alpha-beta pruning. */
function negamax<M extends ClassifiedMove>(
  state: ClassifiedGameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchContext<M>,
  perspective: Tier2Side,
): number {
  if (isTimeExpired(ctx)) return 0;
  ctx.nodesEvaluated += 1;

  const result = ctx.ruleSet.checkGameOver(state);
  if (result !== null) {
    if (
      result.type ===
      (perspective === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin)
    ) {
      return TIER_2_WIN_SCORE - depth;
    }
    if (
      result.type ===
      (perspective === 'white' ? GameResultType.BlackWin : GameResultType.WhiteWin)
    ) {
      return TIER_2_LOSS_SCORE + depth;
    }
    return 0; // draw
  }

  if (depth <= 0) {
    return ctx.evalFn(state, perspective);
  }

  const moves = ctx.ruleSet.getLegalMoves(state);
  if (moves.length === 0) {
    // No legal moves with no game-over result — treat as terminal loss.
    return TIER_2_LOSS_SCORE + depth;
  }

  let bestScore = -Infinity;
  for (const move of moves) {
    if (isTimeExpired(ctx)) break;
    const next = ctx.ruleSet.applyMove(state, move);
    const otherSide: Tier2Side = perspective === 'white' ? 'black' : 'white';
    const score = -negamax(next, depth - 1, -beta, -alpha, ctx, otherSide);
    if (score > bestScore) bestScore = score;
    if (bestScore > alpha) alpha = bestScore;
    if (alpha >= beta) break; // beta cut-off
  }
  return bestScore;
}

/**
 * Iterative-deepening alpha-beta search returning the best move.
 *
 * Returns `move: null` if there are no legal moves in the root position.
 */
export function tier2IterativeSearch<M extends ClassifiedMove>(
  state: ClassifiedGameState,
  ruleSet: ClassifiedRuleSet<ClassifiedGameState, M>,
  evalFn: EvaluateClassifiedPosition,
  config: Tier2DifficultyConfig,
): Tier2SearchResult<M> {
  const rootSide = (state.turn ?? 'white') as Tier2Side;
  const ctx: SearchContext<M> = {
    ruleSet,
    evalFn,
    rootSide,
    startTime: Date.now(),
    timeLimitMs: config.maxTimeMs,
    nodesEvaluated: 0,
    timeExpired: false,
  };

  const rootMoves = ruleSet.getLegalMoves(state);
  if (rootMoves.length === 0) {
    return { move: null, score: TIER_2_LOSS_SCORE, depth: 0, nodesEvaluated: 0 };
  }
  if (rootMoves.length === 1) {
    return {
      move: rootMoves[0] as M,
      score: 0,
      depth: 1,
      nodesEvaluated: 1,
    };
  }

  let bestResult: Tier2SearchResult<M> = {
    move: rootMoves[0] as M,
    score: -Infinity,
    depth: 0,
    nodesEvaluated: 0,
  };

  for (let depth = 1; depth <= config.maxDepth; depth += 1) {
    let bestMoveThisDepth: M = rootMoves[0] as M;
    let bestScoreThisDepth = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (const move of rootMoves) {
      if (isTimeExpired(ctx)) break;
      const next = ruleSet.applyMove(state, move);
      const otherSide: Tier2Side = rootSide === 'white' ? 'black' : 'white';
      const score = -negamax(next, depth - 1, -beta, -alpha, ctx, otherSide);
      if (score > bestScoreThisDepth) {
        bestScoreThisDepth = score;
        bestMoveThisDepth = move;
      }
      if (score > alpha) alpha = score;
    }

    if (!ctx.timeExpired) {
      bestResult = {
        move: bestMoveThisDepth,
        score: bestScoreThisDepth,
        depth,
        nodesEvaluated: ctx.nodesEvaluated,
      };
      // Early termination on forced win.
      if (bestScoreThisDepth >= TIER_2_WIN_SCORE - depth) break;
    } else {
      break;
    }
  }

  return bestResult;
}
