/**
 * Stacking-engine evaluator weights (Task 29.7).
 *
 * Per playbook §6.2 row "Lasca/Bashni": "Tower composition (tall friendly
 * towers strong) + commander type + material count by top piece."
 *
 * Weights are per-game (Lasca = 7×7 wave-1 #13; Bashni = 8×8 wave-1 #14).
 * Initial values from playbook §6.2; per-game subtask 29.G.3-A / 29.G.4-A
 * refines via 500-game self-play.
 */

import type { ClassifiedGameId } from '../../../../engine/classified/ClassifiedRuleSet';

export interface StackingEvalWeights {
  /** Material value of the top piece per side. */
  readonly manValue: number;
  readonly kingValue: number;
  /** Bonus per stratum below the top of the stack (friendly riders are good). */
  readonly friendlyRiderBonus: number;
  /** Penalty per stratum below the top of the stack that's an enemy rider (locked-up enemy is good but recoverable). */
  readonly enemyRiderPenalty: number;
  /** Bonus for advancing a piece toward the promotion row. */
  readonly advancementBonus: number;
}

export const LASCA_WEIGHTS: StackingEvalWeights = Object.freeze({
  manValue: 100,
  kingValue: 250,
  friendlyRiderBonus: 35,
  enemyRiderPenalty: -10,
  advancementBonus: 5,
});

export const BASHNI_WEIGHTS: StackingEvalWeights = Object.freeze({
  manValue: 100,
  kingValue: 350, // Higher than Lasca because flying kings in Bashni
  friendlyRiderBonus: 40,
  enemyRiderPenalty: -10,
  advancementBonus: 4,
});

export function getStackingWeights(gameId: ClassifiedGameId): StackingEvalWeights {
  if (gameId === ('lasca' as ClassifiedGameId)) return LASCA_WEIGHTS;
  if (gameId === ('bashni' as ClassifiedGameId)) return BASHNI_WEIGHTS;
  throw new Error(`getStackingWeights: unknown gameId "${gameId}"`);
}

export function listStackingWeightGameIds(): readonly ClassifiedGameId[] {
  return Object.freeze(['lasca', 'bashni'] as unknown as readonly ClassifiedGameId[]);
}
