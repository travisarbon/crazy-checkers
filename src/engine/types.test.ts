import { describe, it, expect } from 'vitest';
import { square, opponentColor, PieceColor } from './types';

describe('square() factory', () => {
  it('creates a Square from valid numbers 1–32', () => {
    for (let i = 1; i <= 32; i++) {
      expect(square(i)).toBe(i);
    }
  });

  it('throws RangeError for 0', () => {
    expect(() => square(0)).toThrow(RangeError);
  });

  it('throws RangeError for 33', () => {
    expect(() => square(33)).toThrow(RangeError);
  });

  it('throws RangeError for negative numbers', () => {
    expect(() => square(-1)).toThrow(RangeError);
  });

  it('throws RangeError for non-integers', () => {
    expect(() => square(1.5)).toThrow(RangeError);
  });
});

describe('opponentColor()', () => {
  it('returns Black for White', () => {
    expect(opponentColor(PieceColor.White)).toBe(PieceColor.Black);
  });

  it('returns White for Black', () => {
    expect(opponentColor(PieceColor.Black)).toBe(PieceColor.White);
  });
});
