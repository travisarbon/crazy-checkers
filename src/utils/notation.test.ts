import { describe, it, expect } from 'vitest';
import { moveToString, stringToMove, gameMovesToNotation, formatMoveNumber } from './notation';
import { createInitialBoard } from '../engine/board';
import { createAmericanRules } from '../engine/rules';
import { square } from '../engine/types';
import type { BoardState, Move } from '../engine/types';
import { W, B, P, K, buildBoard } from '../engine/test-utils';

// ---------------------------------------------------------------------------
// moveToString
// ---------------------------------------------------------------------------

describe('moveToString', () => {
  describe('simple moves', () => {
    it('opening move 11-15', () => {
      const move: Move = { from: square(11), path: [square(15)], captured: [] };
      expect(moveToString(move)).toBe('11-15');
    });

    it('opening move 9-13', () => {
      const move: Move = { from: square(9), path: [square(13)], captured: [] };
      expect(moveToString(move)).toBe('9-13');
    });

    it('move from square 1 (corner)', () => {
      const move: Move = { from: square(1), path: [square(5)], captured: [] };
      expect(moveToString(move)).toBe('1-5');
    });

    it('move from square 32 (corner)', () => {
      const move: Move = { from: square(32), path: [square(28)], captured: [] };
      expect(moveToString(move)).toBe('32-28');
    });

    it('move to square 28 has no leading zero', () => {
      const move: Move = { from: square(24), path: [square(28)], captured: [] };
      expect(moveToString(move)).toBe('24-28');
    });
  });

  describe('single jumps', () => {
    it('single jump 22x15', () => {
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      expect(moveToString(move)).toBe('22x15');
    });

    it('single jump from edge square', () => {
      const move: Move = { from: square(5), path: [square(14)], captured: [square(9)] };
      expect(moveToString(move)).toBe('5x14');
    });

    it('single jump to edge square', () => {
      const move: Move = { from: square(14), path: [square(5)], captured: [square(9)] };
      expect(moveToString(move)).toBe('14x5');
    });
  });

  describe('multi-jumps', () => {
    it('double jump 9x18x25', () => {
      const move: Move = {
        from: square(9),
        path: [square(18), square(25)],
        captured: [square(14), square(22)],
      };
      expect(moveToString(move)).toBe('9x18x25');
    });

    it('triple jump 2x9x18x25', () => {
      const move: Move = {
        from: square(2),
        path: [square(9), square(18), square(25)],
        captured: [square(6), square(14), square(22)],
      };
      expect(moveToString(move)).toBe('2x9x18x25');
    });

    it('double jump with direction change', () => {
      const move: Move = {
        from: square(15),
        path: [square(22), square(13)],
        captured: [square(18), square(17)],
      };
      expect(moveToString(move)).toBe('15x22x13');
    });
  });

  describe('consistency', () => {
    it('captured array does not appear in the notation string', () => {
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      const notation = moveToString(move);
      expect(notation).not.toContain('18');
    });

    it('simple move always uses dash, never x', () => {
      const move: Move = { from: square(11), path: [square(15)], captured: [] };
      expect(moveToString(move)).toContain('-');
      expect(moveToString(move)).not.toContain('x');
    });

    it('jump always uses x, never dash', () => {
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      expect(moveToString(move)).toContain('x');
      expect(moveToString(move)).not.toContain('-');
    });
  });
});

// ---------------------------------------------------------------------------
// stringToMove
// ---------------------------------------------------------------------------

