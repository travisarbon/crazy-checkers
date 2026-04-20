/**
 * Per-variant evaluation weight tables for Tier 1 Classified draughts games
 * (Task 28.5).
 *
 * One `DraughtsEvalWeights` table per variant. The `DraughtsEvaluator` is
 * parameterised solely by these weights — no `gameId` branching in evaluation
 * logic. All variation flows through the weight values.
 *
 * Weight derivation follows Phase 1 baseline (src/ai/evaluator.ts) adjusted
 * per-variant for board size, king type, and special rules. See
 * CALIBRATION_NOTES.md for per-variant calibration history.
 */

import type { DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';

// ---------------------------------------------------------------------------
// Weight interface
// ---------------------------------------------------------------------------

/**
 * Complete evaluation weight set for a single draughts variant.
 *
 * Every factor the DraughtsEvaluator computes is controlled by one or more
 * fields here. A zero value causes the evaluator to short-circuit that
 * factor (no computation overhead).
 */
export interface DraughtsEvalWeights {
  // --- Material ---
  readonly pawnValue: number;
  readonly kingValue: number;

  // --- Advancement ---
  /** Points per row of pawn advancement toward the promotion row. */
  readonly advancementPerRow: number;
  /**
   * Board-size normaliser for advancement. Divides the raw row index so
   * that 8×8, 10×10, and 12×12 boards produce comparable advancement
   * scores. Set to the board size (8, 10, or 12).
   */
  readonly advancementBoardSizeNormaliser: number;

  // --- Positional ---
  readonly centerBonus: number;
  readonly edgePenalty: number;
  readonly backRowBonus: number;

  // --- Mobility ---
  readonly mobilityPerMove: number;
  readonly captureMoveBonusPerCapture: number;

  // --- King-specific ---
  readonly trappedKingPenalty: number;
  readonly semiTrappedKingPenalty: number;
  /** Bonus per additional reachable square for flying kings. */
  readonly flyingKingMobilityBonus: number;
  readonly kingSafetyDistanceBonus: number;

  // --- Variant-specific ---
  /** Italian: bonus for each king immune from pawn capture. */
  readonly kingImmuneFromPawnBonus: number;
  /** Malaysian: penalty for pieces vulnerable to huffing. */
  readonly huffingVulnerabilityPenalty: number;
  /** Frysk/Frisian: bonus per dual-axis capture available. */
  readonly dualAxisCaptureBonus: number;
  /** Frysk/Frisian: penalty for kings near the consecutive-move limit. */
  readonly consecutiveMovePenalty: number;

  // --- Endgame ---
  readonly endgamePieceThreshold: number;
  readonly endgameKingValue: number;
  readonly endgameAdvancementPerRow: number;

  // --- Terminal ---
  readonly winScore: number;
  readonly lossScore: number;

  // --- Normalization ---
  /**
   * Sigmoid K parameter for EvaluationProvider score normalisation.
   * Larger K → more spread before saturation. Scaled with board size
   * since larger boards produce higher raw scores.
   */
  readonly sigmoidK: number;
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

function freeze(w: DraughtsEvalWeights): Readonly<DraughtsEvalWeights> {
  return Object.freeze(w);
}

// ---------------------------------------------------------------------------
// 8×8 Diagonal — Russian Draughts
// ---------------------------------------------------------------------------

export const RUSSIAN_DRAUGHTS_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 220,
  advancementPerRow: 6,
  advancementBoardSizeNormaliser: 8,
  centerBonus: 10,
  edgePenalty: 3,
  backRowBonus: 8,
  mobilityPerMove: 3,
  captureMoveBonusPerCapture: 5,
  trappedKingPenalty: 35,
  semiTrappedKingPenalty: 18,
  flyingKingMobilityBonus: 3,
  kingSafetyDistanceBonus: 2,
  kingImmuneFromPawnBonus: 0,
  huffingVulnerabilityPenalty: 0,
  dualAxisCaptureBonus: 0,
  consecutiveMovePenalty: 0,
  endgamePieceThreshold: 8,
  endgameKingValue: 250,
  endgameAdvancementPerRow: 10,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 250,
});

// ---------------------------------------------------------------------------
// 8×8 Diagonal — Brazilian Draughts
// ---------------------------------------------------------------------------

export const BRAZILIAN_DRAUGHTS_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 230,
  advancementPerRow: 6,
  advancementBoardSizeNormaliser: 8,
  centerBonus: 10,
  edgePenalty: 3,
  backRowBonus: 8,
  mobilityPerMove: 3,
  captureMoveBonusPerCapture: 6,
  trappedKingPenalty: 35,
  semiTrappedKingPenalty: 18,
  flyingKingMobilityBonus: 3,
  kingSafetyDistanceBonus: 2,
  kingImmuneFromPawnBonus: 0,
  huffingVulnerabilityPenalty: 0,
  dualAxisCaptureBonus: 0,
  consecutiveMovePenalty: 0,
  endgamePieceThreshold: 8,
  endgameKingValue: 260,
  endgameAdvancementPerRow: 10,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 250,
});

