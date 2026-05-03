/**
 * Rek rule-set convenience factory (Phase 4 Task 29.4).
 */

import type { ClassifiedRuleSet } from '../ClassifiedRuleSet';
import type { ClassifiedGameState } from '../state';
import { createCustodianRuleSet } from './CustodianCaptureEngine';
import { createRekConfig } from './rekConfig';
import type { CustodianMove } from './types';

export function createRekRuleSet(): ClassifiedRuleSet<ClassifiedGameState, CustodianMove> {
  return createCustodianRuleSet(createRekConfig());
}
