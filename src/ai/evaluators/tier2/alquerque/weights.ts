/**
 * Alquerque-engine evaluator weights (Task 29.7) — Zamma.
 *
 * Per playbook §6.2 row "Zamma": "Material + promotion proximity + Mullah
 * value + connectivity on alquerque graph." Mullah is the king. Per-game
 * subtask 29.G.5-A refines via self-play.
 */

export interface AlquerqueEvalWeights {
  readonly manValue: number;
  /** "Mullah" — the king. */
  readonly kingValue: number;
  readonly advancementBonus: number;
  /** Bonus per legal move available to the side (mobility proxy for connectivity). */
  readonly mobilityBonus: number;
}

export const ZAMMA_WEIGHTS: AlquerqueEvalWeights = Object.freeze({
  manValue: 100,
  kingValue: 400, // Mullahs are extra mobile on the alquerque graph.
  advancementBonus: 5,
  mobilityBonus: 1,
});
