import { describe, expect, it } from 'vitest';

import { buildCrossAdjacency, crossNodeId } from '../adjacency/CrossAdjacency';
import { buildCrossCoordinates } from './CrossCoordinates';

describe('CrossCoordinates', () => {
  const labels = buildCrossCoordinates();
  const graph = buildCrossAdjacency({ includeDiagonals: true });

  it('hub notation uses H1..H9', () => {
    expect(labels.notationOf(crossNodeId(2, 2))).toBe('H1');
    expect(labels.notationOf(crossNodeId(3, 3))).toBe('H5');
    expect(labels.notationOf(crossNodeId(4, 4))).toBe('H9');
  });

  it('north arm uses N1..N6', () => {
    expect(labels.notationOf(crossNodeId(1, 2))).toBe('N1');
    expect(labels.notationOf(crossNodeId(0, 4))).toBe('N6');
  });

  it('south arm uses S1..S6', () => {
    expect(labels.notationOf(crossNodeId(5, 2))).toBe('S1');
    expect(labels.notationOf(crossNodeId(6, 4))).toBe('S6');
  });

  it('east arm uses E1..E6', () => {
    expect(labels.notationOf(crossNodeId(2, 5))).toBe('E1');
  });

  it('west arm uses W1..W6', () => {
    expect(labels.notationOf(crossNodeId(2, 1))).toBe('W1');
  });

  it('round-trips every node', () => {
    for (const node of graph.listAllNodes()) {
      const token = labels.notationOf(node);
      expect(labels.parseNotation(token)).toBe(node);
    }
  });

  it('rejects bad tokens', () => {
    expect(labels.parseNotation('Q1')).toBeNull();
    expect(labels.parseNotation('N9')).toBeNull();
  });

  it('ariaOf starts with "cross"', () => {
    expect(labels.ariaOf(crossNodeId(3, 3))).toMatch(/^cross /);
  });
});
