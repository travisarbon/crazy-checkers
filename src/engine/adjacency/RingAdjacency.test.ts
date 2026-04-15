import { describe, expect, it } from 'vitest';

import { buildRingAdjacency, ringNodeId } from './RingAdjacency';

describe('RingAdjacency — NMM (no corner diagonals)', () => {
  const graph = buildRingAdjacency({ hasCornerDiagonals: false });

  it('has 24 nodes', () => {
    expect(graph.nodeCount()).toBe(24);
  });

  it('outer top (ring 0, pos 0) has ring-around neighbors [pos 7, pos 1]', () => {
    const neighbors = graph.ofKind('ring-around', ringNodeId(0, 0));
    expect(neighbors).toEqual([ringNodeId(0, 7), ringNodeId(0, 1)]);
  });

  it('outer spoke node (ring 0, pos 0) has 1 ring-spoke neighbor (middle)', () => {
    expect(graph.ofKind('ring-spoke', ringNodeId(0, 0))).toEqual([ringNodeId(1, 0)]);
  });

  it('middle spoke node has 2 ring-spoke neighbors (outer + inner)', () => {
    expect(graph.ofKind('ring-spoke', ringNodeId(1, 0)).length).toBe(2);
  });

  it('inner spoke node has 1 ring-spoke neighbor', () => {
    expect(graph.ofKind('ring-spoke', ringNodeId(2, 0))).toEqual([ringNodeId(1, 0)]);
  });

  it('corner position (1) has no ring-spoke neighbors (no diagonal)', () => {
    expect(graph.ofKind('ring-spoke', ringNodeId(0, 1))).toEqual([]);
  });

  it('returns empty for unknown direction', () => {
    expect(graph.ofKind('hex', ringNodeId(0, 0))).toEqual([]);
  });
});

describe('RingAdjacency — Morabaraba (with corner diagonals)', () => {
  const graph = buildRingAdjacency({ hasCornerDiagonals: true });

  it('corner (1) on outer ring has 1 ring-spoke neighbor (middle)', () => {
    expect(graph.ofKind('ring-spoke', ringNodeId(0, 1)).length).toBe(1);
  });

  it('corner on middle ring has 2 ring-spoke neighbors (both adjacent rings)', () => {
    expect(graph.ofKind('ring-spoke', ringNodeId(1, 1)).length).toBe(2);
  });
});

describe('RingAdjacency — reference hand-verification', () => {
  const graph = buildRingAdjacency({ hasCornerDiagonals: false });
  const table: Array<[number, number, number, number]> = [
    // [ring, pos, expectedAroundCount, expectedSpokeCount]
    [0, 0, 2, 1],
    [0, 2, 2, 1],
    [0, 4, 2, 1],
    [0, 6, 2, 1],
    [0, 1, 2, 0],
    [0, 3, 2, 0],
    [0, 5, 2, 0],
    [0, 7, 2, 0],
    [1, 0, 2, 2],
    [1, 2, 2, 2],
    [1, 4, 2, 2],
    [1, 6, 2, 2],
    [1, 1, 2, 0],
    [1, 3, 2, 0],
    [1, 5, 2, 0],
    [1, 7, 2, 0],
    [2, 0, 2, 1],
    [2, 2, 2, 1],
    [2, 4, 2, 1],
    [2, 6, 2, 1],
    [2, 1, 2, 0],
    [2, 7, 2, 0],
  ];
  for (const [ring, pos, around, spoke] of table) {
    it(`(ring ${String(ring)}, pos ${String(pos)}) counts: around=${String(around)}, spoke=${String(spoke)}`, () => {
      const node = ringNodeId(ring, pos);
      expect(graph.ofKind('ring-around', node).length).toBe(around);
      expect(graph.ofKind('ring-spoke', node).length).toBe(spoke);
    });
  }
});
