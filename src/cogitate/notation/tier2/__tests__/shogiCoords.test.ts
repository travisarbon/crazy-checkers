import { describe, expect, it } from 'vitest';
import { shogiCoordinateLabeler } from '../shogiCoords';

describe('shogiCoordinateLabeler(9)', () => {
  const lbl = shogiCoordinateLabeler(9);

  it('top-left (nodeId 0) = "9a"', () => {
    expect(lbl.notationOf(0)).toBe('9a');
  });

  it('top-right (nodeId 8) = "1a"', () => {
    expect(lbl.notationOf(8)).toBe('1a');
  });

  it('bottom-left (nodeId 72) = "9i"', () => {
    expect(lbl.notationOf(72)).toBe('9i');
  });

  it('bottom-right (nodeId 80) = "1i"', () => {
    expect(lbl.notationOf(80)).toBe('1i');
  });

  it('round-trips every node 0..80', () => {
    for (let i = 0; i < 81; i += 1) {
      const text = lbl.notationOf(i);
      const parsed = lbl.parseNotation(text);
      expect(parsed).toBe(i);
    }
  });

  it('parseNotation rejects invalid file', () => {
    expect(lbl.parseNotation('0a')).toBeNull();
    expect(lbl.parseNotation('Aa')).toBeNull();
  });

  it('parseNotation rejects invalid rank', () => {
    expect(lbl.parseNotation('5z')).toBeNull();
    expect(lbl.parseNotation('51')).toBeNull();
  });

  it('parseNotation rejects malformed length', () => {
    expect(lbl.parseNotation('')).toBeNull();
    expect(lbl.parseNotation('9')).toBeNull();
    expect(lbl.parseNotation('9aa')).toBeNull();
  });

  it('notationOf returns "?" for out-of-range nodeIds', () => {
    expect(lbl.notationOf(-1)).toBe('?');
    expect(lbl.notationOf(81)).toBe('?');
    expect(lbl.notationOf(1.5)).toBe('?');
  });

  it('throws on non-9 board sizes', () => {
    expect(() => shogiCoordinateLabeler(8)).toThrow();
    expect(() => shogiCoordinateLabeler(10)).toThrow();
  });
});
