/**
 * Cheskers evaluator weights (Task 29.7).
 *
 * Per playbook §6.2 row "Cheskers": "Material with Cheskers piece values
 * (King most valuable, then Camel/Bishop, then Pawn) + dark-square
 * mobility + dual-capture-regime threats + both-Kings-safety."
 *
 * Initial weights from the playbook hint "Camel ≈ 3.5, Bishop ≈ 3,
 * Pawn ≈ 1, King most valuable." Per-game subtask 29.G.10-A's 500-game
 * self-play tuning revisits.
 *
 * Per Task 29.6 §1.4, the win condition is eliminate-all-kings — so the
 * king is paramount but not infinitely valuable (capturing one of two
 * kings still leaves the side alive).
 */

export interface CheskersEvalWeights {
  readonly pawnValue: number;
  readonly kingValue: number;
  readonly bishopValue: number;
  readonly camelValue: number;
  /** Bonus per legal move available to the side. */
  readonly mobilityBonus: number;
}

export const CHESKERS_WEIGHTS: CheskersEvalWeights = Object.freeze({
  pawnValue: 100,
  kingValue: 500, // Most valuable per playbook (eliminate-all-kings = win)
  bishopValue: 300,
  camelValue: 350,
  mobilityBonus: 1,
});
