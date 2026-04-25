/**
 * DraughtsConfig — shape, immutability, singleton caching, helper-narrowing,
 * no-gameId-branching invariant, and validator negative-case coverage.
 */

import { describe, expect, it } from 'vitest';
import {
  TIER_1_DRAUGHTS_GAME_IDS,
  boardSizeOf,
  createArmenianDraughtsConfig,
  createBrazilianDraughtsConfig,
  createCanadianDraughtsConfig,
  createDraughtsConfig,
  createFrisianDraughtsConfig,
  createFryskConfig,
  createInternationalCheckersConfig,
  createItalianDraughtsConfig,
  createMalaysianCheckersConfig,
  createRussianDraughtsConfig,
  createTurkishDraughtsConfig,
  hasDualAxisCapture,
  hasOrthogonalMenCapture,
  usesDarkSquaresOnly,
  validateDraughtsConfig,
  DraughtsConfigInvariantError,
  type DraughtsConfig,
  type DraughtsGameId,
} from './DraughtsConfig';

const FACTORIES: Record<DraughtsGameId, () => DraughtsConfig> = {
  'russian-draughts': createRussianDraughtsConfig,
  'brazilian-draughts': createBrazilianDraughtsConfig,
  'italian-draughts': createItalianDraughtsConfig,
  'international-checkers': createInternationalCheckersConfig,
  frysk: createFryskConfig,
  'frisian-draughts': createFrisianDraughtsConfig,
  'malaysian-checkers': createMalaysianCheckersConfig,
  'canadian-draughts': createCanadianDraughtsConfig,
  'armenian-draughts': createArmenianDraughtsConfig,
  'turkish-draughts': createTurkishDraughtsConfig,
};

describe('DraughtsConfig — factory + identity (T-28.1-01..04)', () => {
  it('every TIER_1 game ID has a factory whose config.gameId matches', () => {
    for (const id of TIER_1_DRAUGHTS_GAME_IDS) {
      const build = FACTORIES[id];
      const config = build();
      expect(config.gameId).toBe(id);
    }
  });

  it('factories are referentially stable singletons', () => {
    for (const id of TIER_1_DRAUGHTS_GAME_IDS) {
      const build = FACTORIES[id];
      expect(build()).toBe(build());
    }
  });

  it('createDraughtsConfig(id) === per-game factory instance', () => {
    for (const id of TIER_1_DRAUGHTS_GAME_IDS) {
      expect(createDraughtsConfig(id)).toBe(FACTORIES[id]());
    }
  });

  it('every config (and its array fields) are frozen', () => {
    for (const id of TIER_1_DRAUGHTS_GAME_IDS) {
      const c = FACTORIES[id]();
      expect(Object.isFrozen(c)).toBe(true);
      expect(Object.isFrozen(c.menMoveDirections)).toBe(true);
      expect(Object.isFrozen(c.kingMoveDirections)).toBe(true);
      expect(Object.isFrozen(c.menCaptureDirections)).toBe(true);
      expect(Object.isFrozen(c.kingCaptureDirections)).toBe(true);
      expect(Object.isFrozen(c.capturePriorityRules)).toBe(true);
    }
  });
});

