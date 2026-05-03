import { describe, expect, it } from 'vitest';
import {
  CheskersStartingPositionMismatchError,
  buildStartingState,
} from '../startingPosition';
import {
  CheskersConfigInvariantError,
  createCheskersConfig,
  validateCheskersConfig,
  type CheskersConfig,
} from '../types';
import type { NodeId } from '../../../boardGeometry';

describe('buildStartingState — Cheskers', () => {
  const config = createCheskersConfig();
  const state = buildStartingState(config);

  it('places 24 pieces (12 per side)', () => {
    expect(state.pieces.size).toBe(24);
  });

  it('per-side counts: 8 Pawns, 2 Kings, 1 Bishop, 1 Camel', () => {
    let wp = 0,
      wk = 0,
      wb = 0,
      wc = 0,
      bp = 0,
      bk = 0,
      bb = 0,
      bc = 0;
    for (const piece of state.pieces.values()) {
      if (piece.owner === 'white') {
        if (piece.kind === 'pawn') wp += 1;
        else if (piece.kind === 'king') wk += 1;
        else if (piece.kind === 'bishop') wb += 1;
        else if (piece.kind === 'camel') wc += 1;
      } else if (piece.owner === 'black') {
        if (piece.kind === 'pawn') bp += 1;
        else if (piece.kind === 'king') bk += 1;
        else if (piece.kind === 'bishop') bb += 1;
        else if (piece.kind === 'camel') bc += 1;
      }
    }
    expect({ wp, wk, wb, wc }).toEqual({ wp: 8, wk: 2, wb: 1, wc: 1 });
    expect({ bp, bk, bb, bc }).toEqual({ bp: 8, bk: 2, bb: 1, bc: 1 });
  });

  it('white kings at c1 + e1; white bishop at a1; white camel at g1', () => {
    const c1 = config.boardGeometry.coordinateLabels.parseNotation('c1') as NodeId;
    const e1 = config.boardGeometry.coordinateLabels.parseNotation('e1') as NodeId;
    const a1 = config.boardGeometry.coordinateLabels.parseNotation('a1') as NodeId;
    const g1 = config.boardGeometry.coordinateLabels.parseNotation('g1') as NodeId;
    expect(state.pieces.get(c1)).toEqual({ owner: 'white', kind: 'king' });
    expect(state.pieces.get(e1)).toEqual({ owner: 'white', kind: 'king' });
    expect(state.pieces.get(a1)).toEqual({ owner: 'white', kind: 'bishop' });
    expect(state.pieces.get(g1)).toEqual({ owner: 'white', kind: 'camel' });
  });

  it('black kings at d8 + f8; black bishop at h8; black camel at b8', () => {
    const d8 = config.boardGeometry.coordinateLabels.parseNotation('d8') as NodeId;
    const f8 = config.boardGeometry.coordinateLabels.parseNotation('f8') as NodeId;
    const h8 = config.boardGeometry.coordinateLabels.parseNotation('h8') as NodeId;
    const b8 = config.boardGeometry.coordinateLabels.parseNotation('b8') as NodeId;
    expect(state.pieces.get(d8)).toEqual({ owner: 'black', kind: 'king' });
    expect(state.pieces.get(f8)).toEqual({ owner: 'black', kind: 'king' });
    expect(state.pieces.get(h8)).toEqual({ owner: 'black', kind: 'bishop' });
    expect(state.pieces.get(b8)).toEqual({ owner: 'black', kind: 'camel' });
  });

  it('black moves first per playbook §4.10', () => {
    expect(state.turn).toBe('black');
    expect(state.plyCount).toBe(0);
    expect(state.moveHistory).toHaveLength(0);
  });

  it('repetition table seeded with starting hash count 1', () => {
    expect(state.meta.repetitionTable).toHaveLength(1);
    expect(state.meta.repetitionTable[0]?.[1]).toBe(1);
  });

  it('king-count cache initialised to 2 + 2', () => {
    expect(state.meta.kingCount).toEqual({ white: 2, black: 2 });
  });
});

describe('validateCheskersConfig — invariants', () => {
  it('rejects a non-square board geometry', () => {
    const z = createCheskersConfig();
    const bad: CheskersConfig = {
      ...z,
      boardGeometry: { ...z.boardGeometry, kind: 'ring', dimensions: {} },
    };
    expect(() => {
      validateCheskersConfig(bad);
    }).toThrow(CheskersConfigInvariantError);
  });

  it('rejects mismatched boardSize', () => {
    const z = createCheskersConfig();
    const bad: CheskersConfig = {
      ...z,
      boardGeometry: { ...z.boardGeometry, dimensions: { square: { size: 10 } } },
    };
    expect(() => {
      validateCheskersConfig(bad);
    }).toThrow(CheskersConfigInvariantError);
  });

  it('rejects geometry without dark-squares mask under (3,1) Camel', () => {
    const z = createCheskersConfig();
    const bad: CheskersConfig = {
      ...z,
      boardGeometry: { ...z.boardGeometry, playableMask: undefined },
    };
    expect(() => {
      validateCheskersConfig(bad);
    }).toThrow(CheskersConfigInvariantError);
  });

  it('rejects pawnPromotion target=choice with empty choices', () => {
    const z = createCheskersConfig();
    const bad: CheskersConfig = {
      ...z,
      pawnPromotion: { target: 'choice', choices: [] },
    };
    expect(() => {
      validateCheskersConfig(bad);
    }).toThrow(CheskersConfigInvariantError);
  });

  it('accepts a valid alternate config (max-capture knob ON)', () => {
    const z = createCheskersConfig();
    const variant: CheskersConfig = { ...z, maximumCaptureMandatory: true };
    expect(() => {
      validateCheskersConfig(variant);
    }).not.toThrow();
  });
});

describe('CheskersStartingPositionMismatchError', () => {
  it('carries expected / actual', () => {
    const err = new CheskersStartingPositionMismatchError(24, 23);
    expect(err.expected).toBe(24);
    expect(err.actual).toBe(23);
  });
});
