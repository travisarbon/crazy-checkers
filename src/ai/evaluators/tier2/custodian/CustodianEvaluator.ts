/**
 * Custodian-engine evaluator (Task 29.7).
 *
 * Material + mobility + sandwich-risk penalty (counts adjacent-enemy
 * squares for friendly pieces). Rek-specific king-safety multiplier
 * fires when `weights.kingValue` is large (instant-win Rek case).
 *
 * Per playbook §6.2; per-game subtasks 29.G.6-A through 29.G.9-A refine
 * via 500-game self-play.
 */

import type { ClassifiedGameState } from '../../../../engine/classified/state';
import type { ClassifiedRuleSet } from '../../../../engine/classified/ClassifiedRuleSet';
import type { EvaluateClassifiedPosition, Tier2Side } from '../common/types';
import type { CustodianEvalWeights } from './weights';

export function makeCustodianEvaluator(
  weights: CustodianEvalWeights,
  ruleSet: ClassifiedRuleSet,
  boardSize: number,
): EvaluateClassifiedPosition {
  return (state, side) => evaluateCustodian(state, side, weights, ruleSet, boardSize);
}

function evaluateCustodian(
  state: ClassifiedGameState,
  side: Tier2Side,
  weights: CustodianEvalWeights,
  ruleSet: ClassifiedRuleSet,
  boardSize: number,
): number {
  let score = 0;
  for (const [, piece] of state.pieces) {
    const owner = piece.owner;
    if (owner !== 'white' && owner !== 'black') continue;
    const sideMul = owner === side ? 1 : -1;
    const baseValue = piece.kind === 'king' ? weights.kingValue : weights.manValue;
    score += sideMul * baseValue * (piece.kind === 'king' ? weights.kingSafetyMultiplier : 1);
  }

  // Mobility bonus.
  if (state.turn === side) {
    const moves = ruleSet.getLegalMoves(state);
    score += weights.mobilityBonus * moves.length;
  }

  // Crude sandwich-risk: count friendly pieces with enemies on opposite cardinal sides.
  if (weights.sandwichRiskPenalty < 0) {
    score += weights.sandwichRiskPenalty * countSandwichRisk(state, side, boardSize);
  }

  return score;
}

function countSandwichRisk(
  state: ClassifiedGameState,
  side: Tier2Side,
  boardSize: number,
): number {
  let count = 0;
  for (const [nodeId, piece] of state.pieces) {
    if (piece.owner !== side) continue;
    const idx = nodeId as unknown as number;
    const r = Math.floor(idx / boardSize);
    const c = idx % boardSize;
    // Check horizontal sandwich: enemies at (r, c-1) and (r, c+1).
    if (
      isEnemyAt(state, r, c - 1, side, boardSize) &&
      isEnemyAt(state, r, c + 1, side, boardSize)
    ) {
      count += 1;
    }
    // Check vertical sandwich.
    if (
      isEnemyAt(state, r - 1, c, side, boardSize) &&
      isEnemyAt(state, r + 1, c, side, boardSize)
    ) {
      count += 1;
    }
  }
  return count;
}

function isEnemyAt(
  state: ClassifiedGameState,
  r: number,
  c: number,
  side: Tier2Side,
  boardSize: number,
): boolean {
  if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) return false;
  const nodeId = (r * boardSize + c) as unknown as Parameters<typeof state.pieces.get>[0];
  const piece = state.pieces.get(nodeId);
  if (!piece) return false;
  return piece.owner !== side && (piece.owner === 'white' || piece.owner === 'black');
}
