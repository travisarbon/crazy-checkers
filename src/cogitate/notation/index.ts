/**
 * Cogitate notation registry — PDN-family adapters (Task 28.1).
 *
 * Exports the base PDN adapter factory and the three Tier 1 wrappers
 * (`pdn-frisian`, `pdn-8-armenian`, `pdn-8-turkish`) that extend it with
 * per-variant capture annotation. The Tier 1 routing module
 * `src/engine/classified/draughts/configToNotation.ts` consumes these to
 * select the correct adapter for a given `DraughtsConfig`.
 */

export { createPdnNotationAdapter, splitOnCaptureMarks } from './basePdn';
export type { PdnAdapterOptions, PdnNotationAdapter } from './basePdn';
export { createPdnFrisianAdapter } from './draughts/pdn-frisian';
export { createPdnArmenianAdapter } from './draughts/pdn-8-armenian';
export { createPdnTurkishAdapter } from './draughts/pdn-8-turkish';
