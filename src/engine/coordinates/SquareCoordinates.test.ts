import { describe, expect, it } from 'vitest';

import { asNodeId } from '../boardGeometry';
import { buildSquareAdjacency, darkSquaresOnly } from '../adjacency/SquareAdjacency';
import { buildSquareCoordinates } from './SquareCoordinates';

describe('SquareCoordinates — 8×8 algebraic', () => {
  const labels = buildSquareCoordinates({ size: 8, indexing: 'squares' });

  it('a1 corresponds to row 7, col 0', () => {
    expect(labels.notationOf(asNodeId(7 * 8))).toBe('a1');
  });

  it('h8 corresponds to row 0, col 7', () => {
    expect(labels.notationOf(asNodeId(7))).toBe('h8');
  });

  it('parseNotation round-trips algebraic labels', () => {
    for (const square of ['a1', 'h8', 'd4', 'e5', 'a8', 'h1']) {
      const node = labels.parseNotation(square);
      if (node === null) throw new Error(`failed to parse ${square}`);
      expect(labels.notationOf(node)).toBe(square);
    }
  });

  it('parseNotation rejects malformed tokens', () => {
    expect(labels.parseNotation('z9')).toBeNull();
    expect(labels.parseNotation('a9')).toBeNull();
    expect(labels.parseNotation('foo')).toBeNull();
  });

  it('ariaOf follows "${family} ${alias}" pattern', () => {
    expect(labels.ariaOf(asNodeId(0))).toMatch(/^square [a-h]\d$/);
  });
});

describe('SquareCoordinates — 8×8 PDN numbering', () => {
  const labels = buildSquareCoordinates({
    size: 8,
    indexing: 'squares',
    playableMask: darkSquaresOnly,
    variant: 'pdn-8',
  });

  it('numbers dark squares 1..32', () => {
    const graph = buildSquareAdjacency({ size: 8, playableMask: darkSquaresOnly });
    const notations = graph.listAllNodes().map((n) => Number(labels.notationOf(n)));
    notations.sort((a, b) => a - b);
    expect(notations).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it('parseNotation round-trips PDN numbers', () => {
    for (let n = 1; n <= 32; n += 1) {
      const node = labels.parseNotation(String(n));
      if (node === null) throw new Error(`failed to parse PDN ${String(n)}`);
      expect(labels.notationOf(node)).toBe(String(n));
    }
  });

  it('parseNotation accepts algebraic fallback', () => {
    expect(labels.parseNotation('a2')).not.toBeNull();
  });

  it('aria uses draughts family', () => {
    const graph = buildSquareAdjacency({ size: 8, playableMask: darkSquaresOnly });
    const node = graph.listAllNodes()[0];
    if (node === undefined) throw new Error('no nodes');
    expect(labels.ariaOf(node)).toContain('draughts');
  });
});

describe('SquareCoordinates — 10×10 PDN', () => {
  const labels = buildSquareCoordinates({
    size: 10,
    indexing: 'squares',
    playableMask: darkSquaresOnly,
    variant: 'pdn-10',
  });
  const graph = buildSquareAdjacency({ size: 10, playableMask: darkSquaresOnly });

  it('numbers dark squares 1..50', () => {
    expect(graph.nodeCount()).toBe(50);
    const numbers = graph
      .listAllNodes()
      .map((n) => Number(labels.notationOf(n)))
      .sort((a, b) => a - b);
    expect(numbers[0]).toBe(1);
    expect(numbers[numbers.length - 1]).toBe(50);
  });
});
