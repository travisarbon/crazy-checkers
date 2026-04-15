import { describe, expect, it } from 'vitest';

import { asNodeId } from '../boardGeometry';
import { buildMancalaPitAdjacency } from '../adjacency/MancalaPitAdjacency';
import { buildMancalaPitCoordinates } from './MancalaPitCoordinates';

describe('MancalaPitCoordinates — Oware 2×6', () => {
  const labels = buildMancalaPitCoordinates('oware-2x6');

  it('south pits use A..F', () => {
    expect(labels.notationOf(asNodeId(6))).toBe('A');
    expect(labels.notationOf(asNodeId(11))).toBe('F');
  });

  it('north pits use a..f', () => {
    expect(labels.notationOf(asNodeId(0))).toBe('a');
    expect(labels.notationOf(asNodeId(5))).toBe('f');
  });

  it('stores labeled', () => {
    expect(labels.notationOf(asNodeId(12))).toBe('store-S');
    expect(labels.notationOf(asNodeId(13))).toBe('store-N');
  });

  it('round-trips', () => {
    const { graph } = buildMancalaPitAdjacency('oware-2x6');
    for (const node of graph.listAllNodes()) {
      expect(labels.parseNotation(labels.notationOf(node))).toBe(node);
    }
  });

  it('rejects bad tokens', () => {
    expect(labels.parseNotation('G')).toBeNull();
    expect(labels.parseNotation('g')).toBeNull();
  });
});

describe('MancalaPitCoordinates — Bao 4×8', () => {
  const labels = buildMancalaPitCoordinates('bao-4x8');

  it('uses r{row}c{col}', () => {
    expect(labels.notationOf(asNodeId(0))).toBe('r0c0');
    expect(labels.notationOf(asNodeId(31))).toBe('r3c7');
  });

  it('round-trips', () => {
    const { graph } = buildMancalaPitAdjacency('bao-4x8');
    for (const node of graph.listAllNodes()) {
      expect(labels.parseNotation(labels.notationOf(node))).toBe(node);
    }
  });

  it('rejects bad tokens', () => {
    expect(labels.parseNotation('r4c0')).toBeNull();
    expect(labels.parseNotation('foo')).toBeNull();
  });
});
