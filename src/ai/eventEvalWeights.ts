/**
 * Event-aware evaluation system for the AI opponent.
 *
 * Task 10.1 — Event-Aware Evaluator
 *
 * Extends the base evaluator with per-event weight adjustments and score
 * adjusters. The evaluateWithEvents() function composes multipliers
 * multiplicatively across all active events and applies score adjusters
 * sequentially (oldest event first).
 */

import type { ActiveEvent, BoardState } from '../engine/types';
import { CrazyEvent, PieceColor, PieceType } from '../engine/types';
import { getAllAdjacentSquares, getBoardSquare, getSquaresWithColor, BOARD_SIZE } from '../engine/board';
import { evaluate, EVAL_WEIGHTS, type EvalWeights } from './evaluator';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Penalty per pair of friendly pieces within 1 diagonal step of each other
 * during Live Grenade. Tunable based on playtesting (Task 13). */
export const LIVE_GRENADE_PROXIMITY_PENALTY_PER_PAIR = 8;

// ---------------------------------------------------------------------------
// EventEvalWeights interface
// ---------------------------------------------------------------------------

/**
 * Per-event evaluation adjustment definition.
 *
 * Two-part mechanism:
 * 1. `multipliers` — applied to EVAL_WEIGHTS before evaluate() is called.
 * 2. `scoreAdjuster` — pure function applied after evaluation.
 */
export interface EventEvalWeights {
  /**
   * Multipliers applied to each weight field before calling evaluate().
   * Fields not listed inherit a multiplier of 1.0 (unchanged).
   * When multiple events are active, multipliers are composed multiplicatively.
   */
  readonly multipliers?: Partial<Record<keyof EvalWeights, number>>;

  /**
   * Optional score adjuster applied after evaluate() returns.
   * Receives the weighted score, the board, the evaluating color, the active
   * event entry that contributed this adjuster, and the merged weights used.
   * Score adjusters from multiple events are applied sequentially (oldest first).
   */
  readonly scoreAdjuster?: (
    weightedScore: number,
    board: BoardState,
    color: PieceColor,
    event: ActiveEvent,
    appliedWeights: EvalWeights,
  ) => number;
}

// ---------------------------------------------------------------------------
// Weight merging helper
// ---------------------------------------------------------------------------

/**
 * Produces a new EvalWeights object by applying multipliers to the base.
 * Only listed fields are multiplied; all others carry over unchanged.
 * The base object is never mutated.
 */
export function mergeWeights(
  base: EvalWeights,
  multipliers: Partial<Record<keyof EvalWeights, number>>,
): EvalWeights {
  return {
    pawnValue: base.pawnValue * (multipliers.pawnValue ?? 1),
    kingValue: base.kingValue * (multipliers.kingValue ?? 1),
    advancementPerRow: base.advancementPerRow * (multipliers.advancementPerRow ?? 1),
    centerBonus: base.centerBonus * (multipliers.centerBonus ?? 1),
    expandedCenterBonus: base.expandedCenterBonus * (multipliers.expandedCenterBonus ?? 1),
    backRowBonus: base.backRowBonus * (multipliers.backRowBonus ?? 1),
    mobilityPerMove: base.mobilityPerMove * (multipliers.mobilityPerMove ?? 1),
    trappedKingPenalty: base.trappedKingPenalty * (multipliers.trappedKingPenalty ?? 1),
    semiTrappedKingPenalty:
      base.semiTrappedKingPenalty * (multipliers.semiTrappedKingPenalty ?? 1),
    endgamePieceThreshold: base.endgamePieceThreshold * (multipliers.endgamePieceThreshold ?? 1),
    endgameKingValue: base.endgameKingValue * (multipliers.endgameKingValue ?? 1),
    endgameAdvancementPerRow:
      base.endgameAdvancementPerRow * (multipliers.endgameAdvancementPerRow ?? 1),
    winScore: base.winScore * (multipliers.winScore ?? 1),
    lossScore: base.lossScore * (multipliers.lossScore ?? 1),
  };
}

// ---------------------------------------------------------------------------
// Proximity helper (Live Grenade)
// ---------------------------------------------------------------------------

