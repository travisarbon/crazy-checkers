import { describe, expect, it } from 'vitest';
import {
  getTier2NotationAdapter,
  createDameoNotationAdapter,
  createHarzdameNotationAdapter,
  createLascaStackingNotationAdapter,
  createBashniStackingNotationAdapter,
  createZammaNotationAdapter,
  createMakYekNotationAdapter,
  createHasamiShogiNotationAdapter,
  createRekNotationAdapter,
  createDaiHasamiShogiNotationAdapter,
  createCheskersNotationAdapter,
} from '../index';
import { TIER_2_GAME_IDS } from '../../../../engine/classified/tier2/ids';
import { createDameoRuleSet } from '../../../../engine/classified/linear/LinearMovementEngine';
import { createCheskersRuleSet } from '../../../../engine/classified/cheskers/CheskersRules';

describe('getTier2NotationAdapter', () => {
  const dameoGeom = createDameoRuleSet().boardGeometry;
  const cheskersGeom = createCheskersRuleSet().boardGeometry;

  for (const gameId of TIER_2_GAME_IDS) {
    it(`${gameId}: returns an adapter`, async () => {
      const idStr = gameId as unknown as string;
      let geom = dameoGeom;
      if (idStr === 'hasami-shogi' || idStr === 'dai-hasami-shogi' || idStr === 'zamma') {
        const mod = await import('../../../../engine/classified/alquerque/ZammaRules');
        geom = mod.createZammaRuleSet().boardGeometry;
      } else if (idStr === 'cheskers') {
        geom = cheskersGeom;
      }
      expect(() => getTier2NotationAdapter(gameId, geom)).not.toThrow();
    });
  }

  it('throws on unknown gameId', () => {
    expect(() => getTier2NotationAdapter('unknown' as never, dameoGeom)).toThrow();
  });

  it('all per-game factory functions are exported', () => {
    expect(typeof createDameoNotationAdapter).toBe('function');
    expect(typeof createHarzdameNotationAdapter).toBe('function');
    expect(typeof createLascaStackingNotationAdapter).toBe('function');
    expect(typeof createBashniStackingNotationAdapter).toBe('function');
    expect(typeof createZammaNotationAdapter).toBe('function');
    expect(typeof createMakYekNotationAdapter).toBe('function');
    expect(typeof createHasamiShogiNotationAdapter).toBe('function');
    expect(typeof createRekNotationAdapter).toBe('function');
    expect(typeof createDaiHasamiShogiNotationAdapter).toBe('function');
    expect(typeof createCheskersNotationAdapter).toBe('function');
  });
});

describe('Adapter keys are unique per family', () => {
  const dameoGeom = createDameoRuleSet().boardGeometry;
  const cheskersGeom = createCheskersRuleSet().boardGeometry;
  it('all adapter keys are distinct strings', () => {
    const adapters = [
      createDameoNotationAdapter(dameoGeom),
      createHarzdameNotationAdapter(dameoGeom),
      createLascaStackingNotationAdapter(dameoGeom),
      createBashniStackingNotationAdapter(dameoGeom),
      createZammaNotationAdapter(dameoGeom),
      createMakYekNotationAdapter(dameoGeom),
      createHasamiShogiNotationAdapter(dameoGeom),
      createRekNotationAdapter(dameoGeom),
      createDaiHasamiShogiNotationAdapter(dameoGeom),
      createCheskersNotationAdapter(cheskersGeom),
    ];
    const keys = new Set(adapters.map((a) => a.adapterKey));
    expect(keys.size).toBe(adapters.length);
  });
});
