/**
 * Tier 2 evaluator weight tables — sanity tests (Task 29.7).
 *
 * Asserts every weight table is non-empty, has positive material values,
 * and that per-engine lookup helpers cover all the games they advertise.
 */

import { describe, expect, it } from 'vitest';
import {
  BASHNI_WEIGHTS,
  LASCA_WEIGHTS,
  getStackingWeights,
  listStackingWeightGameIds,
} from '../stacking/weights';
import { DAMEO_WEIGHTS } from '../linear/weights';
import { ZAMMA_WEIGHTS } from '../alquerque/weights';
import {
  DAI_HASAMI_SHOGI_WEIGHTS,
  HASAMI_SHOGI_WEIGHTS,
  MAK_YEK_WEIGHTS,
  REK_WEIGHTS,
  getCustodianWeights,
  listCustodianWeightGameIds,
} from '../custodian/weights';
import { HARZDAME_WEIGHTS } from '../harzdame/weights';
import { CHESKERS_WEIGHTS } from '../cheskers/weights';

describe('Stacking weights', () => {
  it('LASCA + BASHNI both have positive man + king values', () => {
    expect(LASCA_WEIGHTS.manValue).toBeGreaterThan(0);
    expect(LASCA_WEIGHTS.kingValue).toBeGreaterThan(LASCA_WEIGHTS.manValue);
    expect(BASHNI_WEIGHTS.manValue).toBeGreaterThan(0);
    expect(BASHNI_WEIGHTS.kingValue).toBeGreaterThan(BASHNI_WEIGHTS.manValue);
  });

  it('Bashni king > Lasca king (flying kings in towers)', () => {
    expect(BASHNI_WEIGHTS.kingValue).toBeGreaterThan(LASCA_WEIGHTS.kingValue);
  });

  it('getStackingWeights resolves both games', () => {
    expect(getStackingWeights('lasca' as never)).toBe(LASCA_WEIGHTS);
    expect(getStackingWeights('bashni' as never)).toBe(BASHNI_WEIGHTS);
  });

  it('getStackingWeights throws on unknown', () => {
    expect(() => getStackingWeights('unknown' as never)).toThrow();
  });

  it('listStackingWeightGameIds covers both games', () => {
    expect(listStackingWeightGameIds()).toHaveLength(2);
  });
});

describe('Linear (Dameo) weights', () => {
  it('positive material + advancement', () => {
    expect(DAMEO_WEIGHTS.manValue).toBeGreaterThan(0);
    expect(DAMEO_WEIGHTS.kingValue).toBeGreaterThan(DAMEO_WEIGHTS.manValue);
    expect(DAMEO_WEIGHTS.advancementBonus).toBeGreaterThan(0);
  });
});

describe('Alquerque (Zamma) weights', () => {
  it('positive material with king > man', () => {
    expect(ZAMMA_WEIGHTS.manValue).toBeGreaterThan(0);
    expect(ZAMMA_WEIGHTS.kingValue).toBeGreaterThan(ZAMMA_WEIGHTS.manValue);
  });
});

describe('Custodian weights', () => {
  it('all 4 games have positive man values', () => {
    for (const w of [MAK_YEK_WEIGHTS, HASAMI_SHOGI_WEIGHTS, REK_WEIGHTS, DAI_HASAMI_SHOGI_WEIGHTS]) {
      expect(w.manValue).toBeGreaterThan(0);
    }
  });

  it('Rek king is paramount (much larger than man value)', () => {
    expect(REK_WEIGHTS.kingValue).toBeGreaterThan(REK_WEIGHTS.manValue * 5);
  });

  it('Dai Hasami Shogi has line-formation bonus', () => {
    expect(DAI_HASAMI_SHOGI_WEIGHTS.lineFormationBonus).toBeGreaterThan(0);
  });

  it('getCustodianWeights resolves all 4', () => {
    expect(getCustodianWeights('mak-yek' as never)).toBe(MAK_YEK_WEIGHTS);
    expect(getCustodianWeights('hasami-shogi' as never)).toBe(HASAMI_SHOGI_WEIGHTS);
    expect(getCustodianWeights('rek' as never)).toBe(REK_WEIGHTS);
    expect(getCustodianWeights('dai-hasami-shogi' as never)).toBe(DAI_HASAMI_SHOGI_WEIGHTS);
  });

  it('getCustodianWeights throws on unknown', () => {
    expect(() => getCustodianWeights('unknown' as never)).toThrow();
  });

  it('listCustodianWeightGameIds covers all 4', () => {
    expect(listCustodianWeightGameIds()).toHaveLength(4);
  });
});

describe('Harzdame weights', () => {
  it('senior king is 1.5× regular king per playbook', () => {
    expect(HARZDAME_WEIGHTS.seniorKingValue).toBeCloseTo(
      HARZDAME_WEIGHTS.regularKingValue * 1.5,
      0,
    );
  });
});

describe('Cheskers weights', () => {
  it('King > Camel ≥ Bishop > Pawn (per playbook)', () => {
    expect(CHESKERS_WEIGHTS.kingValue).toBeGreaterThan(CHESKERS_WEIGHTS.camelValue);
    expect(CHESKERS_WEIGHTS.camelValue).toBeGreaterThanOrEqual(CHESKERS_WEIGHTS.bishopValue);
    expect(CHESKERS_WEIGHTS.bishopValue).toBeGreaterThan(CHESKERS_WEIGHTS.pawnValue);
  });
});