describe('DraughtsConfig — narrowing helpers (T-28.1-05)', () => {
  const cases: Array<{
    id: DraughtsGameId;
    size: 8 | 10 | 12;
    darkOnly: boolean;
    dualAxis: boolean;
    orthoMen: boolean;
  }> = [
    { id: 'russian-draughts', size: 8, darkOnly: true, dualAxis: false, orthoMen: false },
    { id: 'brazilian-draughts', size: 8, darkOnly: true, dualAxis: false, orthoMen: false },
    { id: 'italian-draughts', size: 8, darkOnly: true, dualAxis: false, orthoMen: false },
    { id: 'international-checkers', size: 10, darkOnly: true, dualAxis: false, orthoMen: false },
    { id: 'frysk', size: 10, darkOnly: true, dualAxis: true, orthoMen: true },
    { id: 'frisian-draughts', size: 10, darkOnly: true, dualAxis: true, orthoMen: true },
    { id: 'malaysian-checkers', size: 12, darkOnly: true, dualAxis: false, orthoMen: false },
    { id: 'canadian-draughts', size: 12, darkOnly: true, dualAxis: false, orthoMen: false },
    { id: 'armenian-draughts', size: 8, darkOnly: false, dualAxis: false, orthoMen: true },
    { id: 'turkish-draughts', size: 8, darkOnly: false, dualAxis: false, orthoMen: true },
  ];

  it.each(cases)('$id: size=$size darkOnly=$darkOnly dualAxis=$dualAxis orthoMen=$orthoMen', (c) => {
    const config = FACTORIES[c.id]();
    expect(boardSizeOf(config)).toBe(c.size);
    expect(usesDarkSquaresOnly(config)).toBe(c.darkOnly);
    expect(hasDualAxisCapture(config)).toBe(c.dualAxis);
    expect(hasOrthogonalMenCapture(config)).toBe(c.orthoMen);
  });
});

describe('DraughtsConfig — no-gameId-branching invariant (T-28.1-20)', () => {
  it('every pair of Tier 1 configs differs on at least one non-gameId field', () => {
    const configs = TIER_1_DRAUGHTS_GAME_IDS.map((id) => FACTORIES[id]());
    for (let i = 0; i < configs.length; i += 1) {
      for (let j = i + 1; j < configs.length; j += 1) {
        const a = configs[i];
        const b = configs[j];
        if (!a || !b) continue;
        expect(distinguishableIgnoringId(a, b), `${a.gameId} vs ${b.gameId}`).toBe(true);
      }
    }
  });
});

function distinguishableIgnoringId(a: DraughtsConfig, b: DraughtsConfig): boolean {
  const keys: Array<keyof DraughtsConfig> = [
    'displayName',
    'boardGeometry',
    'piecesPerSide',
    'startingLayout',
    'menMoveDirections',
    'kingType',
    'kingMoveDirections',
    'menCaptureDirections',
    'kingCaptureDirections',
    'capturedPieceRemovalTiming',
    'menCanCaptureKings',
    'kingOrthogonalCaptureIsLimited',
    'captureObligatory',
    'maximumCaptureMandatory',
    'capturePriorityRules',
    'promotionBehavior',
    'huffingMechanism',
    'kingConsecutiveMoveLimit',
  ];
  for (const k of keys) {
    if (!fieldEquals(a[k], b[k])) return true;
  }
  return false;
}

function fieldEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  return false;
}

describe('DraughtsConfig — validator negative cases (T-28.1-40)', () => {
  const base = (): DraughtsConfig => ({ ...createRussianDraughtsConfig() });

  it('rejects piecesPerSide mismatched with startingLayout', () => {
    const c: DraughtsConfig = { ...base(), piecesPerSide: 99 };
    expect(() => { validateDraughtsConfig(c); }).toThrow(DraughtsConfigInvariantError);
  });

  it('rejects empty kingMoveDirections', () => {
    const c: DraughtsConfig = { ...base(), kingMoveDirections: [] };
    expect(() => { validateDraughtsConfig(c); }).toThrow(DraughtsConfigInvariantError);
  });

  // Task 28.2.1 removed the "flying king covers menMoveDirections"
  // invariant because Armenian Draughts has kings-orthogonal-only while
  // men move diagonally too. No test here; the removal is exercised by
  // the Armenian factory's successful construction.

  it("rejects 'kings-weight-1-5' without preceding 'most-pieces'", () => {
    const c: DraughtsConfig = {
      ...base(),
      capturePriorityRules: ['kings-weight-1-5'],
    };
    expect(() => { validateDraughtsConfig(c); }).toThrow(DraughtsConfigInvariantError);
  });

  it('rejects kingConsecutiveMoveLimit on short kings', () => {
    const c: DraughtsConfig = {
      ...base(),
      kingType: 'short',
      kingMoveDirections: ['nw', 'ne', 'sw', 'se'],
      kingConsecutiveMoveLimit: 3,
    };
    expect(() => { validateDraughtsConfig(c); }).toThrow(DraughtsConfigInvariantError);
  });

  it('rejects menCanCaptureKings=false without captureObligatory', () => {
    const c: DraughtsConfig = {
      ...base(),
      menCanCaptureKings: false,
      captureObligatory: false,
    };
    expect(() => { validateDraughtsConfig(c); }).toThrow(DraughtsConfigInvariantError);
  });

  it('rejects a huffing mechanism combined with captureObligatory', () => {
    const c: DraughtsConfig = {
      ...base(),
      huffingMechanism: 'self-piece-forfeit',
      captureObligatory: true,
    };
    expect(() => { validateDraughtsConfig(c); }).toThrow(DraughtsConfigInvariantError);
  });
});

