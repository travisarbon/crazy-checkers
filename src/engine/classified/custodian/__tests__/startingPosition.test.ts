import { describe, expect, it } from 'vitest';
import {
  CustodianStartingPositionMismatchError,
  buildStartingState,
} from '../startingPosition';
import {
  CustodianConfigInvariantError,
  validateCustodianConfig,
  type CustodianConfig,
} from '../types';
import { createMakYekConfig } from '../makYekConfig';
import { createHasamiShogiConfig } from '../hasamiShogiConfig';
import { createRekConfig } from '../rekConfig';
import { createDaiHasamiShogiConfig } from '../daiHasamiShogiConfig';

describe('buildStartingState — Mak-yek', () => {
  const config = createMakYekConfig();
  const state = buildStartingState(config);

  it('places 32 pieces total (16 per side)', () => {
    expect(state.pieces.size).toBe(32);
  });

  it('white starts on rows 0 and 2; black on rows 5 and 7', () => {
    for (const [nodeId, piece] of state.pieces) {
      const r = Math.floor((nodeId as unknown as number) / 8);
      if (piece.owner === 'white') expect([0, 2]).toContain(r);
      if (piece.owner === 'black') expect([5, 7]).toContain(r);
    }
  });

  it('white moves first', () => {
    expect(state.turn).toBe('white');
  });

  it('repetition table seeded with starting hash count 1', () => {
    expect(state.meta.repetitionTable).toHaveLength(1);
    expect(state.meta.repetitionTable[0]?.[1]).toBe(1);
  });
});

describe('buildStartingState — Hasami Shogi', () => {
  const config = createHasamiShogiConfig();
  const state = buildStartingState(config);

  it('places 18 pieces (9 per side, ranks 1 and 9)', () => {
    expect(state.pieces.size).toBe(18);
  });
});

describe('buildStartingState — Rek', () => {
  const config = createRekConfig();
  const state = buildStartingState(config);

  it('places 32 pieces (16 per side: 15 men + 1 king each)', () => {
    expect(state.pieces.size).toBe(32);
    let whiteKing = 0;
    let blackKing = 0;
    for (const piece of state.pieces.values()) {
      if (piece.owner === 'white' && piece.kind === 'king') whiteKing += 1;
      if (piece.owner === 'black' && piece.kind === 'king') blackKing += 1;
    }
    expect(whiteKing).toBe(1);
    expect(blackKing).toBe(1);
  });

  it('places White King at row 1 col 0', () => {
    const node = (1 * 8 + 0) as never;
    const piece = state.pieces.get(node);
    expect(piece?.owner).toBe('white');
    expect(piece?.kind).toBe('king');
  });
});

describe('buildStartingState — Dai Hasami Shogi', () => {
  const config = createDaiHasamiShogiConfig();
  const state = buildStartingState(config);

  it('places 36 pieces (18 per side, rows 0..1 and 7..8)', () => {
    expect(state.pieces.size).toBe(36);
  });
});

describe('validateCustodianConfig — invariants', () => {
  it('rejects a non-square board geometry', () => {
    const m = createMakYekConfig();
    const bad: CustodianConfig = {
      ...m,
      boardGeometry: { ...m.boardGeometry, kind: 'ring', dimensions: {} },
    };
    expect(() => {
      validateCustodianConfig(bad);
    }).toThrow(CustodianConfigInvariantError);
  });

  it('rejects mismatched boardSize', () => {
    const m = createMakYekConfig();
    const bad: CustodianConfig = {
      ...m,
      boardGeometry: { ...m.boardGeometry, dimensions: { square: { size: 10 } } },
    };
    expect(() => {
      validateCustodianConfig(bad);
    }).toThrow(CustodianConfigInvariantError);
  });

  it('rejects a dark-only mask', () => {
    const m = createMakYekConfig();
    const bad: CustodianConfig = {
      ...m,
      boardGeometry: { ...m.boardGeometry, playableMask: () => true },
    };
    expect(() => {
      validateCustodianConfig(bad);
    }).toThrow(CustodianConfigInvariantError);
  });
});

describe('CustodianStartingPositionMismatchError', () => {
  it('carries gameId / expected / actual', () => {
    const err = new CustodianStartingPositionMismatchError('mak-yek', 32, 31);
    expect(err.gameId).toBe('mak-yek');
    expect(err.expected).toBe(32);
    expect(err.actual).toBe(31);
  });
});
