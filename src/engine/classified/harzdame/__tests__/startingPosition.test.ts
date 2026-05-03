import { describe, expect, it } from 'vitest';
import {
  HarzdameStartingPositionMismatchError,
  buildStartingState,
} from '../startingPosition';
import {
  HarzdameConfigInvariantError,
  createHarzdameConfig,
  validateHarzdameConfig,
  type HarzdameConfig,
} from '../types';

describe('buildStartingState — Harzdame', () => {
  const config = createHarzdameConfig();
  const state = buildStartingState(config);

  it('places 24 pieces (12 per side)', () => {
    expect(state.pieces.size).toBe(24);
  });

  it('white starts on rows 5..7, black on rows 0..2', () => {
    for (const [nodeId, piece] of state.pieces) {
      const r = Math.floor((nodeId as unknown as number) / 8);
      if (piece.owner === 'white') expect([5, 6, 7]).toContain(r);
      if (piece.owner === 'black') expect([0, 1, 2]).toContain(r);
    }
  });

  it('all pieces start as men with no senior status', () => {
    for (const piece of state.pieces.values()) {
      expect(piece.kind).toBe('man');
      expect(piece.promoted === true).toBe(false);
    }
  });

  it('white moves first', () => {
    expect(state.turn).toBe('white');
    expect(state.plyCount).toBe(0);
    expect(state.moveHistory).toHaveLength(0);
  });

  it('repetition table seeded with starting hash count 1', () => {
    expect(state.meta.repetitionTable).toHaveLength(1);
    expect(state.meta.repetitionTable[0]?.[1]).toBe(1);
  });

  it('seniorKings cache starts empty', () => {
    expect(state.meta.seniorKings).toEqual([]);
  });
});

describe('validateHarzdameConfig — invariants', () => {
  it('rejects a non-square board geometry', () => {
    const z = createHarzdameConfig();
    const bad: HarzdameConfig = {
      ...z,
      boardGeometry: { ...z.boardGeometry, kind: 'ring', dimensions: {} },
    };
    expect(() => {
      validateHarzdameConfig(bad);
    }).toThrow(HarzdameConfigInvariantError);
  });

  it('rejects mismatched boardSize', () => {
    const z = createHarzdameConfig();
    const bad: HarzdameConfig = {
      ...z,
      boardGeometry: { ...z.boardGeometry, dimensions: { square: { size: 10 } } },
    };
    expect(() => {
      validateHarzdameConfig(bad);
    }).toThrow(HarzdameConfigInvariantError);
  });

  it('rejects geometry without dark-squares mask', () => {
    const z = createHarzdameConfig();
    const bad: HarzdameConfig = {
      ...z,
      boardGeometry: { ...z.boardGeometry, playableMask: undefined },
    };
    expect(() => {
      validateHarzdameConfig(bad);
    }).toThrow(HarzdameConfigInvariantError);
  });

  it('rejects promotion-area set with wrong cardinality (white)', () => {
    const z = createHarzdameConfig();
    const bad: HarzdameConfig = {
      ...z,
      promotionArea: {
        white: new Set(),
        black: z.promotionArea.black,
      },
    };
    expect(() => {
      validateHarzdameConfig(bad);
    }).toThrow(HarzdameConfigInvariantError);
  });

  it('rejects promotion-area set with wrong cardinality (black)', () => {
    const z = createHarzdameConfig();
    const bad: HarzdameConfig = {
      ...z,
      promotionArea: {
        white: z.promotionArea.white,
        black: new Set(),
      },
    };
    expect(() => {
      validateHarzdameConfig(bad);
    }).toThrow(HarzdameConfigInvariantError);
  });
});

describe('HarzdameStartingPositionMismatchError', () => {
  it('carries expected / actual', () => {
    const err = new HarzdameStartingPositionMismatchError(24, 23);
    expect(err.expected).toBe(24);
    expect(err.actual).toBe(23);
  });
});
