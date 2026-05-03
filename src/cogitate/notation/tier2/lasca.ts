/**
 * Lasca notation adapter — Tier 2 (Task 29.8).
 *
 * Re-exports the shared `createLascaStackingNotationAdapter` factory from
 * `stackingPdn.ts`. Lasca + Bashni share the T2-S3 stack-aware PDN format;
 * the only difference between them is the board geometry passed in.
 */

export { createLascaStackingNotationAdapter } from './stackingPdn';
