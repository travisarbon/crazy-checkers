import { describe, expect, it } from 'vitest';

import { encodeAxial } from '../adjacency/HexAdjacency';
import {
  buildHexRhombusCoordinates,
  buildHexTriangularCoordinates,
} from './HexCoordinates';

describe('HexCoordinates — 11×11 rhombus', () => {
  const labels = buildHexRhombusCoordinates(11);

  it('notationOf uses axial form', () => {
    expect(labels.notationOf(encodeAxial(3, 4))).toBe('3,4');
  });

  it('displayOf uses a..k × 1..11 aliases', () => {
    expect(labels.displayOf(encodeAxial(0, 0))).toBe('a1');
    expect(labels.displayOf(encodeAxial(10, 10))).toBe('k11');
  });

  it('parseNotation round-trips axial', () => {
    for (let q = 0; q < 11; q += 1) {
      for (let r = 0; r < 11; r += 1) {
        const id = encodeAxial(q, r);
        expect(labels.parseNotation(`${String(q)},${String(r)}`)).toBe(id);
      }
    }
  });

  it('parseNotation accepts alias form', () => {
    expect(labels.parseNotation('c4')).toBe(encodeAxial(2, 3));
  });

  it('rejects out-of-bounds axial', () => {
    expect(labels.parseNotation('11,0')).toBeNull();
    expect(labels.parseNotation('0,11')).toBeNull();
  });

  it('rejects out-of-bounds alias', () => {
    expect(labels.parseNotation('l1')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(labels.parseNotation('blarg')).toBeNull();
  });

  it('ariaOf uses expected family prefix', () => {
    expect(labels.ariaOf(encodeAxial(0, 0))).toMatch(/^hex-rhombus-11/);
  });
});

describe('HexCoordinates — Havannah size-6 triangular', () => {
  const labels = buildHexTriangularCoordinates(6);

  it('notationOf returns axial', () => {
    expect(labels.notationOf(encodeAxial(-3, 2))).toBe('-3,2');
  });

  it('parseNotation rejects out-of-shape cells', () => {
    expect(labels.parseNotation('6,0')).toBeNull();
  });

  it('parseNotation accepts in-shape cells', () => {
    expect(labels.parseNotation('0,0')).toBe(encodeAxial(0, 0));
  });
});
