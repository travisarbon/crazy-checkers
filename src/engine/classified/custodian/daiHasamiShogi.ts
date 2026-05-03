/**
 * Dai Hasami Shogi rule-set convenience factory (Phase 4 Task 29.4).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import type { ClassifiedGameState } from '../state';
import { createCustodianRuleSet } from './CustodianCaptureEngine';
import { createDaiHasamiShogiConfig } from './daiHasamiShogiConfig';
import type { CustodianMove } from './types';

export function createDaiHasamiShogiRuleSet(): ClassifiedRuleSet<ClassifiedGameState, CustodianMove> {
  return createCustodianRuleSet(createDaiHasamiShogiConfig());
}
