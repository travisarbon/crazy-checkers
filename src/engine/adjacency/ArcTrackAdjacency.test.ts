import { describe, expect, it } from 'vitest';

import {
  arcNodeId,
  buildArcTrackAdjacency,
  innerNodeId,
  isArcNode,
} from './ArcTrackAdjacency';

describe('ArcTrackAdjacency — Surakarta', () => {
  const graph = buildArcTrackAdjacency();

  it('has 52 nodes (36 inner + 16 arc nodes)', () => {
    expect(graph.nodeCount()).toBe(52);
  });

  it('inner corner (0,0) has 2 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', innerNodeId(0, 0)).length).toBe(2);
  });

  it('inner center (2,2) has 4 orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', innerNodeId(2, 2)).length).toBe(4);
  });

  it('inner corner (0,0) has at least 1 arc-loop neighbor', () => {
    expect(graph.ofKind('arc-loop', innerNodeId(0, 0)).length).toBeGreaterThanOrEqual(1);
  });

  it('arc node returns a single next-in-arc neighbor', () => {
    expect(graph.ofKind('arc-loop', arcNodeId(0)).length).toBe(1);
  });

  it('arc node has no orthogonal neighbors', () => {
    expect(graph.ofKind('orthogonal', arcNodeId(0))).toEqual([]);
  });

  it('isArcNode discriminates correctly', () => {
    expect(isArcNode(arcNodeId(0))).toBe(true);
    expect(isArcNode(innerNodeId(0, 0))).toBe(false);
  });

  it('returns empty for unknown direction', () => {
    expect(graph.ofKind('hex', innerNodeId(0, 0))).toEqual([]);
  });
});

describe('ArcTrackAdjacency — reference hand-verification', () => {
  const graph = buildArcTrackAdjacency();
  const table: Array<[number, number, number]> = [
    [0, 0, 2],
    [0, 5, 2],
    [5, 0, 2],
    [5, 5, 2],
    [0, 1, 3],
    [0, 2, 3],
    [0, 3, 3],
    [0, 4, 3],
    [5, 1, 3],
    [5, 4, 3],
    [1, 0, 3],
    [4, 0, 3],
    [1, 5, 3],
    [4, 5, 3],
    [1, 1, 4],
    [2, 2, 4],
    [2, 3, 4],
    [3, 2, 4],
    [3, 3, 4],
    [1, 4, 4],
    [4, 4, 4],
    [2, 1, 4],
    [3, 4, 4],
  ];
  for (const [r, c, expected] of table) {
    it(`(${String(r)},${String(c)}) orthogonal count = ${String(expected)}`, () => {
      expect(graph.ofKind('orthogonal', innerNodeId(r, c)).length).toBe(expected);
    });
  }
});
