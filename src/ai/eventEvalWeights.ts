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
import { getAllAdjacentSquares, getBoardSquare, getSquaresWithColor } from '../engine/board';
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
]);

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