// ---------------------------------------------------------------------------
// 8×8 Diagonal — Italian Draughts (short kings, men can't capture kings)
// ---------------------------------------------------------------------------

export const ITALIAN_DRAUGHTS_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 200,
  advancementPerRow: 5,
  advancementBoardSizeNormaliser: 8,
  centerBonus: 8,
  edgePenalty: 2,
  backRowBonus: 12,
  mobilityPerMove: 2,
  captureMoveBonusPerCapture: 5,
  trappedKingPenalty: 30,
  semiTrappedKingPenalty: 15,
  flyingKingMobilityBonus: 0,
  kingSafetyDistanceBonus: 1,
  kingImmuneFromPawnBonus: 20,
  huffingVulnerabilityPenalty: 0,
  dualAxisCaptureBonus: 0,
  consecutiveMovePenalty: 0,
  endgamePieceThreshold: 8,
  endgameKingValue: 230,
  endgameAdvancementPerRow: 8,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 250,
});

// ---------------------------------------------------------------------------
// 10×10 Diagonal — International Checkers
// ---------------------------------------------------------------------------

export const INTERNATIONAL_CHECKERS_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 250,
  advancementPerRow: 5,
  advancementBoardSizeNormaliser: 10,
  centerBonus: 8,
  edgePenalty: 3,
  backRowBonus: 8,
  mobilityPerMove: 2,
  captureMoveBonusPerCapture: 5,
  trappedKingPenalty: 40,
  semiTrappedKingPenalty: 20,
  flyingKingMobilityBonus: 3,
  kingSafetyDistanceBonus: 2,
  kingImmuneFromPawnBonus: 0,
  huffingVulnerabilityPenalty: 0,
  dualAxisCaptureBonus: 0,
  consecutiveMovePenalty: 0,
  endgamePieceThreshold: 10,
  endgameKingValue: 280,
  endgameAdvancementPerRow: 8,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 350,
});

// ---------------------------------------------------------------------------
// 10×10 Diagonal — Frysk! (5 pieces, dual-axis, 3-move king limit)
// ---------------------------------------------------------------------------

export const FRYSK_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 260,
  advancementPerRow: 7,
  advancementBoardSizeNormaliser: 10,
  centerBonus: 10,
  edgePenalty: 4,
  backRowBonus: 6,
  mobilityPerMove: 4,
  captureMoveBonusPerCapture: 6,
  trappedKingPenalty: 45,
  semiTrappedKingPenalty: 22,
  flyingKingMobilityBonus: 3,
  kingSafetyDistanceBonus: 2,
  kingImmuneFromPawnBonus: 0,
  huffingVulnerabilityPenalty: 0,
  dualAxisCaptureBonus: 8,
  consecutiveMovePenalty: 15,
  endgamePieceThreshold: 4,
  endgameKingValue: 290,
  endgameAdvancementPerRow: 10,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 300,
});

// ---------------------------------------------------------------------------
// 10×10 Diagonal — Frisian Draughts (20 pieces, dual-axis, 3-move limit)
// ---------------------------------------------------------------------------

export const FRISIAN_DRAUGHTS_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 255,
  advancementPerRow: 5,
  advancementBoardSizeNormaliser: 10,
  centerBonus: 8,
  edgePenalty: 3,
  backRowBonus: 8,
  mobilityPerMove: 3,
  captureMoveBonusPerCapture: 6,
  trappedKingPenalty: 40,
  semiTrappedKingPenalty: 20,
  flyingKingMobilityBonus: 3,
  kingSafetyDistanceBonus: 2,
  kingImmuneFromPawnBonus: 0,
  huffingVulnerabilityPenalty: 0,
  dualAxisCaptureBonus: 7,
  consecutiveMovePenalty: 12,
  endgamePieceThreshold: 10,
  endgameKingValue: 285,
  endgameAdvancementPerRow: 8,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 350,
});

// ---------------------------------------------------------------------------
// 12×12 Diagonal — Malaysian Checkers (huffing, forward-only men capture)
// ---------------------------------------------------------------------------

export const MALAYSIAN_CHECKERS_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 180,
  advancementPerRow: 4,
  advancementBoardSizeNormaliser: 12,
  centerBonus: 6,
  edgePenalty: 2,
  backRowBonus: 6,
  mobilityPerMove: 2,
  captureMoveBonusPerCapture: 4,
  trappedKingPenalty: 35,
  semiTrappedKingPenalty: 18,
  flyingKingMobilityBonus: 2,
  kingSafetyDistanceBonus: 1,
  kingImmuneFromPawnBonus: 0,
  huffingVulnerabilityPenalty: 12,
  dualAxisCaptureBonus: 0,
  consecutiveMovePenalty: 0,
  endgamePieceThreshold: 12,
  endgameKingValue: 210,
  endgameAdvancementPerRow: 6,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 450,
});

