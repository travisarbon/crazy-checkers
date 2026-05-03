/**
 * Zamma rule-set convenience factory (Phase 4 Task 29.3).
 *
 * Thin wrapper over `createAlquerqueRuleSet(createZammaConfig())`. Mirrors
 * the per-game files in `src/engine/classified/tier1/` and the
 * `createDameoRuleSet()` shape from Task 29.2.
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import type { ClassifiedGameState } from '../state';
import { createAlquerqueRuleSet } from './AlquerqueEngine';
import { createZammaConfig, type AlquerqueMove } from './types';

export function createZammaRuleSet(): ClassifiedRuleSet<ClassifiedGameState, AlquerqueMove> {
  return createAlquerqueRuleSet(createZammaConfig());
}
