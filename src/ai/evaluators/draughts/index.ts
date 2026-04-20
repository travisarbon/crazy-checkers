/**
 * Tier 1 Classified draughts AI barrel exports (Task 28.5).
 */

export type { DraughtsEvalWeights } from './weights';
export {
  getDraughtsWeights,
  listDraughtsWeightGameIds,
  RUSSIAN_DRAUGHTS_WEIGHTS,
  BRAZILIAN_DRAUGHTS_WEIGHTS,
  ITALIAN_DRAUGHTS_WEIGHTS,
  INTERNATIONAL_CHECKERS_WEIGHTS,
  FRYSK_WEIGHTS,
  FRISIAN_DRAUGHTS_WEIGHTS,
  MALAYSIAN_CHECKERS_WEIGHTS,
  CANADIAN_DRAUGHTS_WEIGHTS,
  ARMENIAN_DRAUGHTS_WEIGHTS,
  TURKISH_DRAUGHTS_WEIGHTS,
} from './weights';

export type { DraughtsGeometryTables } from './geometryHelpers';
export {
  getGeometryTables,
  getPawnAdvancement,
  countKingRayMobility,
  countKingEscapes,
  getKingDirectionDeltas,
} from './geometryHelpers';

export { evaluateDraughtsPosition } from './DraughtsEvaluator';

export { orderDraughtsMoves, draughtsMoveEquals } from './moveOrdering';

export { getDraughtsDifficultyConfig, getResponseTimeCap } from './difficultyPresets';

export type { ClassifiedSearchResult } from './classifiedSearch';
export {
  classifiedIterativeSearch,
  selectClassifiedMove,
} from './classifiedSearch';

export {
  createDraughtsClassifiedEvalProvider,
  normalizeDraughtsScore,
  getDraughtsEvaluationProvider,
} from './DraughtsEvaluationProvider';
