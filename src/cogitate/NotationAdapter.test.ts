import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '../engine/board';
import { square } from '../engine/types';
import type { Move } from '../engine/types';
import { CheckersNotationAdapter, getCheckersNotationAdapter } from './NotationAdapter';

describe('CheckersNotationAdapter', () => {
  const adapter = new CheckersNotationAdapter();
  const board = createInitialBoard();

  it('formats simple moves with dash separator', () => {
    const move: Move = { from: square(11), path: [square(15)], captured: [] };
    expect(adapter.moveToString(move, board)).toBe('11-15');
  });

  it('formats capture moves with x separator', () => {
    const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
    expect(adapter.moveToString(move, board)).toBe('22x15');
  });

  it('round-trips simple notation through stringToMove', () => {
    const parsed = adapter.stringToMove('11-15', board);
    expect(parsed).not.toBeNull();
    expect(parsed?.from).toBe(11);
    expect(parsed?.path[0]).toBe(15);
    expect(parsed?.captured).toEqual([]);
  });

  it('returns null for malformed notation instead of throwing', () => {
    expect(adapter.stringToMove('gibberish', board)).toBeNull();
    expect(adapter.stringToMove('99-100', board)).toBeNull();
  });

  it('formats move numbers for white (even ply) with prefix', () => {
    expect(adapter.formatMoveNumber(0, '11-15')).toBe('1. 11-15');
    expect(adapter.formatMoveNumber(2, '9-13')).toBe('2. 9-13');
  });

  it('formats move numbers for black (odd ply) without prefix', () => {
    expect(adapter.formatMoveNumber(1, '22-18')).toBe('22-18');
  });

  it('exposes a shared instance via getCheckersNotationAdapter', () => {
    const a = getCheckersNotationAdapter();
    const b = getCheckersNotationAdapter();
    expect(a).toBe(b);
  });
});
