/**
 * Minimax search with alpha-beta pruning, iterative deepening,
 * move ordering, and quiescence search.
 * Task 3.2 implements the full search algorithm.
 */

import type { BoardState, GameState, Move, PieceColor, RuleSet } from '../engine/types';
import { opponentColor } from '../engine/types';
import { evaluate, EVAL_WEIGHTS, CENTER_SQUARES, EXPANDED_CENTER_SQUARES } from './evaluator';
import { movesAreEqual } from '../engine/game';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** Result of a search: the best move found and its evaluation score. */
export interface SearchResult {
  /** The best move found. Null only if no legal moves exist. */
  move: Move | null;
  /** The evaluation score of the best move, from the searching player's perspective. */
  score: number;
  /** The deepest fully completed iteration depth in plies. */
  depth: number;
  /** Number of nodes evaluated during the search (for diagnostics/profiling). */
  nodesEvaluated: number;
  /** Scores for all root-level moves from the last completed iteration.
   *  Used by difficulty presets for score-window randomization. */
  rootMoveScores: ReadonlyArray<{ move: Move; score: number }>;
}

/**
 * Configuration for a single search invocation.
 * Populated by Task 3.3 (Difficulty Presets).
 */
export interface SearchConfig {
  /** Maximum search depth in plies. */
  maxDepth: number;
  /** Time limit in milliseconds. Search stops deepening when exceeded. */
  timeLimitMs: number;
  /** Whether to enable quiescence search at the horizon. */
  quiescenceEnabled: boolean;
  /** Maximum additional plies for quiescence search. */
  quiescenceMaxDepth: number;
}

/** Default search configuration for development and testing. */
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  maxDepth: 6,
  timeLimitMs: 2000,
  quiescenceEnabled: true,
  quiescenceMaxDepth: 4,
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Mutable context shared across all recursive calls within a single
 * iterativeSearch invocation. Avoids threading counters through every call.
 */
interface SearchContext {
  ruleSet: RuleSet;
  nodesEvaluated: number;
  startTime: number;
  timeLimitMs: number;
  timeExpired: boolean;
  quiescenceEnabled: boolean;
  quiescenceMaxDepth: number;
}

// ---------------------------------------------------------------------------
// Time-check helper
// ---------------------------------------------------------------------------

const TIME_CHECK_INTERVAL = 1000;

