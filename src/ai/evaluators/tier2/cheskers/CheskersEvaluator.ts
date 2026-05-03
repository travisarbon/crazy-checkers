/**
 * Cheskers evaluator (Task 29.7).
 *
 * Material with per-kind Cheskers piece values + mobility. Per playbook
 * §6.2; per-game subtask 29.G.10-A refines via 500-game self-play.
 */

import type { ClassifiedGameState } from '../../../../engine/classified/state';
import type { ClassifiedRuleSet } from '../../../../engine/classified/ClassifiedRuleSet';
import type { EvaluateClassifiedPosition, Tier2Side } from '../common/types';
import type { CheskersEvalWeights } from './weights';

export function makeCheskersEvaluator(
  weights: CheskersEvalWeights,
  ruleSet: ClassifiedRuleSet,
): EvaluateClassifiedPosition {
  return (state, side) => evaluateCheskers(state, side, weights, ruleSet);
}

function evaluateCheskers(
  state: ClassifiedGameState,
  side: Tier2Side,
  weights: CheskersEvalWeights,
  ruleSet: ClassifiedRuleSet,
): number {
  let score = 0;
  for (const [, piece] of state.pieces) {
    const owner = piece.owner;
    if (owner !== 'white' && owner !== 'black') continue;
    const sideMul = owner === side ? 1 : -1;
    let value: number;
    switch (piece.kind) {
      case 'pawn':
        value = weights.pawnValue;
        break;
      case 'king':
        value = weights.kingValue;
        break;
      case 'bishop':
        value = weights.bishopValue;
        break;
      case 'camel':
        value = weights.camelValue;
        break;
      default:
        value = 0;
    }
    score += sideMul * value;
  }

  if (state.turn === side) {
    const moves = ruleSet.getLegalMoves(state);
    score += weights.mobilityBonus * moves.length;
  }

  return score;
}
