import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, getClassifiedGame, getClassifiedGames } from '../../registry';
import { TIER_2_GAME_IDS } from '../ids';
import { registerDameo } from '../dameo';
import { registerHarzdame } from '../harzdame';
import { registerLasca } from '../lasca';
import { registerBashni } from '../bashni';
import { registerZamma } from '../zamma';
import { registerMakYek } from '../makYek';
import { registerHasamiShogi } from '../hasamiShogi';
import { registerRek } from '../rek';
import { registerDaiHasamiShogi } from '../daiHasamiShogi';
import { registerCheskers } from '../cheskers';

const REGISTERS = [
  { fn: registerDameo, name: 'dameo', n: 11, wave: 1, family: 'Draughts' },
  { fn: registerHarzdame, name: 'harzdame', n: 12, wave: 1, family: 'Draughts' },
  { fn: registerLasca, name: 'lasca', n: 13, wave: 1, family: 'Stacking Draughts' },
  { fn: registerBashni, name: 'bashni', n: 14, wave: 1, family: 'Stacking Draughts' },
  { fn: registerZamma, name: 'zamma', n: 15, wave: 2, family: 'Capture Game' },
  { fn: registerMakYek, name: 'mak-yek', n: 23, wave: 2, family: 'Capture Game' },
  { fn: registerHasamiShogi, name: 'hasami-shogi', n: 24, wave: 2, family: 'Capture Game' },
  { fn: registerRek, name: 'rek', n: 25, wave: 2, family: 'Capture Game' },
  { fn: registerDaiHasamiShogi, name: 'dai-hasami-shogi', n: 33, wave: 3, family: 'Connection Game' },
  { fn: registerCheskers, name: 'cheskers', n: 49, wave: 6, family: 'Abstract Strategy' },
] as const;

describe('Tier 2 per-game registration', () => {
  beforeEach(() => {
    _clearClassifiedRegistry();
  });
  afterEach(() => {
    _clearClassifiedRegistry();
  });

  for (const r of REGISTERS) {
    describe(`register${r.name}`, () => {
      it(`registers without throwing`, () => {
        expect(() => r.fn({ replace: true })).not.toThrow();
      });

      it(`returns spec with classifiedNumber=${String(r.n)}, wave=${String(r.wave)}, family=${r.family}`, () => {
        const entry = r.fn({ replace: true });
        expect(entry.classifiedNumber).toBe(r.n);
        expect(entry.wave).toBe(r.wave);
        expect(entry.tier).toBe(2);
        expect(entry.family).toBe(r.family);
      });

      it(`exposes a ruleSet with boardGeometry, pieceVocabulary, serializer`, () => {
        const entry = r.fn({ replace: true });
        expect(entry.ruleSet.boardGeometry).toBeDefined();
        expect(entry.ruleSet.pieceVocabulary).toBeDefined();
        expect(entry.ruleSet.serializer).toBeDefined();
      });

      it(`narrative flavor is non-empty`, () => {
        const entry = r.fn({ replace: true });
        expect(entry.narrativeFlavor.wave.length).toBeGreaterThan(0);
        expect(entry.narrativeFlavor.family.length).toBeGreaterThan(0);
        expect(entry.narrativeFlavor.connection.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('Tier 2 registry invariants', () => {
  beforeEach(() => {
    _clearClassifiedRegistry();
    for (const r of REGISTERS) r.fn({ replace: true });
  });
  afterEach(() => {
    _clearClassifiedRegistry();
  });

  it('all 10 gameIds are registered and unique', () => {
    const games = getClassifiedGames();
    const tier2 = games.filter((g) => g.tier === 2);
    expect(tier2).toHaveLength(10);
    const ids = new Set(tier2.map((g) => g.gameId));
    expect(ids.size).toBe(10);
  });

  it('all 10 gameIds match TIER_2_GAME_IDS', () => {
    for (const id of TIER_2_GAME_IDS) {
      expect(getClassifiedGame(id)).not.toBeNull();
    }
  });

  it('all 10 classifiedNumbers are unique', () => {
    const games = getClassifiedGames();
    const tier2 = games.filter((g) => g.tier === 2);
    const numbers = new Set(tier2.map((g) => g.classifiedNumber));
    expect(numbers.size).toBe(10);
  });

  it('all 10 codeUnlockKeys are unique', () => {
    const games = getClassifiedGames();
    const tier2 = games.filter((g) => g.tier === 2);
    const codes = new Set(tier2.map((g) => g.codeUnlockKey));
    expect(codes.size).toBe(10);
  });

  it('all codeUnlockKeys match CLASSIFIED{NN} pattern', () => {
    const games = getClassifiedGames();
    const tier2 = games.filter((g) => g.tier === 2);
    for (const g of tier2) {
      expect(g.codeUnlockKey).toMatch(/^CLASSIFIED\d{2}$/);
    }
  });
});
