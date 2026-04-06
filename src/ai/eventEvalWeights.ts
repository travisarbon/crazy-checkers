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

import type { ActiveEvent, BoardState, Square } from '../engine/types';
import { CrazyEvent, PieceColor, PieceType } from '../engine/types';
import { getAllAdjacentSquares, getBoardSquare, getSquaresWithColor, squareToGrid, BOARD_SIZE } from '../engine/board';
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

  // Event 14: Conscription — captured pieces switch sides instead of removal
  [
    CrazyEvent.Conscription,
    {
      multipliers: {
        pawnValue: 1.8,
        kingValue: 1.6,
        mobilityPerMove: 1.3,
      },
    },
  ],

  // Event 15: Ghost Walk — pieces phase through friendly blockers
  [
    CrazyEvent.GhostWalk,
    {
      multipliers: {
        mobilityPerMove: 1.5,
        centerBonus: 0.9,
      },
    },
  ],

  // Event 16: Landmine — center squares destroy entering pieces
  [
    CrazyEvent.Landmine,
    {
      multipliers: {
        centerBonus: -0.5,
        expandedCenterBonus: 0.3,
      },
      scoreAdjuster: (weightedScore, board, color, event, appliedWeights) => {
        // Penalize own pieces on mined squares that aren't safe
        const metadata = event.metadata as { safePieces?: Array<{ square: number }> } | undefined;
        const safePieces = metadata?.safePieces ?? [];
        let penalty = 0;
        for (const sq of [14, 15, 18, 19]) {
          const piece = board[sq - 1];
          if (piece !== null && piece !== undefined && piece.color === color) {
            const isSafe = safePieces.some(sp => sp.square === sq);
            if (!isSafe) penalty -= appliedWeights.pawnValue * 0.5;
          }
        }
        return weightedScore + penalty;
      },
    },
  ],

  // Event 17: Leapfrog — non-capturing jumps over friendly pieces
  [
    CrazyEvent.Leapfrog,
    {
      multipliers: {
        mobilityPerMove: 2.0,
        advancementPerRow: 1.2,
      },
    },
  ],

  // Event 19: Double Time — two moves per turn
  [
    CrazyEvent.DoubleTime,
    {
      multipliers: {
        pawnValue: 1.3,
        kingValue: 1.3,
        mobilityPerMove: 1.5,
        advancementPerRow: 1.3,
      },
    },
  ],

  // Event 21: Chain Reaction — captures cascade through adjacent same-color pieces
  [
    CrazyEvent.ChainReaction,
    {
      multipliers: {
        centerBonus: 0.5,
        expandedCenterBonus: 0.6,
      },
      scoreAdjuster: (weightedScore, board, color, _event, appliedWeights) => {
        // Penalize own piece clusters (adjacent same-color pieces)
        const ownSquares = getSquaresWithColor(board, color);
        let clusterPenalty = 0;
        for (const sq of ownSquares) {
          for (const { adjacent } of getAllAdjacentSquares(sq)) {
            const piece = getBoardSquare(board, adjacent);
            if (piece !== null && piece.color === color) {
              clusterPenalty -= appliedWeights.pawnValue * 0.15;
            }
          }
        }
        // Reward targeting enemy clusters
        const enemyColor = color === PieceColor.White ? PieceColor.Black : PieceColor.White;
        const enemySquares = getSquaresWithColor(board, enemyColor);
        let clusterBonus = 0;
        for (const sq of enemySquares) {
          for (const { adjacent } of getAllAdjacentSquares(sq)) {
            const piece = getBoardSquare(board, adjacent);
            if (piece !== null && piece.color === enemyColor) {
              clusterBonus += appliedWeights.pawnValue * 0.1;
            }
          }
        }
        return weightedScore + clusterPenalty + clusterBonus;
      },
    },
  ],

  // Event 23: Reinforcements — spawn pawns on back row
  [
    CrazyEvent.Reinforcements,
    {
      multipliers: {
        pawnValue: 0.8,
        backRowBonus: 1.4,
        advancementPerRow: 0.9,
      },
    },
  ],

  // Event 24: Wormhole — teleportation between linked square pairs
  [
    CrazyEvent.Wormhole,
    {
      multipliers: {
        mobilityPerMove: 1.3,
        centerBonus: 0.8,
      },
    },
  ],

  // Event 26: Time Bomb — countdown detonation on a random piece
  [
    CrazyEvent.TimeBomb,
    {
      multipliers: {
        kingValue: 1.1,
      },
      scoreAdjuster: (weightedScore, board, color, event, appliedWeights) => {
        const metadata = event.metadata as { bombSquare?: number; countdown?: number; bombColor?: string } | undefined;
        if (!metadata?.bombSquare || metadata.bombSquare < 0 || !metadata.countdown) return weightedScore;
        const bombPiece = getBoardSquare(board, metadata.bombSquare as Square);
        if (bombPiece === null) return weightedScore;

        let penalty = 0;
        const neighbors = getAllAdjacentSquares(metadata.bombSquare as Square);
        for (const { adjacent } of neighbors) {
          const piece = getBoardSquare(board, adjacent);
          if (piece !== null && piece.color === color) {
            penalty -= appliedWeights.pawnValue * 0.4 * (1 / metadata.countdown);
          }
        }
        if (bombPiece.color !== color) {
          penalty += appliedWeights.pawnValue * 0.3;
        }
        return weightedScore + penalty;
      },
    },
  ],

  // Event 28: Ricochet — post-capture diagonal bounce
  [
    CrazyEvent.Ricochet,
    {
      multipliers: {
        mobilityPerMove: 1.2,
        advancementPerRow: 1.1,
      },
    },
  ],

  // Event 29: Crown Thief — pawn capturing king gets promoted
  [
    CrazyEvent.CrownThief,
    {
      multipliers: {
        pawnValue: 1.4,
        kingValue: 0.8,
        mobilityPerMove: 1.1,
      },
    },
  ],

  // Event 30: Stampede — all pawns advance one square
  [
    CrazyEvent.Stampede,
    {
      multipliers: {
        advancementPerRow: 0.7,
        backRowBonus: 0.5,
        centerBonus: 1.2,
      },
    },
  ],

  // Event 31: Toll Road — captures cost the capturer their least advanced piece
  [
    CrazyEvent.TollRoad,
    {
      multipliers: {
        pawnValue: 1.3,
        kingValue: 1.4,
        mobilityPerMove: 0.8,
        backRowBonus: 0.5,
      },
    },
  ],

  // Event 32: Swap Meet — random opposing piece position swaps
  [
    CrazyEvent.SwapMeet,
    {
      multipliers: {
        advancementPerRow: 0.5,
        centerBonus: 0.6,
        expandedCenterBonus: 0.6,
        backRowBonus: 0.5,
        mobilityPerMove: 0.9,
      },
    },
  ],

  // Event 34: Backfire — friendly fire captures
  [
    CrazyEvent.Backfire,
    {
      multipliers: {
        pawnValue: 1.2,
        kingValue: 1.3,
        mobilityPerMove: 0.7,
      },
      scoreAdjuster: (weightedScore, board, color, _event, appliedWeights) => {
        // Penalize having pieces adjacent to own pieces (friendly fire exposure)
        const ownSquares = getSquaresWithColor(board, color);
        let friendlyAdjacentPenalty = 0;
        for (const sq of ownSquares) {
          for (const { adjacent } of getAllAdjacentSquares(sq)) {
            const piece = getBoardSquare(board, adjacent);
            if (piece !== null && piece.color === color) {
              friendlyAdjacentPenalty -= appliedWeights.pawnValue * 0.1;
            }
          }
        }
        return weightedScore + friendlyAdjacentPenalty;
      },
    },
  ],

  // Event 38: Sacrifice — defender's most advanced pawn promotes on capture
  [
    CrazyEvent.Sacrifice,
    {
      multipliers: {
        pawnValue: 1.3,
        kingValue: 0.9,
        advancementPerRow: 1.4,
      },
      scoreAdjuster: (weightedScore, board, color, _event, appliedWeights) => {
        // Count opponent's promotable pawns — each reduces value of captures
        const enemyColor = color === PieceColor.White ? PieceColor.Black : PieceColor.White;
        const enemySquares = getSquaresWithColor(board, enemyColor);
        let enemyPawnCount = 0;
        for (const sq of enemySquares) {
          const p = getBoardSquare(board, sq);
          if (p !== null && p.type === PieceType.Pawn) {
            enemyPawnCount++;
          }
        }
        const capturePenalty = enemyPawnCount * appliedWeights.pawnValue * -0.15;
        return weightedScore + capturePenalty;
      },
    },
  ],

  // Event 9: Flipped Script — promotion rows permanently swapped
  [
    CrazyEvent.FlippedScript,
    {
      multipliers: {
        advancementPerRow: -0.5,
        endgameAdvancementPerRow: -0.5,
        backRowBonus: 2.5,
        kingValue: 1.3,
      },
    },
  ],

  // Event 10: Marching Orders — orthogonal movement replaces diagonal
  [
    CrazyEvent.MarchingOrders,
    {
      multipliers: {
        centerBonus: 1.5,
        expandedCenterBonus: 1.3,
        mobilityPerMove: 1.5,
        advancementPerRow: 0.8,
        backRowBonus: 0.5,
        trappedKingPenalty: 1.5,
      },
    },
  ],

  // Event 37: Haunted — captured pieces become ghost obstacles
  [
    CrazyEvent.Haunted,
    {
      multipliers: {
        centerBonus: 1.3,
        mobilityPerMove: 1.4,
        trappedKingPenalty: 1.5,
      },
      scoreAdjuster: (weightedScore, board, color, event) => {
        const metadata = event.metadata as { ghosts?: ReadonlyArray<{ square: number }> } | undefined;
        if (!metadata?.ghosts) return weightedScore;

        const ghostSet = new Set(metadata.ghosts.map(g => g.square));
        let proximityPenalty = 0;
        for (const sq of getSquaresWithColor(board, color)) {
          for (const { adjacent } of getAllAdjacentSquares(sq)) {
            if (ghostSet.has(adjacent as number)) {
              proximityPenalty += 3;
            }
          }
        }
        return weightedScore - proximityPenalty;
      },
    },
  ],

  // Event 39: Shrinking Board — progressive ring elimination
  [
    CrazyEvent.ShrinkingBoard,
    {
      multipliers: {
        centerBonus: 2.0,
        expandedCenterBonus: 1.5,
        backRowBonus: 0.0,
        advancementPerRow: 0.5,
        endgameAdvancementPerRow: 0.5,
        mobilityPerMove: 1.5,
      },
      scoreAdjuster: (weightedScore, board, color, event) => {
        const metadata = event.metadata as {
          removedSquares?: readonly number[];
          nextRingLevel?: number;
        } | undefined;
        if (!metadata?.removedSquares) return weightedScore;

        const removedSet = new Set(metadata.removedSquares);
        let penalty = 0;
        for (const sq of getSquaresWithColor(board, color)) {
          if (removedSet.has(sq as number)) {
            penalty += 20;
          } else {
            const { row, col } = squareToGrid(sq);
            const distFromEdge = Math.min(row, 7 - row, col, 7 - col);
            const nextRing = metadata.nextRingLevel ?? 1;
            if (distFromEdge <= nextRing) {
              penalty += (nextRing - distFromEdge + 1) * 5;
            }
          }
        }
        return weightedScore - penalty;
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