/**
 * Counts pairs of friendly pieces within 1 diagonal step of each other.
 * Used by the Live Grenade score adjuster to penalize clustering.
 */
function countProximityPairs(board: BoardState, color: PieceColor): number {
  const squares = getSquaresWithColor(board, color);
  const squareSet = new Set<number>(squares as number[]);
  let pairs = 0;

  for (const sq of squares) {
    for (const { adjacent } of getAllAdjacentSquares(sq)) {
      const adjNum = adjacent as number;
      if (squareSet.has(adjNum) && adjNum > (sq as number)) {
        // Count each pair once (only when adjacent index is higher)
        pairs++;
      }
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Per-event weight registry
// ---------------------------------------------------------------------------

/**
 * Registry mapping each CrazyEvent to its evaluation adjustment.
 * Events without an entry fall back to base evaluation (no overhead).
 */
export const EVENT_EVAL_WEIGHTS_REGISTRY: ReadonlyMap<CrazyEvent, EventEvalWeights> = new Map<
  CrazyEvent,
  EventEvalWeights
>([
  // Event 1: King for a Day — all pieces move as kings for 1 round
  [
    CrazyEvent.KingForADay,
    {
      multipliers: {
        mobilityPerMove: 2.0,
        backRowBonus: 0.0,
        advancementPerRow: 0.3,
        endgameAdvancementPerRow: 0.3,
        trappedKingPenalty: 0.5,
        semiTrappedKingPenalty: 0.5,
      },
    },
  ],

  // Event 2: Live Grenade — next capture explodes, removing adjacent pieces
  [
    CrazyEvent.LiveGrenade,
    {
      scoreAdjuster: (weightedScore, board, color) => {
        const myPairs = countProximityPairs(board, color);
        const oppColor = color === PieceColor.White ? PieceColor.Black : PieceColor.White;
        const oppPairs = countProximityPairs(board, oppColor);
        // Bonus for opponent clustering, penalty for own clustering
        const adjustment =
          (oppPairs - myPairs) * LIVE_GRENADE_PROXIMITY_PENALTY_PER_PAIR;
        return weightedScore + adjustment;
      },
    },
  ],

  // Event 3: Hot Potato — piece the current player moves switches sides
  [
    CrazyEvent.HotPotato,
    {
      scoreAdjuster: (weightedScore, board, color, event, appliedWeights) => {
        if (event.triggeredBy !== color) return weightedScore;
        const mySquares = getSquaresWithColor(board, color);
        if (mySquares.length === 0) return weightedScore;
        const oppColor = color === PieceColor.White ? PieceColor.Black : PieceColor.White;
        const oppSquares = getSquaresWithColor(board, oppColor);
        const totalPieces = mySquares.length + oppSquares.length;
        const isEndgame = totalPieces <= appliedWeights.endgamePieceThreshold;
        // Approximate average piece value
        let totalValue = 0;
        for (const sq of mySquares) {
          const piece = getBoardSquare(board, sq);
          if (piece !== null) {
            const isKing = piece.type === PieceType.King;
            totalValue += isKing
              ? (isEndgame ? appliedWeights.endgameKingValue : appliedWeights.kingValue)
              : appliedWeights.pawnValue;
          }
        }
        const avgValue = totalValue / mySquares.length;
        // Bidirectional swing: losing piece + opponent gaining it
        return weightedScore - avgValue * 2;
      },
    },
  ],

  // Event 4: Checks Mix — pieces redistributed to random valid squares
  // Only material and terminal states retain base values; positional factors zeroed
  [
    CrazyEvent.ChecksMix,
    {
      multipliers: {
        advancementPerRow: 0.0,
        centerBonus: 0.0,
        expandedCenterBonus: 0.0,
        backRowBonus: 0.0,
        mobilityPerMove: 0.0,
        trappedKingPenalty: 0.0,
        semiTrappedKingPenalty: 0.0,
        endgameAdvancementPerRow: 0.0,
      },
    },
  ],

  // Event 5: Opposite Day — win condition inverted (lose all pieces = win)
  [
    CrazyEvent.OppositeDay,
    {
      scoreAdjuster: (weightedScore) => -weightedScore,
    },
  ],

  // Event 6: Up in the Air — all pieces have flying movement
  [
    CrazyEvent.UpInTheAir,
    {
      multipliers: {
        mobilityPerMove: 4.0,
        centerBonus: 0.3,
        expandedCenterBonus: 0.3,
        backRowBonus: 0.5,
      },
    },
  ],

  // Event 7: No Touching! — pawns cannot capture kings
  [
    CrazyEvent.NoTouching,
    {
      multipliers: {
        trappedKingPenalty: 0.4,
        semiTrappedKingPenalty: 0.4,
        kingValue: 1.3,
        endgameKingValue: 1.2,
      },
    },
  ],

  // Event 8: Step-Back — pawns can capture backwards
  [
    CrazyEvent.StepBack,
    {
      multipliers: {
        mobilityPerMove: 1.5,
        backRowBonus: 0.3,
        advancementPerRow: 0.7,
      },
    },
  ],

  // Event 11: Dealer's Choice — skip mandatory capture once per player
  [
    CrazyEvent.DealersChoice,
    {
      multipliers: {
        mobilityPerMove: 1.3,
      },
    },
  ],

  // Event 12: Bodyguard — kings adjacent to friendly pawns can't be captured
  [
    CrazyEvent.Bodyguard,
    {
      multipliers: {
        kingValue: 1.4,
        endgameKingValue: 1.3,
        trappedKingPenalty: 0.3,
        semiTrappedKingPenalty: 0.3,
      },
      scoreAdjuster: (weightedScore, board, color) => {
        // Bonus for having king-pawn adjacency pairs (guarded formation)
        const mySquares = getSquaresWithColor(board, color);
        let guardedCount = 0;
        for (const sq of mySquares) {
          const piece = getBoardSquare(board, sq);
          if (piece !== null && piece.type === PieceType.King) {
            for (const { adjacent } of getAllAdjacentSquares(sq)) {
              const adj = getBoardSquare(board, adjacent);
              if (adj !== null && adj.color === color && adj.type === PieceType.Pawn) {
                guardedCount++;
                break;
              }
            }
          }
        }
        return weightedScore + guardedCount * 12;
      },
    },
  ],

  // Event 13: Quicksand — edge pieces are stuck
  [
    CrazyEvent.Quicksand,
    {
      multipliers: {
        centerBonus: 2.0,
        expandedCenterBonus: 1.5,
        backRowBonus: 0.0,
      },
    },
  ],

  // Event 18: Frozen Assets — all kings frozen
  [
    CrazyEvent.FrozenAssets,
    {
      multipliers: {
        pawnValue: 1.5,
        kingValue: 0.3,
        endgameKingValue: 0.3,
        advancementPerRow: 1.5,
        endgameAdvancementPerRow: 1.5,
        trappedKingPenalty: 0.0,
        semiTrappedKingPenalty: 0.0,
      },
    },
  ],

  // Event 20: Safe Haven — pieces on near-corner squares can't be captured
  [
    CrazyEvent.SafeHaven,
    {
      scoreAdjuster: (weightedScore, board, color) => {
        const SAFE_SQUARES = [6, 8, 25, 27];
        let bonus = 0;
        for (const sq of SAFE_SQUARES) {
          const piece = board[sq - 1];
          if (piece == null) continue;
          if (piece.color === color) bonus += 15;
          else bonus -= 15;
        }
        return weightedScore + bonus;
      },
    },
  ],

  // Event 22: Promotion Party — expanded promotion zone
  [
    CrazyEvent.PromotionParty,
    {
      multipliers: {
        advancementPerRow: 2.0,
        endgameAdvancementPerRow: 2.0,
        pawnValue: 1.2,
      },
    },
  ],

  // Event 25: Demotion — all kings demoted to pawns
  [
    CrazyEvent.Demotion,
    {
      multipliers: {
        kingValue: 0.2,
        endgameKingValue: 0.2,
        pawnValue: 1.3,
        advancementPerRow: 1.8,
        endgameAdvancementPerRow: 1.8,
        trappedKingPenalty: 0.0,
        semiTrappedKingPenalty: 0.0,
      },
    },
  ],

  // Event 27: Forced March — must move most advanced piece
  [
    CrazyEvent.ForcedMarch,
    {
      multipliers: {
        advancementPerRow: 0.5,
        mobilityPerMove: 0.7,
      },
    },
  ],

  // Event 33: Royal Decree — only kings may move
  [
    CrazyEvent.RoyalDecree,
    {
      multipliers: {
        kingValue: 2.0,
        endgameKingValue: 1.8,
        pawnValue: 0.5,
        trappedKingPenalty: 2.0,
        semiTrappedKingPenalty: 1.5,
      },
    },
  ],

  // Event 35: Sentry — kings pin adjacent enemy pawns
  [
    CrazyEvent.Sentry,
    {
      multipliers: {
        kingValue: 1.5,
        endgameKingValue: 1.4,
        mobilityPerMove: 1.3,
      },
    },
  ],

  // Event 36: Rush Hour — pawns can double-step forward
  [
    CrazyEvent.RushHour,
    {
      multipliers: {
        mobilityPerMove: 1.5,
        advancementPerRow: 1.3,
        endgameAdvancementPerRow: 1.3,
      },
    },
  ],
]);

// ---------------------------------------------------------------------------
// EMPTY_BOARD sentinel
// ---------------------------------------------------------------------------

/**
 * An all-null board used as a placeholder at terminal nodes when calling
 * score adjusters. At terminal nodes the game is already structurally
 * decided, so board-dependent adjusters (Live Grenade, Hot Potato) yield
 * zero adjustment; only board-independent adjusters (Opposite Day) produce
 * meaningful results. Acceptable for Phase 2; revisit in Task 13 playtesting.
 */
export const EMPTY_BOARD: BoardState = new Array<null>(BOARD_SIZE).fill(null) as BoardState;

// ---------------------------------------------------------------------------
// evaluateWithEvents
// ---------------------------------------------------------------------------

/**
 * Evaluates a board position from the perspective of the given color,
 * taking active Crazy mode events into account.
 *
 * When activeEvents is empty (Classic mode), delegates directly to evaluate()
 * with no overhead. Otherwise:
 * 1. Composes weight multipliers from all active events multiplicatively.
 * 2. Calls evaluate() with the merged weights.
 * 3. Applies score adjusters sequentially (oldest event first).
 */
export function evaluateWithEvents(
  board: BoardState,
  color: PieceColor,
  activeEvents: readonly ActiveEvent[],
): number {
  if (activeEvents.length === 0) {
    return evaluate(board, color);
  }

  // Phase 1: Compose weight multipliers multiplicatively across all active events
  let mergedWeights: EvalWeights = EVAL_WEIGHTS;
  for (const event of activeEvents) {
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(event.type);
    if (entry?.multipliers) {
      mergedWeights = mergeWeights(mergedWeights, entry.multipliers);
    }
  }

  // Phase 2: Evaluate with merged weights
  let score = evaluate(board, color, mergedWeights);

  // Phase 3: Apply score adjusters sequentially (oldest event first = array order)
  for (const event of activeEvents) {
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(event.type);
    if (entry?.scoreAdjuster) {
      score = entry.scoreAdjuster(score, board, color, event, mergedWeights);
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// getTerminalLossScore
// ---------------------------------------------------------------------------

/**
 * Returns the terminal loss score adjusted for active events.
 *
 * At a node where the current player has no legal moves, the raw score is
 * EVAL_WEIGHTS.lossScore. Under Opposite Day this must become a win score
 * (losing all pieces is the win condition). This function applies all active
 * event score adjusters to the base loss score using an empty board sentinel,
 * so board-independent adjusters like Opposite Day work correctly.
 *
 * For Classic mode (empty activeEvents array) returns EVAL_WEIGHTS.lossScore
 * directly with no overhead.
 */
export function getTerminalLossScore(activeEvents: readonly ActiveEvent[]): number {
  if (activeEvents.length === 0) {
    return EVAL_WEIGHTS.lossScore;
  }
  let score: number = EVAL_WEIGHTS.lossScore;
  for (const event of activeEvents) {
    const entry = EVENT_EVAL_WEIGHTS_REGISTRY.get(event.type);
    if (entry?.scoreAdjuster !== undefined) {
      score = entry.scoreAdjuster(score, EMPTY_BOARD, event.triggeredBy, event, EVAL_WEIGHTS);
    }
  }
  return score;
}
