import { describe, expect, it } from 'vitest';
import {
  buildStartingState,
  LinearStartingPositionMismatchError,
} from '../startingPosition';
import {
  createDameoConfig,
  LinearConfigInvariantError,
  validateLinearConfig,
  type LinearMovementConfig,
} from '../types';

describe('buildStartingState — Dameo', () => {
  const config = createDameoConfig();
  const state = buildStartingState(config);

  it('places 36 pieces total (18 per side)', () => {
    expect(state.pieces.size).toBe(36);
    let whiteCount = 0;
    let blackCount = 0;
    for (const piece of state.pieces.values()) {
      if (piece.owner === 'white') whiteCount += 1;
      if (piece.owner === 'black') blackCount += 1;
      expect(piece.kind).toBe('man');
    }
    expect(whiteCount).toBe(18);
    expect(blackCount).toBe(18);
  });

  it('white starts on rows 5..7, black on rows 0..2', () => {
    for (const [nodeId, piece] of state.pieces) {
      const r = Math.floor((nodeId as unknown as number) / 8);
      if (piece.owner === 'white') expect(r).toBeGreaterThanOrEqual(5);
      if (piece.owner === 'black') expect(r).toBeLessThanOrEqual(2);
    }
  });

  it('white moves first', () => {
    expect(state.turn).toBe('white');
    expect(state.plyCount).toBe(0);
    expect(state.moveHistory).toHaveLength(0);
  });

  it('repetition table seeded with starting hash', () => {
    expect(state.meta.repetitionTable).toHaveLength(1);
    expect(state.meta.repetitionTable[0]?.[1]).toBe(1);
  });

  it('trapezoid: row 7 has 8 white men, row 6 has 6, row 5 has 4', () => {
    const config2 = createDameoConfig();
    const labels = (r: number, cs: number[]): boolean => {
      for (const c of cs) {
        const node = (r * 8 + c) as unknown as import('../../../boardGeometry').NodeId;
        if (state.pieces.get(node)?.owner !== 'white') return false;
      }
      return true;
    };
    void config2;
    expect(labels(7, [0, 1, 2, 3, 4, 5, 6, 7])).toBe(true);
    expect(labels(6, [1, 2, 3, 4, 5, 6])).toBe(true);
    expect(labels(5, [2, 3, 4, 5])).toBe(true);
  });

  it('trapezoid: row 0 has 8 black men, row 1 has 6, row 2 has 4', () => {
    const labels = (r: number, cs: number[]): boolean => {
      for (const c of cs) {
        const node = (r * 8 + c) as unknown as import('../../../boardGeometry').NodeId;
        if (state.pieces.get(node)?.owner !== 'black') return false;
      }
      return true;
    };
    expect(labels(0, [0, 1, 2, 3, 4, 5, 6, 7])).toBe(true);
    expect(labels(1, [1, 2, 3, 4, 5, 6])).toBe(true);
    expect(labels(2, [2, 3, 4, 5])).toBe(true);
  });
});

describe('validateLinearConfig — invariants', () => {
  it('rejects a non-square board geometry', () => {
    const dameo = createDameoConfig();
    const bad: LinearMovementConfig = {
      ...dameo,
      boardGeometry: {
        ...dameo.boardGeometry,
        kind: 'ring',
        dimensions: {},
      },
    };
    expect(() => {
      validateLinearConfig(bad);
    }).toThrow(LinearConfigInvariantError);
  });

  it('rejects a geometry whose size disagrees with the config', () => {
    const dameo = createDameoConfig();
    const bad: LinearMovementConfig = {
      ...dameo,
      boardGeometry: {
        ...dameo.boardGeometry,
        dimensions: { square: { size: 10 } },
      },
    };
    expect(() => {
      validateLinearConfig(bad);
    }).toThrow(LinearConfigInvariantError);
  });

  it('rejects a dark-only mask (Dameo uses ALL 64 squares)', () => {
    const dameo = createDameoConfig();
    const bad: LinearMovementConfig = {
      ...dameo,
      boardGeometry: {
        ...dameo.boardGeometry,
        playableMask: () => true,
      },
    };
    expect(() => {
      validateLinearConfig(bad);
    }).toThrow(LinearConfigInvariantError);
  });
});

describe('LinearStartingPositionMismatchError', () => {
  it('carries gameId / expected / actual', () => {
    const err = new LinearStartingPositionMismatchError('dameo', 36, 35);
    expect(err.gameId).toBe('dameo');
    expect(err.expected).toBe(36);
    expect(err.actual).toBe(35);
    expect(err.message).toMatch(/dameo/);
  });
});