describe('stringToMove', () => {
  describe('simple moves', () => {
    it('"11-15" produces correct Move', () => {
      const board = createInitialBoard();
      const move = stringToMove('11-15', board);
      expect(move.from).toBe(square(11));
      expect(move.path).toEqual([square(15)]);
      expect(move.captured).toEqual([]);
    });

    it('"9-13" produces correct Move', () => {
      const board = createInitialBoard();
      const move = stringToMove('9-13', board);
      expect(move.from).toBe(square(9));
      expect(move.path).toEqual([square(13)]);
      expect(move.captured).toEqual([]);
    });
  });

  describe('single jumps', () => {
    it('"22x15" produces Move with correct captured square', () => {
      // Place a white piece on 22 and a black piece on 18 (the midpoint)
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const move = stringToMove('22x15', board);
      expect(move.from).toBe(square(22));
      expect(move.path).toEqual([square(15)]);
      expect(move.captured).toEqual([square(18)]);
    });

    it('captured square is the diagonal midpoint', () => {
      // 24 -> 15: midpoint should be 19
      const board = buildBoard([
        { sq: 24, color: W, type: P },
        { sq: 19, color: B, type: P },
      ]);
      const move = stringToMove('24x15', board);
      expect(move.captured).toEqual([square(19)]);
    });
  });

  describe('multi-jumps', () => {
    it('"9x18x25" produces correct from, path, and captured', () => {
      const board = buildBoard([
        { sq: 9, color: B, type: K },
        { sq: 14, color: W, type: P },
        { sq: 22, color: W, type: P },
      ]);
      const move = stringToMove('9x18x25', board);
      expect(move.from).toBe(square(9));
      expect(move.path).toEqual([square(18), square(25)]);
      expect(move.captured).toEqual([square(14), square(22)]);
    });

    it('"2x9x18x25" produces Move with 3 captured squares', () => {
      const board = buildBoard([
        { sq: 2, color: B, type: K },
        { sq: 6, color: W, type: P },
        { sq: 14, color: W, type: P },
        { sq: 22, color: W, type: P },
      ]);
      const move = stringToMove('2x9x18x25', board);
      expect(move.from).toBe(square(2));
      expect(move.path).toEqual([square(9), square(18), square(25)]);
      expect(move.captured).toHaveLength(3);
    });

    it('each captured square is the correct diagonal midpoint', () => {
      const board = buildBoard([
        { sq: 2, color: B, type: K },
        { sq: 6, color: W, type: P },
        { sq: 14, color: W, type: P },
        { sq: 22, color: W, type: P },
      ]);
      const move = stringToMove('2x9x18x25', board);
      expect(move.captured).toEqual([square(6), square(14), square(22)]);
    });
  });

  describe('error handling', () => {
    const board = createInitialBoard();

    it('throws on empty string', () => {
      expect(() => stringToMove('', board)).toThrow();
    });

    it('throws on single square with no separator', () => {
      expect(() => stringToMove('11', board)).toThrow('at least two squares');
    });

    it('throws on out-of-range square number 0', () => {
      expect(() => stringToMove('0-15', board)).toThrow('not a valid square');
    });

    it('throws on out-of-range square number 33', () => {
      expect(() => stringToMove('33-15', board)).toThrow('not a valid square');
    });

    it('throws on non-numeric content "a-15"', () => {
      expect(() => stringToMove('a-15', board)).toThrow('not a valid square');
    });

    it('throws on non-numeric content "11-b"', () => {
      expect(() => stringToMove('11-b', board)).toThrow('not a valid square');
    });

    it('throws on jump notation where midpoint square is empty', () => {
      // Board with no piece between 22 and 15
      const emptyMidBoard = buildBoard([{ sq: 22, color: W, type: P }]);
      expect(() => stringToMove('22x15', emptyMidBoard)).toThrow('no piece at square');
    });

    it('provides a descriptive error message', () => {
      const emptyMidBoard = buildBoard([{ sq: 22, color: W, type: P }]);
      expect(() => stringToMove('22x15', emptyMidBoard)).toThrow(/between 22 and 15/);
    });
  });

  describe('whitespace tolerance', () => {
    it('" 11 - 15 " parses correctly', () => {
      const board = createInitialBoard();
      const move = stringToMove(' 11 - 15 ', board);
      expect(move.from).toBe(square(11));
      expect(move.path).toEqual([square(15)]);
    });

    it('"22 x 15" parses correctly', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const move = stringToMove('22 x 15', board);
      expect(move.from).toBe(square(22));
      expect(move.path).toEqual([square(15)]);
      expect(move.captured).toEqual([square(18)]);
    });
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests (moveToString <-> stringToMove)
// ---------------------------------------------------------------------------

describe('round-trip (moveToString <-> stringToMove)', () => {
  it('simple move round-trip', () => {
    const board = createInitialBoard();
    expect(moveToString(stringToMove('11-15', board))).toBe('11-15');
  });

  it('single jump round-trip', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    expect(moveToString(stringToMove('22x15', board))).toBe('22x15');
  });

  it('multi-jump round-trip', () => {
    const board = buildBoard([
      { sq: 9, color: B, type: K },
      { sq: 14, color: W, type: P },
      { sq: 22, color: W, type: P },
    ]);
    expect(moveToString(stringToMove('9x18x25', board))).toBe('9x18x25');
  });

  it('reverse round-trip: stringToMove(moveToString(move)) equals original', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const originalMove: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
    const roundTripped = stringToMove(moveToString(originalMove), board);
    expect(roundTripped).toEqual(originalMove);
  });

  it('reverse round-trip for multi-jump', () => {
    const board = buildBoard([
      { sq: 9, color: B, type: K },
      { sq: 14, color: W, type: P },
      { sq: 22, color: W, type: P },
    ]);
    const originalMove: Move = {
      from: square(9),
      path: [square(18), square(25)],
      captured: [square(14), square(22)],
    };
    const roundTripped = stringToMove(moveToString(originalMove), board);
    expect(roundTripped).toEqual(originalMove);
  });

  it('Old Fourteenth opening round-trip: 11-15, 23-19, 8-11, 22-17', () => {
    const ruleSet = createAmericanRules();
    const notations = ['11-15', '23-19', '8-11', '22-17'];
    let board: BoardState = createInitialBoard();

    for (const notation of notations) {
      const move = stringToMove(notation, board);
      // Verify round-trip
      expect(moveToString(move)).toBe(notation);
      // Advance board
      board = ruleSet.applyMove(board, move);
    }

    // After: 1. 11-15  2. 23-19  3. 8-11  4. 22-17
    expect(board[15 - 1]).not.toBeNull(); // sq 15: White pawn (moved from 11 on move 1)
    expect(board[19 - 1]).not.toBeNull(); // sq 19: Black pawn (moved from 23 on move 2)
    expect(board[11 - 1]).not.toBeNull(); // sq 11: White pawn (moved from 8 on move 3)
    expect(board[17 - 1]).not.toBeNull(); // sq 17: Black pawn (moved from 22 on move 4)
  });
});

// ---------------------------------------------------------------------------
// gameMovesToNotation
// ---------------------------------------------------------------------------

describe('gameMovesToNotation', () => {
  it('empty move list produces empty array', () => {
    expect(gameMovesToNotation([])).toEqual([]);
  });

  it('array of 4 moves produces 4 notation strings in order', () => {
    const moves: Move[] = [
      { from: square(11), path: [square(15)], captured: [] },
      { from: square(23), path: [square(19)], captured: [] },
      { from: square(8), path: [square(11)], captured: [] },
      { from: square(22), path: [square(17)], captured: [] },
    ];
    const result = gameMovesToNotation(moves);
    expect(result).toEqual(['11-15', '23-19', '8-11', '22-17']);
  });

  it('each string matches moveToString applied individually', () => {
    const moves: Move[] = [
      { from: square(11), path: [square(15)], captured: [] },
      { from: square(22), path: [square(15)], captured: [square(18)] },
    ];
    const result = gameMovesToNotation(moves);
    expect(result[0]).toBe(moveToString(moves[0] as Move));
    expect(result[1]).toBe(moveToString(moves[1] as Move));
  });
});

// ---------------------------------------------------------------------------
// formatMoveNumber
// ---------------------------------------------------------------------------

describe('formatMoveNumber', () => {
  it('plyIndex 0 → "1. <notation>" (White\'s first move)', () => {
    expect(formatMoveNumber(0, '11-15')).toBe('1. 11-15');
  });

  it('plyIndex 1 → "<notation>" (Black\'s first move, no number)', () => {
    expect(formatMoveNumber(1, '23-19')).toBe('23-19');
  });

  it('plyIndex 2 → "2. <notation>" (White\'s second move)', () => {
    expect(formatMoveNumber(2, '8-11')).toBe('2. 8-11');
  });

  it('plyIndex 3 → "<notation>" (Black\'s second move)', () => {
    expect(formatMoveNumber(3, '22-17')).toBe('22-17');
  });

  it('plyIndex 10 → "6. <notation>"', () => {
    expect(formatMoveNumber(10, '1-5')).toBe('6. 1-5');
  });
});
