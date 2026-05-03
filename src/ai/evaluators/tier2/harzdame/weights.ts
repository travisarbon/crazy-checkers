/**
 * Harzdame evaluator weights (Task 29.7).
 *
 * Per playbook §6.2 row "Harzdame": "Material + king range advantage +
 * advancement (king range limitation changes king value); senior-king
 * bonus 1.5×." Per-game subtask 29.G.2-A refines via 500-game self-play.
 */

export interface HarzdameEvalWeights {
  readonly manValue: number;
  readonly regularKingValue: number;
  /** Senior-king is `1.5 * regularKingValue` per playbook. */
  readonly seniorKingValue: number;
  readonly advancementBonus: number;
  /** Bonus for being inside the 11-square promotion area (men only — they're about to promote). */
  readonly promotionProximityBonus: number;
}

export const HARZDAME_WEIGHTS: HarzdameEvalWeights = Object.freeze({
  manValue: 100,
  regularKingValue: 300,
  seniorKingValue: 450, // 1.5× regular per playbook
  advancementBonus: 5,
  promotionProximityBonus: 25,
});