function checkTime(ctx: SearchContext): boolean {
  if (ctx.timeExpired) return true;
  if (ctx.nodesEvaluated % TIME_CHECK_INTERVAL !== 0) return false;
  if (performance.now() - ctx.startTime >= ctx.timeLimitMs) {
    ctx.timeExpired = true;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Move ordering
// ---------------------------------------------------------------------------

/**
 * Orders moves for alpha-beta efficiency.
 *
 * Priority (highest first):
 * 1. The "best move" from the previous iteration (if any).
 * 2. Captures, sorted by number of pieces captured (multi-jumps first).
 * 3. Simple moves, sorted by a lightweight center-seeking heuristic.
 */
function orderMoves(moves: Move[], previousBestMove: Move | null): Move[] {
  const scored: Array<{ move: Move; sortKey: number }> = moves.map((move) => {
    let sortKey = 0;

    if (previousBestMove !== null && movesAreEqual(move, previousBestMove)) {
      sortKey = 100_000;
    } else if (move.captured.length > 0) {
      sortKey = 10_000 + move.captured.length * 100;
    } else {
      const dest = move.path[move.path.length - 1];
      if (dest !== undefined) {
        const destNum = dest as number;
        if (CENTER_SQUARES.has(destNum)) {
          sortKey = 20;
        } else if (EXPANDED_CENTER_SQUARES.has(destNum)) {
          sortKey = 10;
        }
      }
    }

    return { move, sortKey };
  });

  scored.sort((a, b) => b.sortKey - a.sortKey);
  return scored.map(({ move }) => move);
}

// ---------------------------------------------------------------------------
// Quiescence search
// ---------------------------------------------------------------------------

/**
 * Extends the search in capture-only lines at the horizon.
 * Prevents the horizon effect by resolving capture chains before evaluating.
 */
function quiescenceSearch(
  board: BoardState,
  color: PieceColor,
  alpha: number,
  beta: number,
  ctx: SearchContext,
  remainingDepth: number,
): number {
  if (checkTime(ctx)) return 0;

  // Stand-pat evaluation
  ctx.nodesEvaluated++;
  const standPat = evaluate(board, color);

  if (standPat >= beta) {
    return standPat;
  }

  if (standPat > alpha) {
    alpha = standPat;
  }

  if (remainingDepth <= 0) {
    return standPat;
  }

  // Generate moves — in American Rules, getLegalMoves returns only captures
  // when captures exist (mandatory capture rule).
  const allMoves = ctx.ruleSet.getLegalMoves(board, color);
  const captures = allMoves.filter((m) => m.captured.length > 0);

  if (captures.length === 0) {
    if (allMoves.length === 0) {
      return EVAL_WEIGHTS.lossScore;
    }
    return standPat;
  }

  // Order by capture count (multi-jumps first)
  const orderedCaptures = [...captures].sort((a, b) => b.captured.length - a.captured.length);

  let bestScore = standPat;

  for (const move of orderedCaptures) {
    const newBoard = ctx.ruleSet.applyMove(board, move);
    const score = -quiescenceSearch(
      newBoard,
      opponentColor(color),
      -beta,
      -alpha,
      ctx,
      remainingDepth - 1,
    );

    if (ctx.timeExpired) return 0;

    if (score > bestScore) {
      bestScore = score;
    }

    if (score > alpha) {
      alpha = score;
    }

    if (alpha >= beta) {
      break;
    }
  }

  return bestScore;
}

// ---------------------------------------------------------------------------
// Negamax with alpha-beta pruning
// ---------------------------------------------------------------------------

/**
 * Negamax search with alpha-beta pruning.
 *
 * Returns the evaluation score from the perspective of the player whose
 * turn it is at this node. The caller negates the returned value.
 */
function negamax(
  board: BoardState,
  color: PieceColor,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchContext,
  previousBestMove: Move | null,
): number {
  if (checkTime(ctx)) {
    return 0;
  }

  const moves = ctx.ruleSet.getLegalMoves(board, color);

  // Terminal node: no legal moves = current player loses
  if (moves.length === 0) {
    return EVAL_WEIGHTS.lossScore;
  }

  // Leaf node: depth exhausted
  if (depth <= 0) {
    if (ctx.quiescenceEnabled) {
      const captures = moves.filter((m) => m.captured.length > 0);
      if (captures.length > 0) {
        return quiescenceSearch(board, color, alpha, beta, ctx, ctx.quiescenceMaxDepth);
      }
    }

    ctx.nodesEvaluated++;
    return evaluate(board, color);
  }

  const orderedMoves = orderMoves(moves, previousBestMove);

  let bestScore = -Infinity;

  for (const move of orderedMoves) {
    const newBoard = ctx.ruleSet.applyMove(board, move);
    const score = -negamax(newBoard, opponentColor(color), depth - 1, -beta, -alpha, ctx, null);

    if (ctx.timeExpired) return 0;

    if (score > bestScore) {
      bestScore = score;
    }

    if (score > alpha) {
      alpha = score;
    }

    if (alpha >= beta) {
      break;
    }
  }

  return bestScore;
}

// ---------------------------------------------------------------------------
// Iterative deepening
// ---------------------------------------------------------------------------

/**
 * Performs iterative-deepening search with alpha-beta pruning.
 * Returns the best move found within the depth and time constraints.
 */
export function iterativeSearch(state: GameState, config: SearchConfig): SearchResult {
  const { board, activeColor, ruleSet } = state;
  const ctx: SearchContext = {
    ruleSet,
    nodesEvaluated: 0,
    startTime: performance.now(),
    timeLimitMs: config.timeLimitMs,
    timeExpired: false,
    quiescenceEnabled: config.quiescenceEnabled,
    quiescenceMaxDepth: config.quiescenceMaxDepth,
  };

  const rootMoves = ruleSet.getLegalMoves(board, activeColor);

  // No legal moves
  if (rootMoves.length === 0) {
    return {
      move: null,
      score: EVAL_WEIGHTS.lossScore,
      depth: 0,
      nodesEvaluated: 0,
      rootMoveScores: [],
    };
  }

  // Exactly one legal move — return immediately
  if (rootMoves.length === 1) {
    const onlyMove = rootMoves[0] as Move;
    ctx.nodesEvaluated++;
    const newBoard = ruleSet.applyMove(board, onlyMove);
    const score = evaluate(newBoard, activeColor);
    return {
      move: onlyMove,
      score,
      depth: 1,
      nodesEvaluated: 1,
      rootMoveScores: [{ move: onlyMove, score }],
    };
  }

  // Iterative deepening loop
  let bestResult: SearchResult = {
    move: rootMoves[0] as Move,
    score: -Infinity,
    depth: 0,
    nodesEvaluated: 0,
    rootMoveScores: [],
  };

  let previousBestMove: Move | null = null;

  for (let depth = 1; depth <= config.maxDepth; depth++) {
    const orderedRootMoves = orderMoves(rootMoves, previousBestMove);

    let bestMoveThisDepth: Move = orderedRootMoves[0] as Move;
    let bestScoreThisDepth = -Infinity;
    const currentRootScores: Array<{ move: Move; score: number }> = [];

    for (const move of orderedRootMoves) {
      const newBoard = ruleSet.applyMove(board, move);
      const score = -negamax(
        newBoard,
        opponentColor(activeColor),
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

      // Early termination on forced win
      if (bestScoreThisDepth >= EVAL_WEIGHTS.winScore - depth) {
        break;
      }
    } else {
      break;
    }
  }

  return bestResult;
}
