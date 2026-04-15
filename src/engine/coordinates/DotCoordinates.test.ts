import { describe, expect, it } from 'vitest';

import type { NodeId } from '../boardGeometry';
import { buildDotAdjacency } from '../adjacency/DotAdjacency';
import { buildDotCoordinates } from './DotCoordinates';

function requireNode(node: NodeId | null, tag: string): NodeId {
  if (node === null) throw new Error(`expected node for ${tag}, got null`);
  return node;
}

describe('DotCoordinates', () => {
  const opts = { boxesAcross: 4, boxesDown: 4 };
  const labels = buildDotCoordinates(opts);
  const graph = buildDotAdjacency(opts);

  it('round-trips every node', () => {
    for (const node of graph.listAllNodes()) {
      const token = labels.notationOf(node);
      expect(labels.parseNotation(token)).toBe(node);
    }
  });

  it('dot tokens use d(r,c) form', () => {
    expect(labels.parseNotation('d(0,0)')).not.toBeNull();
    expect(
      labels.notationOf(requireNode(labels.parseNotation('d(2,3)'), 'd(2,3)')),
    ).toBe('d(2,3)');
  });

  it('h-edge tokens use h(r,c)', () => {
    expect(
      labels.notationOf(requireNode(labels.parseNotation('h(1,2)'), 'h(1,2)')),
    ).toBe('h(1,2)');
  });

  it('v-edge tokens use v(r,c)', () => {
    expect(
      labels.notationOf(requireNode(labels.parseNotation('v(2,1)'), 'v(2,1)')),
    ).toBe('v(2,1)');
  });

  it('box tokens use b(r,c)', () => {
    expect(
      labels.notationOf(requireNode(labels.parseNotation('b(3,3)'), 'b(3,3)')),
    ).toBe('b(3,3)');
  });

  it('rejects bad tokens', () => {
    expect(labels.parseNotation('d(5,0)')).toBeNull();
    expect(labels.parseNotation('h(0,4)')).toBeNull();
    expect(labels.parseNotation('v(4,0)')).toBeNull();
    expect(labels.parseNotation('b(4,0)')).toBeNull();
    expect(labels.parseNotation('x(0,0)')).toBeNull();
  });

  it('ariaOf starts with "dots"', () => {
    expect(
      labels.ariaOf(requireNode(labels.parseNotation('d(0,0)'), 'd(0,0)')),
    ).toMatch(/^dots /);
  });
});
