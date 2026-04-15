import { describe, expect, it } from 'vitest';

import { asNodeId } from '../boardGeometry';
import {
  buildRectangleAdjacency,
  fanoronaDiagonalsMask,
} from './RectangleAdjacency';

describe('RectangleAdjacency — 9×5 Fanorona', () => {
  const graph = buildRectangleAdjacency({
    width: 9,
    height: 5,
    diagonalsMask: fanoronaDiagonalsMask(9),
  });

  it('has 45 nodes', () => {
    expect(graph.nodeCount()).toBe(45);
  });

  it('center (r=2,c=4) has diagonals (even parity)', () => {
    const center = asNodeId(2 * 9 + 4);
    expect(graph.ofKind('diagonal', center).length).toBeGreaterThan(0);
  });

  it('odd-parity square has no diagonals', () => {
    const odd = asNodeId(0 * 9 + 1);
    expect(graph.ofKind('diagonal', odd)).toEqual([]);
  });

  it('corner (0,0) has 2 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', asNodeId(0)).length).toBe(2);
  });

  it('opposite corner (4,8) has 2 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', asNodeId(4 * 9 + 8)).length).toBe(2);
  });

  it('edge (0,4) has 3 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', asNodeId(4)).length).toBe(3);
  });

  it('interior (2,2) has 4 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', asNodeId(2 * 9 + 2)).length).toBe(4);
  });
});

describe('RectangleAdjacency — 9×10 Xiangqi (intersections)', () => {
  const graph = buildRectangleAdjacency({ width: 9, height: 10 });

  it('has 90 nodes', () => {
    expect(graph.nodeCount()).toBe(90);
  });

  it('corner has 2 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', asNodeId(0)).length).toBe(2);
  });

  it('interior has 4 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', asNodeId(5 * 9 + 4)).length).toBe(4);
  });

  it('edge has 3 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', asNodeId(5)).length).toBe(3);
  });

  it('queen-line from corner is non-empty', () => {
    expect(graph.ofKind('queen-line', asNodeId(0)).length).toBeGreaterThan(0);
  });

  it('returns empty for unknown direction', () => {
    expect(graph.ofKind('hex', asNodeId(0))).toEqual([]);
  });

  it('returns empty for unknown node', () => {
    expect(graph.ofKind('orthogonal', asNodeId(9999))).toEqual([]);
  });
});

describe('RectangleAdjacency — reference hand-verification (9×5)', () => {
  const graph = buildRectangleAdjacency({ width: 9, height: 5 });
  const table: Array<[number, number, number]> = [
    [0, 0, 2],
    [0, 8, 2],
    [4, 0, 2],
    [4, 8, 2],
    [0, 4, 3],
    [4, 4, 3],
    [2, 0, 3],
    [2, 8, 3],
    [2, 4, 4],
    [1, 1, 4],
    [1, 7, 4],
    [3, 1, 4],
    [3, 7, 4],
    [2, 1, 4],
    [2, 7, 4],
    [0, 1, 3],
    [0, 7, 3],
    [4, 1, 3],
    [4, 7, 3],
    [1, 4, 4],
    [3, 4, 4],
  ];
  for (const [r, c, expected] of table) {
    it(`(${String(r)},${String(c)}) orthogonal count = ${String(expected)}`, () => {
      expect(graph.ofKind('orthogonal', asNodeId(r * 9 + c)).length).toBe(expected);
    });
  }
});
