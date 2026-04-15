import { describe, expect, it } from 'vitest';

import { ringNodeId } from '../adjacency/RingAdjacency';
import { buildRingCoordinates } from './RingCoordinates';

describe('RingCoordinates', () => {
  const labels = buildRingCoordinates();

  it('notationOf(outer-top) = outer-top', () => {
    expect(labels.notationOf(ringNodeId(0, 0))).toBe('outer-top');
  });

  it('notationOf(inner-bottom-left) = inner-bottom-left', () => {
    expect(labels.notationOf(ringNodeId(2, 5))).toBe('inner-bottom-left');
  });

  it('round-trips every point', () => {
    for (let ring = 0; ring < 3; ring += 1) {
      for (let pos = 0; pos < 8; pos += 1) {
        const id = ringNodeId(ring, pos);
        const token = labels.notationOf(id);
        expect(labels.parseNotation(token)).toBe(id);
      }
    }
  });

  it('parseNotation rejects invalid', () => {
    expect(labels.parseNotation('ultra-left')).toBeNull();
  });

  it('ariaOf starts with "NMM"', () => {
    expect(labels.ariaOf(ringNodeId(0, 0))).toMatch(/^NMM /);
  });
});
