/**
 * Linear-engine evaluator weights (Phase 4 Task 29.G.1-A — Dameo refinement).
 *
 * Per playbook §6.2 row "Dameo": "Material + linear group formation
 * potential + king value + advancement." Task 29.G.1's per-game subtask
 * refines the four axes from playbook §6.2 wording:
 *   - Material baseline (pawn = 100, king = 300; Tier 1 convention)
 *   - Phalanx-formation bonus weighted by depth (size 2..4+)
 *   - Column-head safety penalty per exposed phalanx head
 *   - King-promotion-zone proximity (per row of advancement)
 *   - Back-row defense bonus per back-row pawn
 *   - Capture-chain potential per link (informs quiescence)
 *
 * The 500-game self-play tuning loop (per plan §5.4) iterates on these
 * starting values to clear the C-12 ≥70% Hard-vs-Easy gate. Per plan
 * §5.4 escalation: if the iteration plateaus below 70%, the weight axis
 * most strongly correlated with failure is adjusted.
 */

export interface PhalanxDepthBonus {
  readonly size2: number;
  readonly size3: number;
  /** Cap applies to phalanxes of size 4 or larger (diminishing returns). */
  readonly size4PlusCap: number;
}

export interface LinearEvalWeights {
  readonly manValue: number;
  readonly kingValue: number;
  /** Per row of advancement toward opponent's back rank. */
  readonly advancementBonus: number;
  /**
   * Phalanx bonus weighted by phalanx size. Per plan §5.2:
   *   - size 2 → +5
   *   - size 3 → +12
   *   - size 4+ → +25 (cap)
   */
  readonly phalanxBonus: PhalanxDepthBonus;
  /**
   * Penalty per exposed phalanx head — a phalanx whose head can be
   * captured by an orthogonally-adjacent enemy man.
   */
  readonly columnHeadSafetyPenalty: number;
  /** Bonus per pawn left on the home (back) rank — defense against opponent promotion. */
  readonly backRowDefenseBonus: number;
  /** Per capture-chain link available to the side to move (quiescence hint). */
  readonly captureChainPotentialPerLink: number;
}

/**
 * Dameo evaluator weights — initial baseline from plan §5.2.
 *
 * Per plan §1.1: per-game subtask wording overrides where the playbook
 * permits. The phalanx depth weights ({2: 5, 3: 12, 4+: 25}) match the
 * per-game subtask exactly. The 1-point promotion-proximity weight is
 * deliberately small to reward forward-leaning play without overwhelming
 * material/phalanx considerations.
 */
export const DAMEO_WEIGHTS: LinearEvalWeights = Object.freeze({
  manValue: 100,
  kingValue: 300,
  advancementBonus: 1, // promotionProximityPerRow per plan §5.2
  phalanxBonus: Object.freeze({
    size2: 5,
    size3: 12,
    size4PlusCap: 25,
  }),
  columnHeadSafetyPenalty: -8,
  backRowDefenseBonus: 3,
  captureChainPotentialPerLink: 4,
});