// ---------------------------------------------------------------------------
// 12×12 Diagonal — Canadian Draughts (flying kings, 30 pieces)
// ---------------------------------------------------------------------------

export const CANADIAN_DRAUGHTS_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 275,
  advancementPerRow: 4,
  advancementBoardSizeNormaliser: 12,
  centerBonus: 6,
  edgePenalty: 2,
  backRowBonus: 6,
  mobilityPerMove: 2,
  captureMoveBonusPerCapture: 4,
  trappedKingPenalty: 40,
  semiTrappedKingPenalty: 20,
  flyingKingMobilityBonus: 3,
  kingSafetyDistanceBonus: 2,
  kingImmuneFromPawnBonus: 0,
  huffingVulnerabilityPenalty: 0,
  dualAxisCaptureBonus: 0,
  consecutiveMovePenalty: 0,
  endgamePieceThreshold: 12,
  endgameKingValue: 300,
  endgameAdvancementPerRow: 6,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 450,
});

// ---------------------------------------------------------------------------
// 8×8 Full-board — Armenian Draughts (orthogonal king, diagonal+orthogonal men)
// ---------------------------------------------------------------------------

export const ARMENIAN_DRAUGHTS_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 240,
  advancementPerRow: 5,
  advancementBoardSizeNormaliser: 8,
  centerBonus: 12,
  edgePenalty: 4,
  backRowBonus: 6,
  mobilityPerMove: 4,
  captureMoveBonusPerCapture: 5,
  trappedKingPenalty: 35,
  semiTrappedKingPenalty: 18,
  flyingKingMobilityBonus: 3,
  kingSafetyDistanceBonus: 2,
  kingImmuneFromPawnBonus: 0,
  huffingVulnerabilityPenalty: 0,
  dualAxisCaptureBonus: 0,
  consecutiveMovePenalty: 0,
  endgamePieceThreshold: 8,
  endgameKingValue: 270,
  endgameAdvancementPerRow: 8,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 300,
});

// ---------------------------------------------------------------------------
// 8×8 Full-board — Turkish Draughts (full-board orthogonal movement)
// ---------------------------------------------------------------------------

export const TURKISH_DRAUGHTS_WEIGHTS: Readonly<DraughtsEvalWeights> = freeze({
  pawnValue: 100,
  kingValue: 245,
  advancementPerRow: 5,
  advancementBoardSizeNormaliser: 8,
  centerBonus: 12,
  edgePenalty: 4,
  backRowBonus: 6,
  mobilityPerMove: 4,
  captureMoveBonusPerCapture: 5,
  trappedKingPenalty: 35,
  semiTrappedKingPenalty: 18,
  flyingKingMobilityBonus: 3,
  kingSafetyDistanceBonus: 2,
  kingImmuneFromPawnBonus: 0,
  huffingVulnerabilityPenalty: 0,
  dualAxisCaptureBonus: 0,
  consecutiveMovePenalty: 0,
  endgamePieceThreshold: 8,
  endgameKingValue: 275,
  endgameAdvancementPerRow: 8,
  winScore: 10_000,
  lossScore: -10_000,
  sigmoidK: 300,
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Frozen registry mapping every Tier 1 gameId to its evaluation weights.
 * Look up via `getDraughtsWeights(gameId)`.
 */
const DRAUGHTS_WEIGHTS_REGISTRY: ReadonlyMap<DraughtsGameId, Readonly<DraughtsEvalWeights>> =
  new Map<DraughtsGameId, Readonly<DraughtsEvalWeights>>([
    ['russian-draughts', RUSSIAN_DRAUGHTS_WEIGHTS],
    ['brazilian-draughts', BRAZILIAN_DRAUGHTS_WEIGHTS],
    ['italian-draughts', ITALIAN_DRAUGHTS_WEIGHTS],
    ['international-checkers', INTERNATIONAL_CHECKERS_WEIGHTS],
    ['frysk', FRYSK_WEIGHTS],
    ['frisian-draughts', FRISIAN_DRAUGHTS_WEIGHTS],
    ['malaysian-checkers', MALAYSIAN_CHECKERS_WEIGHTS],
    ['canadian-draughts', CANADIAN_DRAUGHTS_WEIGHTS],
    ['armenian-draughts', ARMENIAN_DRAUGHTS_WEIGHTS],
    ['turkish-draughts', TURKISH_DRAUGHTS_WEIGHTS],
  ]);

/**
 * Returns the frozen weight table for a Tier 1 draughts variant.
 * @throws if the gameId is not registered.
 */
export function getDraughtsWeights(gameId: DraughtsGameId): Readonly<DraughtsEvalWeights> {
  const weights = DRAUGHTS_WEIGHTS_REGISTRY.get(gameId);
  if (!weights) {
    throw new Error(`No evaluation weights registered for draughts variant: ${gameId}`);
  }
  return weights;
}

/** All registered gameIds (for testing/iteration). */
export function listDraughtsWeightGameIds(): readonly DraughtsGameId[] {
  return [...DRAUGHTS_WEIGHTS_REGISTRY.keys()];
}
