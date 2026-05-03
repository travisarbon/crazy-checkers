/**
 * Tier 2 evaluator + AI dispatch (Task 29.7).
 *
 * Single entry point `getTier2Evaluator(gameId)` that returns the
 * `EvaluateClassifiedPosition` function + the rule-set + the difficulty
 * presets for any of the 10 Tier 2 games. Used by the worker boundary
 * and by the self-play harness.
 *
 * Per the plan §7 Option B, this dispatch is rule-set-agnostic — it
 * returns a uniform `Tier2Dispatch` envelope so callers can run
 * `tier2IterativeSearch` without engine-specific knowledge.
 */

import type {
  ClassifiedGameId,
  ClassifiedRuleSet,
} from '../../../engine/classified/ClassifiedRuleSet';

// Engine rule-set factories
import { createLascaRuleSet, createBashniRuleSet } from '../../../engine/classified/stacking/StackingDraughtsRules';
import { createDameoRuleSet } from '../../../engine/classified/linear/LinearMovementEngine';
import { createZammaRuleSet } from '../../../engine/classified/alquerque/ZammaRules';
import { createMakYekRuleSet } from '../../../engine/classified/custodian/makYek';
import { createHasamiShogiRuleSet } from '../../../engine/classified/custodian/hasamiShogi';
import { createRekRuleSet } from '../../../engine/classified/custodian/rek';
import { createDaiHasamiShogiRuleSet } from '../../../engine/classified/custodian/daiHasamiShogi';
import { createHarzdameRuleSet } from '../../../engine/classified/harzdame/HarzdameRules';
import { createCheskersRuleSet } from '../../../engine/classified/cheskers/CheskersRules';
import { createHarzdameConfig } from '../../../engine/classified/harzdame/types';

// Per-engine evaluators + weights
import { makeStackingEvaluator } from './stacking/StackingEvaluator';
import { LASCA_WEIGHTS, BASHNI_WEIGHTS } from './stacking/weights';
import { makeDameoEvaluator } from './linear/DameoEvaluator';
import { DAMEO_WEIGHTS } from './linear/weights';
import { makeZammaEvaluator } from './alquerque/ZammaEvaluator';
import { ZAMMA_WEIGHTS } from './alquerque/weights';
import { makeCustodianEvaluator } from './custodian/CustodianEvaluator';
import {
  MAK_YEK_WEIGHTS,
  HASAMI_SHOGI_WEIGHTS,
  REK_WEIGHTS,
  DAI_HASAMI_SHOGI_WEIGHTS,
} from './custodian/weights';
import { makeHarzdameEvaluator } from './harzdame/HarzdameEvaluator';
import { HARZDAME_WEIGHTS } from './harzdame/weights';
import { makeCheskersEvaluator } from './cheskers/CheskersEvaluator';
import { CHESKERS_WEIGHTS } from './cheskers/weights';

import type { EvaluateClassifiedPosition } from './common/types';
export { tier2IterativeSearch } from './common/tier2Search';
export {
  getTier2DifficultyConfig,
  TIER_2_DEPTH_PRESETS,
  listTier2DifficultyGameIds,
} from './common/difficultyPresets';
export type { Tier2DifficultyConfig, Tier2SearchResult, Tier2Side, EvaluateClassifiedPosition } from './common/types';

export interface Tier2Dispatch {
  readonly gameId: ClassifiedGameId;
  readonly ruleSet: ClassifiedRuleSet;
  readonly evaluate: EvaluateClassifiedPosition;
}

/**
 * Returns the evaluator + rule-set for a Tier 2 game. Each call constructs
 * a fresh rule-set from its factory; rule-set instances are not shared
 * across calls so worker reconstruction stays stateless.
 */
export function getTier2Dispatch(gameId: ClassifiedGameId): Tier2Dispatch {
  const id = gameId as unknown as string;
  switch (id) {
    case 'dameo': {
      const ruleSet = createDameoRuleSet() as unknown as ClassifiedRuleSet;
      return {
        gameId,
        ruleSet,
        evaluate: makeDameoEvaluator(DAMEO_WEIGHTS, 8),
      };
    }
    case 'harzdame': {
      const cfg = createHarzdameConfig();
      const ruleSet = createHarzdameRuleSet() as unknown as ClassifiedRuleSet;
      const promotionAreaWhite = new Set<number>();
      for (const node of cfg.promotionArea.white) {
        promotionAreaWhite.add(node as unknown as number);
      }
      const promotionAreaBlack = new Set<number>();
      for (const node of cfg.promotionArea.black) {
        promotionAreaBlack.add(node as unknown as number);
      }
      return {
        gameId,
        ruleSet,
        evaluate: makeHarzdameEvaluator(HARZDAME_WEIGHTS, promotionAreaWhite, promotionAreaBlack),
      };
    }
    case 'lasca': {
      const ruleSet = createLascaRuleSet() as unknown as ClassifiedRuleSet;
      return {
        gameId,
        ruleSet,
        evaluate: makeStackingEvaluator(LASCA_WEIGHTS, 7),
      };
    }
    case 'bashni': {
      const ruleSet = createBashniRuleSet() as unknown as ClassifiedRuleSet;
      return {
        gameId,
        ruleSet,
        evaluate: makeStackingEvaluator(BASHNI_WEIGHTS, 8),
      };
    }
    case 'zamma': {
      const ruleSet = createZammaRuleSet() as unknown as ClassifiedRuleSet;
      return {
        gameId,
        ruleSet,
        evaluate: makeZammaEvaluator(ZAMMA_WEIGHTS, ruleSet, 9),
      };
    }
    case 'mak-yek': {
      const ruleSet = createMakYekRuleSet() as unknown as ClassifiedRuleSet;
      return {
        gameId,
        ruleSet,
        evaluate: makeCustodianEvaluator(MAK_YEK_WEIGHTS, ruleSet, 8),
      };
    }
    case 'hasami-shogi': {
      const ruleSet = createHasamiShogiRuleSet() as unknown as ClassifiedRuleSet;
      return {
        gameId,
        ruleSet,
        evaluate: makeCustodianEvaluator(HASAMI_SHOGI_WEIGHTS, ruleSet, 9),
      };
    }
    case 'rek': {
      const ruleSet = createRekRuleSet() as unknown as ClassifiedRuleSet;
      return {
        gameId,
        ruleSet,
        evaluate: makeCustodianEvaluator(REK_WEIGHTS, ruleSet, 8),
      };
    }
    case 'dai-hasami-shogi': {
      const ruleSet = createDaiHasamiShogiRuleSet() as unknown as ClassifiedRuleSet;
      return {
        gameId,
        ruleSet,
        evaluate: makeCustodianEvaluator(DAI_HASAMI_SHOGI_WEIGHTS, ruleSet, 9),
      };
    }
    case 'cheskers': {
      const ruleSet = createCheskersRuleSet() as unknown as ClassifiedRuleSet;
      return {
        gameId,
        ruleSet,
        evaluate: makeCheskersEvaluator(CHESKERS_WEIGHTS, ruleSet),
      };
    }
    default:
      throw new Error(`getTier2Dispatch: unknown Tier 2 gameId "${id}"`);
  }
}
