import { describe, expect, it } from 'vitest';
import {
  AlquerqueStartingPositionMismatchError,
  buildStartingState,
} from '../startingPosition';
import {
  AlquerqueConfigInvariantError,
  createZammaConfig,
  validateAlquerqueConfig,
  type AlquerqueConfig,
} from '../types';

describe('buildStartingState — Zamma', () => {
  const config = createZammaConfig();
  const state = buildStartingState(config);

  it('places 80 pieces total (40 per side)', () => {
    expect(state.pieces.size).toBe(80);
    let whiteCount = 0;
    let blackCount = 0;
    for (const piece of state.pieces.values()) {
      if (piece.owner === 'white') whiteCount += 1;
      if (piece.owner === 'black') blackCount += 1;
      expect(piece.kind).toBe('man');
    }
    expect(whiteCount).toBe(40);
    expect(blackCount).toBe(40);
  });

  it('center intersection (4, 4) = NodeId 40 is empty', () => {
    expect(state.pieces.has(40 as never)).toBe(false);
  });

  it('white starts on rows 5..8 (plus row 4 cols 5..8); black on rows 0..3 (plus row 4 cols 0..3)', () => {
    for (const [nodeId, piece] of state.pieces) {
      const idx = nodeId as unknown as number;
      const r = Math.floor(idx / 9);
      const c = idx % 9;
      if (piece.owner === 'white') {
        // white-bottom: rows 5..8 OR (row 4 AND col 5..8)
        const inWhiteHome = r >= 5 || (r === 4 && c >= 5);
        expect(inWhiteHome, `unexpected white at NodeId ${String(idx)}`).toBe(true);
      }
      if (piece.owner === 'black') {
        const inBlackHome = r <= 3 || (r === 4 && c <= 3);
        expect(inBlackHome, `unexpected black at NodeId ${String(idx)}`).toBe(true);
      }
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

  it('row 0 is fully black (9 pieces, all kind=man)', () => {
    for (let c = 0; c < 9; c += 1) {
      const piece = state.pieces.get(c as never);
      expect(piece?.owner).toBe('black');
      expect(piece?.kind).toBe('man');
    }
  });

  it('row 8 is fully white', () => {
    for (let c = 0; c < 9; c += 1) {
      const node = (8 * 9 + c) as never;
      const piece = state.pieces.get(node);
      expect(piece?.owner).toBe('white');
    }
  });

  it('row 4: cols 0..3 black, cols 5..8 white, col 4 empty', () => {
    for (let c = 0; c < 4; c += 1) {
      expect(state.pieces.get((4 * 9 + c) as never)?.owner).toBe('black');
    }
    expect(state.pieces.has((4 * 9 + 4) as never)).toBe(false);
    for (let c = 5; c < 9; c += 1) {
      expect(state.pieces.get((4 * 9 + c) as never)?.owner).toBe('white');
    }
  });
});

describe('validateAlquerqueConfig — invariants', () => {
  it('rejects a non-alquerque board geometry', () => {
    const z = createZammaConfig();
    const bad: AlquerqueConfig = {
      ...z,
      boardGeometry: {
        ...z.boardGeometry,
        kind: 'square',
        dimensions: {},
      },
    };
    expect(() => {
      validateAlquerqueConfig(bad);
    }).toThrow(AlquerqueConfigInvariantError);
  });

  it('rejects mismatched boardSize', () => {
    const z = createZammaConfig();
    const bad: AlquerqueConfig = {
      ...z,
      boardGeometry: {
        ...z.boardGeometry,
        dimensions: { alquerque: { size: 7, diagonalPattern: 'alternating' } },
      },
    };
    expect(() => {
      validateAlquerqueConfig(bad);
    }).toThrow(AlquerqueConfigInvariantError);
  });

  it('rejects mismatched diagonalPattern', () => {
    const z = createZammaConfig();
    const bad: AlquerqueConfig = {
      ...z,
      boardGeometry: {
        ...z.boardGeometry,
        dimensions: { alquerque: { size: 9, diagonalPattern: 'full' } },
      },
    };
    expect(() => {
      validateAlquerqueConfig(bad);
    }).toThrow(AlquerqueConfigInvariantError);
  });
});

describe('AlquerqueStartingPositionMismatchError', () => {
  it('carries gameId / expected / actual', () => {
    const err = new AlquerqueStartingPositionMismatchError('zamma', 80, 79);
    expect(err.gameId).toBe('zamma');
    expect(err.expected).toBe(80);
    expect(err.actual).toBe(79);
    expect(err.message).toMatch(/zamma/);
  });
});
