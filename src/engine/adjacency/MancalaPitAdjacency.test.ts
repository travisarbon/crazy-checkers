import { describe, expect, it } from 'vitest';

import { asNodeId } from '../boardGeometry';
import { buildMancalaPitAdjacency } from './MancalaPitAdjacency';

describe('MancalaPitAdjacency — Oware 2×6', () => {
  const { graph, dimensions } = buildMancalaPitAdjacency('oware-2x6');

  it('has 14 nodes (12 pits + 2 stores)', () => {
    expect(graph.nodeCount()).toBe(14);
  });

  it('exposes sowingOrder with 12 pits', () => {
    expect(dimensions.sowingOrder.length).toBe(12);
  });

  it('lists both stores', () => {
    expect(dimensions.stores).toEqual(['south', 'north']);
  });

  it('pit-chain from south pit 0 (index 6) returns pit 1 (index 7)', () => {
    const southA = asNodeId(6);
    const next = graph.ofKind('pit-chain', southA);
    expect(next).toEqual([asNodeId(7)]);
  });

  it('pit-chain wraps around the loop', () => {
    // Last in sowingOrder -> back to first
    const last = dimensions.sowingOrder[dimensions.sowingOrder.length - 1];
    const first = dimensions.sowingOrder[0];
    if (last === undefined || first === undefined) throw new Error('empty sowing order');
    const next = graph.ofKind('pit-chain', last);
    expect(next).toEqual([first]);
  });

  it('returns empty for unknown direction', () => {
    expect(graph.ofKind('hex', asNodeId(6))).toEqual([]);
  });
});

describe('MancalaPitAdjacency — Bao 4×8', () => {
  const { graph, dimensions } = buildMancalaPitAdjacency('bao-4x8');

  it('has 32 pits', () => {
    expect(graph.nodeCount()).toBe(32);
  });

  it('sowingOrder covers all 32 pits', () => {
    expect(dimensions.sowingOrder.length).toBe(32);
  });

  it('pit-chain returns exactly one next pit for every pit', () => {
    for (const pit of dimensions.sowingOrder) {
      expect(graph.ofKind('pit-chain', pit).length).toBe(1);
    }
  });
});