describe('DraughtsConfig — Italian idiosyncrasies', () => {
  it('Italian: men cannot capture kings, short kings, full priority list', () => {
    const c = createItalianDraughtsConfig();
    expect(c.menCanCaptureKings).toBe(false);
    expect(c.kingType).toBe('short');
    expect(c.capturePriorityRules).toEqual([
      'most-pieces',
      'most-kings-captured',
      'capturing-with-king',
      'first-king-earliest',
    ]);
  });
});

describe('DraughtsConfig — Frisian/Frysk! dual-axis', () => {
  it('both games track kings-weight-1-5 + capturing-with-king and a 3-move consecutive limit', () => {
    for (const c of [createFrisianDraughtsConfig(), createFryskConfig()]) {
      // Task 28.2.2 added 'capturing-with-king' as a tertiary tiebreaker
      // (mindsports/lidraughts: "If a king and a man can capture an
      // equal value, then the king must capture and the man may not.").
      expect(c.capturePriorityRules).toEqual([
        'most-pieces',
        'kings-weight-1-5',
        'capturing-with-king',
      ]);
      expect(c.kingConsecutiveMoveLimit).toBe(3);
      // Task 28.2.1: Frisian kings fly on all six lines with no
      // range-limited landing — the `kingOrthogonalCaptureIsLimited`
      // flag is false post-correction.
      expect(c.kingOrthogonalCaptureIsLimited).toBe(false);
      // Task 28.2.2 (frisiandraughts.com Article 9): kings move
      // diagonally only on non-capture moves, but capture in 8 directions.
      expect(c.kingMoveDirections).toEqual(['nw', 'ne', 'sw', 'se']);
      expect(c.kingCaptureDirections.length).toBe(8);
    }
  });
});

describe('DraughtsConfig — Malaysian huffing', () => {
  it("huffingMechanism: 'self-piece-forfeit' with captureObligatory: false", () => {
    const c = createMalaysianCheckersConfig();
    expect(c.huffingMechanism).toBe('self-piece-forfeit');
    expect(c.captureObligatory).toBe(false);
  });
});

describe('DraughtsConfig — Turkish/Armenian orthogonal movement', () => {
  it('Turkish men move orthogonally (n/e/w) only; kings add s', () => {
    const c = createTurkishDraughtsConfig();
    expect(c.menMoveDirections).toEqual(['n', 'e', 'w']);
    expect(c.kingMoveDirections).toEqual(['n', 's', 'e', 'w']);
  });

  it('Armenian: Tama-family men + orthogonal-only kings (Task 28.2.1)', () => {
    const c = createArmenianDraughtsConfig();
    expect(c.menMoveDirections).toEqual(['n', 'ne', 'nw', 'e', 'w']);
    expect(c.menCaptureDirections).toEqual(['n', 'e', 'w']);
    expect(c.kingMoveDirections).toEqual(['n', 'e', 's', 'w']);
    expect(c.kingCaptureDirections).toEqual(['n', 'e', 's', 'w']);
    expect(c.capturedPieceRemovalTiming).toBe('immediate');
    expect(c.promotionBehavior).toBe('mid-capture');
  });
});
