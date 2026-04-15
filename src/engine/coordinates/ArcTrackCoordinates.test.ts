import { describe, expect, it } from 'vitest';

import {
  arcNodeId,
  buildArcTrackAdjacency,
  innerNodeId,
} from '../adjacency/ArcTrackAdjacency';
import { buildArcTrackCoordinates } from './ArcTrackCoordinates';

describe('ArcTrackCoordinates', () => {
  const labels = buildArcTrackCoordinates();
  const graph = buildArcTrackAdjacency();

  it('inner grid notation uses a1..f6', () => {
    expect(labels.notationOf(innerNodeId(5, 0))).toBe('a1');
    expect(labels.notationOf(innerNodeId(0, 5))).toBe('f6');
  });

  it('arc nodes are labeled arcNW1..arcSW4', () => {
    expect(labels.notationOf(arcNodeId(0))).toBe('arcNW1');
    expect(labels.notationOf(arcNodeId(15))).toBe('arcSW4');
  });

  it('round-trips every node', () => {
    for (const node of graph.listAllNodes()) {
      const token = labels.notationOf(node);
      expect(labels.parseNotation(token)).toBe(node);
    }
  });

  it('rejects bad tokens', () => {
    expect(labels.parseNotation('g1')).toBeNull();
    expect(labels.parseNotation('arcNW5')).toBeNull();
    expect(labels.parseNotation('foo')).toBeNull();
  });

  it('ariaOf starts with "surakarta"', () => {
    expect(labels.ariaOf(innerNodeId(0, 0))).toMatch(/^surakarta /);
  });
});
