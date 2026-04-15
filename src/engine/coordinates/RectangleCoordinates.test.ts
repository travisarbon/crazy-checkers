import { describe, expect, it } from 'vitest';

import { asNodeId } from '../boardGeometry';
import { buildRectangleCoordinates } from './RectangleCoordinates';

describe('RectangleCoordinates — 9×5 Fanorona', () => {
  const labels = buildRectangleCoordinates({ width: 9, height: 5, indexing: 'squares' });

  it('a1 corresponds to bottom-left (row 4, col 0)', () => {
    expect(labels.notationOf(asNodeId(4 * 9))).toBe('a1');
  });

  it('i5 corresponds to top-right (row 0, col 8)', () => {
    expect(labels.notationOf(asNodeId(8))).toBe('i5');
  });

  it('parseNotation round-trips every cell', () => {
    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const id = asNodeId(r * 9 + c);
        const token = labels.notationOf(id);
        expect(labels.parseNotation(token)).toBe(id);
      }
    }
  });

  it('rejects out-of-bounds tokens', () => {
    expect(labels.parseNotation('j1')).toBeNull();
    expect(labels.parseNotation('a6')).toBeNull();
  });
});

describe('RectangleCoordinates — 9×10 Xiangqi', () => {
  const labels = buildRectangleCoordinates({ width: 9, height: 10, indexing: 'intersections' });

  it('a1 corresponds to (row 9, col 0)', () => {
    expect(labels.notationOf(asNodeId(9 * 9))).toBe('a1');
  });

  it('parseNotation round-trips', () => {
    const id = asNodeId(4 * 9 + 3);
    expect(labels.parseNotation(labels.notationOf(id))).toBe(id);
  });

  it('ariaOf includes indexing mode', () => {
    expect(labels.ariaOf(asNodeId(0))).toContain('intersections');
  });
});
