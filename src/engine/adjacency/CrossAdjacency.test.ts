import { describe, expect, it } from 'vitest';

import { buildCrossAdjacency, crossNodeId } from './CrossAdjacency';

describe('CrossAdjacency — Fox and Geese (33-point cross)', () => {
  const graph = buildCrossAdjacency({ includeDiagonals: true });

  it('has 33 nodes', () => {
    expect(graph.nodeCount()).toBe(33);
  });

  it('center (3,3) has 4 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', crossNodeId(3, 3)).length).toBe(4);
  });

  it('arm-tip (0,3) has 3 orthogonal neighbors (down + two lateral)', () => {
    expect(graph.ofKind('orthogonal', crossNodeId(0, 3)).length).toBe(3);
  });

  it('arm-tip (3,0) has 3 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', crossNodeId(3, 0)).length).toBe(3);
  });

  it('center includes diagonal neighbors', () => {
    expect(graph.ofKind('diagonal', crossNodeId(3, 3)).length).toBe(4);
  });

  it('arm-tip has fewer diagonals due to missing neighbors', () => {
    expect(graph.ofKind('diagonal', crossNodeId(0, 3)).length).toBeLessThanOrEqual(2);
  });

  it('returns empty for unknown direction', () => {
    expect(graph.ofKind('hex', crossNodeId(3, 3))).toEqual([]);
  });
});

describe('CrossAdjacency — reference hand-verification', () => {
  const graph = buildCrossAdjacency({ includeDiagonals: true });
  const table: Array<[number, number, number]> = [
    // [r, c, expectedOrthoCount]
    [0, 2, 2],
    [0, 3, 3],
    [0, 4, 2],
    [1, 2, 3],
    [1, 3, 4],
    [1, 4, 3],
    [2, 0, 2],
    [2, 1, 3],
    [2, 2, 4],
    [2, 3, 4],
    [2, 4, 4],
    [2, 5, 3],
    [2, 6, 2],
    [3, 0, 3],
    [3, 1, 4],
    [3, 2, 4],
    [3, 3, 4],
    [3, 4, 4],
    [3, 5, 4],
    [3, 6, 3],
    [4, 0, 2],
    [4, 1, 3],
    [4, 2, 4],
    [4, 6, 2],
    [6, 3, 3],
  ];
  for (const [r, c, expected] of table) {
    it(`(${String(r)},${String(c)}) orthogonal count = ${String(expected)}`, () => {
      expect(graph.ofKind('orthogonal', crossNodeId(r, c)).length).toBe(expected);
    });
  }
});
