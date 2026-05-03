/**
 * Hasami Shogi rule-set convenience factory (Phase 4 Task 29.4).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import type { ClassifiedGameState } from '../state';
import { createCustodianRuleSet } from './CustodianCaptureEngine';
import { createHasamiShogiConfig } from './hasamiShogiConfig';
import type { CustodianMove } from './types';

export function createHasamiShogiRuleSet(): ClassifiedRuleSet<ClassifiedGameState, CustodianMove> {
  return createCustodianRuleSet(createHasamiShogiConfig());
}
