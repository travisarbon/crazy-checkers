/**
 * Stacking-engine evaluator (Task 29.7).
 *
 * Material-based scoring with stack-composition awareness:
 *  - Top-piece material value (Man / King).
 *  - Friendly riders (riders below the top piece who share owner) — bonus per stratum.
 *  - Enemy riders (riders below the top piece owned by the opponent — locked-up but
 *    recoverable on a future capture of the column) — small penalty.
 *  - Advancement bonus toward the promotion row.
 *
 * Per playbook §6.2 row "Lasca/Bashni": "Tower composition (tall friendly
 * towers strong) + commander type + material count by top piece." This is
 * the engine-task scaffolding; per-game subtasks 29.G.3-A / 29.G.4-A
 * refine via 500-game self-play.
 */

import type { ClassifiedGameState, ClassifiedPiece } from '../../../../engine/classified/state';
import type { EvaluateClassifiedPosition, Tier2Side } from '../common/types';
import type { StackingEvalWeights } from './weights';

export function makeStackingEvaluator(
  weights: StackingEvalWeights,
  boardSize: number,
): EvaluateClassifiedPosition {
  return (state, side) => evaluateStacking(state, side, weights, boardSize);
}

function evaluateStacking(
  state: ClassifiedGameState,
  side: Tier2Side,
  weights: StackingEvalWeights,
  boardSize: number,
): number {
  let score = 0;
  for (const [nodeId, piece] of state.pieces) {
    const owner = piece.owner;
    if (owner !== 'white' && owner !== 'black') continue;
    const sideMul = owner === side ? 1 : -1;

    // Top piece value.
    const topValue = piece.kind === 'king' ? weights.kingValue : weights.manValue;
    score += sideMul * topValue;

    // Stack composition (riders).
    if (piece.stack && piece.stack.length > 1) {
      // The first entry is conventionally the commander (top piece). The
      // rest are riders. Inspect each rider's owner.
      for (let i = 1; i < piece.stack.length; i += 1) {
        const rider = piece.stack[i] as ClassifiedPiece;
        if (rider.owner === owner) {
          score += sideMul * weights.friendlyRiderBonus;
        } else {
          // An enemy rider is bad for the column owner (might escape) but
          // also good (locked-up enemy material). Net small penalty.
          score += sideMul * weights.enemyRiderPenalty;
        }
      }
    }

    // Advancement: distance from owner's back rank.
    const idx = nodeId as unknown as number;
    const r = Math.floor(idx / boardSize);
    const advancement = owner === 'white' ? boardSize - 1 - r : r;
    score += sideMul * weights.advancementBonus * advancement;
  }
  return score;
}
