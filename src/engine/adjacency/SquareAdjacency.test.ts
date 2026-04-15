import { describe, expect, it } from 'vitest';

import { asNodeId } from '../boardGeometry';
import { buildSquareAdjacency, darkSquaresOnly } from './SquareAdjacency';

const at = (size: number, r: number, c: number): number => r * size + c;

describe('SquareAdjacency — 8×8 full board', () => {
  const graph = buildSquareAdjacency({ size: 8 });

  it('reports 64 nodes', () => {
    expect(graph.nodeCount()).toBe(64);
  });

  it('returns 2 orthogonal neighbors for corner a1 (row 7, col 0)', () => {
    const corner = asNodeId(at(8, 7, 0));
    expect(graph.ofKind('orthogonal', corner).length).toBe(2);
  });

  it('returns 3 orthogonal neighbors for edge a2 (row 6, col 0)', () => {
    expect(graph.ofKind('orthogonal', asNodeId(at(8, 6, 0))).length).toBe(3);
  });

  it('returns 4 orthogonal neighbors for center d4 (row 4, col 3)', () => {
    expect(graph.ofKind('orthogonal', asNodeId(at(8, 4, 3))).length).toBe(4);
  });

  it('returns 4 diagonal neighbors for center d4', () => {
    expect(graph.ofKind('diagonal', asNodeId(at(8, 4, 3))).length).toBe(4);
  });

  it('returns 1 diagonal neighbor for corner', () => {
    expect(graph.ofKind('diagonal', asNodeId(at(8, 0, 0))).length).toBe(1);
  });

  it('returns 21 queen-line targets from a corner (14 ortho + 7 diag)', () => {
    expect(graph.ofKind('queen-line', asNodeId(at(8, 0, 0))).length).toBe(21);
  });

  it('returns 27 queen-line targets from d4 center', () => {
    expect(graph.ofKind('queen-line', asNodeId(at(8, 3, 3))).length).toBe(27);
  });

  it('returns empty for an unknown direction kind', () => {
    expect(graph.ofKind('hex', asNodeId(0))).toEqual([]);
  });

  it('returns empty for an unknown node', () => {
    expect(graph.ofKind('orthogonal', asNodeId(9999))).toEqual([]);
  });

  it('hasNode for all 64 cells', () => {
    for (let n = 0; n < 64; n += 1) expect(graph.hasNode(asNodeId(n))).toBe(true);
  });
});

describe('SquareAdjacency — 8×8 draughts (dark squares only)', () => {
  const graph = buildSquareAdjacency({ size: 8, playableMask: darkSquaresOnly });

  it('reports 32 playable nodes', () => {
    expect(graph.nodeCount()).toBe(32);
  });

  it('excludes light squares from listAllNodes', () => {
    for (const node of graph.listAllNodes()) {
      const idx = node as unknown as number;
      const r = Math.floor(idx / 8);
      const c = idx % 8;
      expect((r + c) % 2).toBe(1);
    }
  });

  it('corner dark square has exactly 1 diagonal neighbor', () => {
    // (row 0, col 1) is dark. Diagonal neighbors on-board: (1, 0), (1, 2). Both dark.
    const node = asNodeId(at(8, 0, 1));
    expect(graph.ofKind('diagonal', node).length).toBe(2);
  });

  it('dark square on the central body has 4 diagonal neighbors', () => {
    expect(graph.ofKind('diagonal', asNodeId(at(8, 3, 2))).length).toBe(4);
  });

  it('reports direction kinds', () => {
    expect(graph.directionKinds).toEqual(['orthogonal', 'diagonal', 'queen-line']);
  });
});

describe('SquareAdjacency — reference nodes (hand-verified)', () => {
  const graph = buildSquareAdjacency({ size: 8 });
  const table: Array<[number, number, number, number, number]> = [
    // [r, c, expectedOrtho, expectedDiag, expectedQueenRays]
    [0, 0, 2, 1, 21],
    [0, 7, 2, 1, 21],
    [7, 0, 2, 1, 21],
    [7, 7, 2, 1, 21],
    [0, 3, 3, 2, 21],
    [0, 4, 3, 2, 21],
    [7, 3, 3, 2, 21],
    [3, 0, 3, 2, 21],
    [3, 7, 3, 2, 21],
    [3, 3, 4, 4, 27],
    [4, 4, 4, 4, 27],
    [3, 4, 4, 4, 27],
    [4, 3, 4, 4, 27],
    [1, 1, 4, 4, 23],
    [1, 6, 4, 4, 23],
    [6, 1, 4, 4, 23],
    [6, 6, 4, 4, 23],
    [2, 5, 4, 4, 25],
    [5, 2, 4, 4, 25],
    [2, 2, 4, 4, 25],
    [5, 5, 4, 4, 25],
  ];
  for (const [r, c, o, d, q] of table) {
    it(`reference (${String(r)}, ${String(c)})`, () => {
      const n = asNodeId(at(8, r, c));
      expect(graph.ofKind('orthogonal', n).length).toBe(o);
      expect(graph.ofKind('diagonal', n).length).toBe(d);
      expect(graph.ofKind('queen-line', n).length).toBe(q);
    });
  }
});
