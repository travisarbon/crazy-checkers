/**
 * Custodian-engine evaluator weights (Task 29.7) — Mak-yek, Hasami Shogi,
 * Rek, Dai Hasami Shogi.
 *
 * Per playbook §6.2:
 *  - Mak-yek: "Material + mobility + board control + sandwich threat assessment."
 *  - Hasami Shogi: "Material + opponent piece isolation + corner vulnerability detection."
 *  - Rek: "King safety (paramount) + material + immobilization threat + opponent King exposure."
 *  - Dai Hasami Shogi: "Material + 5-in-a-row proximity + opponent material + spatial arrangement quality."
 *
 * Per-game subtasks 29.G.6-A through 29.G.9-A refine via 500-game self-play.
 */

import type { ClassifiedGameId } from '../../../../engine/classified/ClassifiedRuleSet';

export interface CustodianEvalWeights {
  readonly manValue: number;
  /** Used by Rek only; other custodian games don't have kings (manValue used instead). */
  readonly kingValue: number;
  readonly mobilityBonus: number;
  /** Penalty per friendly piece adjacent to an enemy on opposite cardinal sides (sandwich risk). */
  readonly sandwichRiskPenalty: number;
  /** Bonus per pair of friendly pieces aligned 2-apart (5-in-a-row hint, Dai Hasami Shogi only). */
  readonly lineFormationBonus: number;
  /** King-safety multiplier (Rek only; the King is paramount). */
  readonly kingSafetyMultiplier: number;
}

export const MAK_YEK_WEIGHTS: CustodianEvalWeights = Object.freeze({
  manValue: 100,
  kingValue: 100,
  mobilityBonus: 2,
  sandwichRiskPenalty: -8,
  lineFormationBonus: 0,
  kingSafetyMultiplier: 1,
});

export const HASAMI_SHOGI_WEIGHTS: CustodianEvalWeights = Object.freeze({
  manValue: 100,
  kingValue: 100,
  mobilityBonus: 1,
  sandwichRiskPenalty: -10,
  lineFormationBonus: 0,
  kingSafetyMultiplier: 1,
});

export const REK_WEIGHTS: CustodianEvalWeights = Object.freeze({
  manValue: 100,
  kingValue: 1500, // King capture = instant win
  mobilityBonus: 2,
  sandwichRiskPenalty: -10,
  lineFormationBonus: 0,
  kingSafetyMultiplier: 1.5,
});

export const DAI_HASAMI_SHOGI_WEIGHTS: CustodianEvalWeights = Object.freeze({
  manValue: 100,
  kingValue: 100,
  mobilityBonus: 1,
  sandwichRiskPenalty: -8,
  lineFormationBonus: 6,
  kingSafetyMultiplier: 1,
});

export function getCustodianWeights(gameId: ClassifiedGameId): CustodianEvalWeights {
  const id = gameId as unknown as string;
  if (id === 'mak-yek') return MAK_YEK_WEIGHTS;
  if (id === 'hasami-shogi') return HASAMI_SHOGI_WEIGHTS;
  if (id === 'rek') return REK_WEIGHTS;
  if (id === 'dai-hasami-shogi') return DAI_HASAMI_SHOGI_WEIGHTS;
  throw new Error(`getCustodianWeights: unknown gameId "${gameId}"`);
}

export function listCustodianWeightGameIds(): readonly ClassifiedGameId[] {
  return Object.freeze(
    ['mak-yek', 'hasami-shogi', 'rek', 'dai-hasami-shogi'] as unknown as readonly ClassifiedGameId[],
  );
}
