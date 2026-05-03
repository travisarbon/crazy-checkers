/**
 * Harzdame evaluator (Task 29.7).
 *
 * Material with senior-king 1.5× bonus + advancement + promotion
 * proximity. Per playbook §6.2; per-game subtask 29.G.2-A refines via
 * 500-game self-play.
 */

import type { ClassifiedGameState } from '../../../../engine/classified/state';
import type { EvaluateClassifiedPosition, Tier2Side } from '../common/types';
import type { HarzdameEvalWeights } from './weights';

export function makeHarzdameEvaluator(
  weights: HarzdameEvalWeights,
  promotionAreaWhite: ReadonlySet<number>,
  promotionAreaBlack: ReadonlySet<number>,
): EvaluateClassifiedPosition {
  return (state, side) =>
    evaluateHarzdame(state, side, weights, promotionAreaWhite, promotionAreaBlack);
}

function evaluateHarzdame(
  state: ClassifiedGameState,
  side: Tier2Side,
  weights: HarzdameEvalWeights,
  promotionAreaWhite: ReadonlySet<number>,
  promotionAreaBlack: ReadonlySet<number>,
): number {
  let score = 0;
  const boardSize = 8;
  for (const [nodeId, piece] of state.pieces) {
    const owner = piece.owner;
    if (owner !== 'white' && owner !== 'black') continue;
    const sideMul = owner === side ? 1 : -1;

    let value: number;
    if (piece.kind === 'king') {
      value = piece.promoted === true ? weights.seniorKingValue : weights.regularKingValue;
    } else {
      value = weights.manValue;
    }
    score += sideMul * value;

    const idx = nodeId as unknown as number;
    const r = Math.floor(idx / boardSize);
    const advancement = owner === 'white' ? boardSize - 1 - r : r;
    score += sideMul * weights.advancementBonus * advancement;

    if (piece.kind === 'man') {
      const area = owner === 'white' ? promotionAreaWhite : promotionAreaBlack;
      if (area.has(idx)) {
        score += sideMul * weights.promotionProximityBonus;
      }
    }
  }
  return score;
}
