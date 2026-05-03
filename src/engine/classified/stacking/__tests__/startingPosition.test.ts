import { describe, expect, it } from 'vitest';
import { buildStartingState, StartingPositionMismatchError } from '../startingPosition';
import {
  createBashniConfig,
  createLascaConfig,
  StackingConfigInvariantError,
  validateStackingConfig,
  type StackingDraughtsConfig,
} from '../types';

describe('buildStartingState — Lasca', () => {
  const config = createLascaConfig();
  const state = buildStartingState(config);

  it('places 22 single-piece towers (11 per side)', () => {
    expect(state.pieces.size).toBe(22);
    let whiteCount = 0;
    let blackCount = 0;
    for (const piece of state.pieces.values()) {
      if (piece.owner === 'white') whiteCount += 1;
      if (piece.owner === 'black') blackCount += 1;
      expect(piece.stack).toHaveLength(1);
      expect(piece.kind).toBe('man');
    }
    expect(whiteCount).toBe(11);
    expect(blackCount).toBe(11);
  });

  it('white starts on rows 4..6, black on rows 0..2', () => {
    for (const [nodeId, piece] of state.pieces) {
      const r = Math.floor((nodeId as unknown as number) / 7);
      if (piece.owner === 'white') expect(r).toBeGreaterThanOrEqual(4);
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
});

describe('buildStartingState — Bashni', () => {
  const config = createBashniConfig();
  const state = buildStartingState(config);

  it('places 24 single-piece towers (12 per side)', () => {
    expect(state.pieces.size).toBe(24);
    let whiteCount = 0;
    let blackCount = 0;
    for (const piece of state.pieces.values()) {
      if (piece.owner === 'white') whiteCount += 1;
      if (piece.owner === 'black') blackCount += 1;
    }
    expect(whiteCount).toBe(12);
    expect(blackCount).toBe(12);
  });
});

describe('validateStackingConfig — invariants', () => {
  it('rejects mismatched boardSize / piecesPerSide', () => {
    const bad: StackingDraughtsConfig = {
      ...createLascaConfig(),
      piecesPerSide: 12, // Lasca should be 11
    };
    expect(() => {
      validateStackingConfig(bad);
    }).toThrow(StackingConfigInvariantError);
  });

  it('rejects midCapturePromotion with short kings', () => {
    const bad: StackingDraughtsConfig = {
      ...createLascaConfig(),
      midCapturePromotion: true,
      kingType: 'short',
    };
    expect(() => {
      validateStackingConfig(bad);
    }).toThrow(StackingConfigInvariantError);
  });
});

describe('StartingPositionMismatchError', () => {
  it('carries gameId / expected / actual', () => {
    const err = new StartingPositionMismatchError('lasca', 22, 21);
    expect(err.gameId).toBe('lasca');
    expect(err.expected).toBe(22);
    expect(err.actual).toBe(21);
    expect(err.message).toMatch(/lasca/);
  });
});
