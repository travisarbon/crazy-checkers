import { describe, expect, it } from 'vitest';

import {
  buildHexRhombusAdjacency,
  buildHexTriangularAdjacency,
  encodeAxial,
} from './HexAdjacency';

describe('HexAdjacency — 11×11 rhombus', () => {
  const graph = buildHexRhombusAdjacency(11);

  it('has 121 nodes', () => {
    expect(graph.nodeCount()).toBe(121);
  });

  it('center has 6 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(5, 5)).length).toBe(6);
  });

  it('corner (0,0) has 2 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(0, 0)).length).toBe(2);
  });

  it('opposite corner (10,10) has 2 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(10, 10)).length).toBe(2);
  });

  it('acute corner (0,10) has 3 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(0, 10)).length).toBe(3);
  });

  it('acute corner (10,0) has 3 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(10, 0)).length).toBe(3);
  });

  it('edge q=0 interior (0,5) has 4 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(0, 5)).length).toBe(4);
  });

  it('edge r=0 interior (5,0) has 4 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(5, 0)).length).toBe(4);
  });

  it('returns empty for non-hex direction', () => {
    expect(graph.ofKind('orthogonal', encodeAxial(0, 0))).toEqual([]);
  });
});

describe('HexAdjacency — reference hand-verification (11×11)', () => {
  const graph = buildHexRhombusAdjacency(11);
  const table: Array<[number, number, number]> = [
    [0, 0, 2],
    [10, 10, 2],
    [0, 10, 3],
    [10, 0, 3],
    [5, 5, 6],
    [4, 5, 6],
    [6, 5, 6],
    [5, 4, 6],
    [5, 6, 6],
    [1, 1, 6],
    [9, 9, 6],
    [0, 1, 4],
    [0, 5, 4],
    [0, 9, 4],
    [1, 0, 4],
    [5, 0, 4],
    [9, 0, 4],
    [10, 5, 4],
    [10, 9, 4],
    [5, 10, 4],
    [9, 10, 4],
    [1, 10, 4],
  ];
  for (const [q, r, expected] of table) {
    it(`(${String(q)},${String(r)}) has ${String(expected)} hex neighbors`, () => {
      expect(graph.ofKind('hex', encodeAxial(q, r)).length).toBe(expected);
    });
  }
});

describe('HexAdjacency — Havannah size-6 triangular', () => {
  const graph = buildHexTriangularAdjacency(6);

  it('has 91 nodes (3 * size * (size - 1) + 1)', () => {
    expect(graph.nodeCount()).toBe(91);
  });

  it('center (0,0) has 6 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(0, 0)).length).toBe(6);
  });

  it('far corner (5, -5) has 3 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(5, -5)).length).toBe(3);
  });

  it('far corner (-5, 5) has 3 neighbors', () => {
    expect(graph.ofKind('hex', encodeAxial(-5, 5)).length).toBe(3);
  });
});
