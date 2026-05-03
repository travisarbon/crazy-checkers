/**
 * Zamma evaluator (Task 29.7).
 *
 * Material + advancement + mobility (proxy for connectivity on the
 * alquerque graph). Per playbook §6.2; per-game subtask 29.G.5-A refines
 * via self-play.
 */

import type { ClassifiedGameState } from '../../../../engine/classified/state';
import type { ClassifiedRuleSet } from '../../../../engine/classified/ClassifiedRuleSet';
import type { EvaluateClassifiedPosition, Tier2Side } from '../common/types';
import type { AlquerqueEvalWeights } from './weights';

export function makeZammaEvaluator(
  weights: AlquerqueEvalWeights,
  ruleSet: ClassifiedRuleSet,
  boardSize: number,
): EvaluateClassifiedPosition {
  return (state, side) => evaluateZamma(state, side, weights, ruleSet, boardSize);
}

function evaluateZamma(
  state: ClassifiedGameState,
  side: Tier2Side,
  weights: AlquerqueEvalWeights,
  ruleSet: ClassifiedRuleSet,
  boardSize: number,
): number {
  let score = 0;
  for (const [nodeId, piece] of state.pieces) {
    const owner = piece.owner;
    if (owner !== 'white' && owner !== 'black') continue;
    const sideMul = owner === side ? 1 : -1;
    const value = piece.kind === 'king' ? weights.kingValue : weights.manValue;
    score += sideMul * value;

    const idx = nodeId as unknown as number;
    const r = Math.floor(idx / boardSize);
    const advancement = owner === 'white' ? boardSize - 1 - r : r;
    score += sideMul * weights.advancementBonus * advancement;
  }

  // Mobility bonus — count legal moves for the side to play.
  if (state.turn === side) {
    const moves = ruleSet.getLegalMoves(state);
    score += weights.mobilityBonus * moves.length;
  }
  return score;
}
