import { describe, it, expect } from 'vitest';
import { PieceColor } from '../engine/types';
import {
  calculatePuzzleRating,
  puzzleColorToPieceColor,
  formatTime,
  formatPreciseTime,
} from './challengeGameUtils';

describe('calculatePuzzleRating', () => {
  it('returns 3 for time <= thresholdFast', () => {
    expect(calculatePuzzleRating(5000, 6000, 15000)).toBe(3);
  });

  it('returns 2 for time between thresholds', () => {
    expect(calculatePuzzleRating(10000, 6000, 15000)).toBe(2);
  });

  it('returns 1 for time > thresholdSlow', () => {
    expect(calculatePuzzleRating(20000, 6000, 15000)).toBe(1);
  });

  it('returns 3 for time exactly at thresholdFast', () => {
    expect(calculatePuzzleRating(6000, 6000, 15000)).toBe(3);
  });

  it('returns 2 for time exactly at thresholdSlow', () => {
    expect(calculatePuzzleRating(15000, 6000, 15000)).toBe(2);
  });
});

describe('puzzleColorToPieceColor', () => {
  it('maps white correctly', () => {
    expect(puzzleColorToPieceColor('white')).toBe(PieceColor.White);
  });

  it('maps black correctly', () => {
    expect(puzzleColorToPieceColor('black')).toBe(PieceColor.Black);
  });
});

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats seconds with padding', () => {
    expect(formatTime(5000)).toBe('0:05');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(65000)).toBe('1:05');
  });

  it('formats double-digit minutes', () => {
    expect(formatTime(600000)).toBe('10:00');
  });
});

describe('formatPreciseTime', () => {
  it('includes tenths', () => {
    expect(formatPreciseTime(65400)).toBe('1:05.4');
  });

  it('formats zero', () => {
    expect(formatPreciseTime(0)).toBe('0:00.0');
  });

  it('rounds tenths down', () => {
    expect(formatPreciseTime(5990)).toBe('0:05.9');
  });
});
