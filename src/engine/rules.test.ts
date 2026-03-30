import { describe, it, expect } from 'vitest';
import { createAmericanRules } from './rules';
import type { RuleSet } from './rules';
import { createInitialBoard, getBoardSquare } from './board';
import {
  GameEndReason,
  GameResultType,
  square,
} from './types';
import type { BoardState, Move } from './types';
import { W, B, P, K, emptyBoard, buildBoard } from './test-utils';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let rules: RuleSet;

// Fresh instance per describe block isn't strictly necessary (AmericanRules is
// stateless), but it's good hygiene.
function setup(): RuleSet {
  return createAmericanRules();
}

// ===========================================================================
// applyMove
// ===========================================================================

describe('AmericanRules.applyMove', () => {
  describe('simple moves', () => {
    it('white pawn moves forward: piece on destination, origin empty', () => {
      rules = setup();
      // White pawn on 22 (row5,col2) → simple move to 18 (row4,col3)
      const board = buildBoard([{ sq: 22, color: W, type: P }]);
      const move: Move = { from: square(22), path: [square(18)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(22))).toBeNull();
      expect(getBoardSquare(newBoard, square(18))).toEqual({ color: W, type: P });
    });

    it('black pawn moves forward: piece on destination, origin empty', () => {
      rules = setup();
      const board = buildBoard([{ sq: 10, color: B, type: P }]);
      const move: Move = { from: square(10), path: [square(14)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(10))).toBeNull();
      expect(getBoardSquare(newBoard, square(14))).toEqual({ color: B, type: P });
    });

    it('king moves backward: piece on destination, origin empty', () => {
      rules = setup();
      const board = buildBoard([{ sq: 14, color: W, type: K }]);
      const move: Move = { from: square(14), path: [square(18)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(14))).toBeNull();
      expect(getBoardSquare(newBoard, square(18))).toEqual({ color: W, type: K });
    });

    it('returns a new array (not the same reference)', () => {
      rules = setup();
      const board = buildBoard([{ sq: 22, color: W, type: P }]);
      const move: Move = { from: square(22), path: [square(18)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(newBoard).not.toBe(board);
    });

    it('does not mutate the input board', () => {
      rules = setup();
      const board = buildBoard([{ sq: 22, color: W, type: P }]);
      const originalPiece = getBoardSquare(board, square(22));
      const move: Move = { from: square(22), path: [square(18)], captured: [] };
      rules.applyMove(board, move);

      // Original board is unchanged
      expect(getBoardSquare(board, square(22))).toEqual(originalPiece);
      expect(getBoardSquare(board, square(18))).toBeNull();
    });
  });

  describe('single jumps', () => {
    it('piece on destination, origin empty, captured piece removed', () => {
      rules = setup();
      // White on 22 jumps over black on 18 → lands on 15
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(22))).toBeNull();
      expect(getBoardSquare(newBoard, square(18))).toBeNull();
      expect(getBoardSquare(newBoard, square(15))).toEqual({ color: W, type: P });
    });

    it('jumping piece retains its color and type', () => {
      rules = setup();
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 18, color: B, type: P },
      ]);
      const move: Move = { from: square(14), path: [square(23)], captured: [square(18)] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(23))).toEqual({ color: W, type: K });
    });
  });

  describe('multi-jumps', () => {
    it('2-jump chain: origin empty, both captured squares empty, piece on final destination', () => {
      rules = setup();
      // White on 22 → 15 (over 18) → 6 (over 10)
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const move: Move = {
        from: square(22),
        path: [square(15), square(6)],
        captured: [square(18), square(10)],
      };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(22))).toBeNull();
      expect(getBoardSquare(newBoard, square(18))).toBeNull();
      expect(getBoardSquare(newBoard, square(10))).toBeNull();
      expect(getBoardSquare(newBoard, square(15))).toBeNull(); // intermediate, not final
      expect(getBoardSquare(newBoard, square(6))).toEqual({ color: W, type: P });
    });

    it('3-jump chain: all captured squares empty, piece on final destination', () => {
      rules = setup();
      // White on 26 → 17(over22) → 10(over14) → 1(over6) — promotion
      const board = buildBoard([
        { sq: 26, color: W, type: P },
        { sq: 22, color: B, type: P },
        { sq: 14, color: B, type: P },
        { sq: 6, color: B, type: P },
      ]);
      const move: Move = {
        from: square(26),
        path: [square(17), square(10), square(1)],
        captured: [square(22), square(14), square(6)],
      };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(26))).toBeNull();
      expect(getBoardSquare(newBoard, square(22))).toBeNull();
      expect(getBoardSquare(newBoard, square(14))).toBeNull();
      expect(getBoardSquare(newBoard, square(6))).toBeNull();
      expect(getBoardSquare(newBoard, square(17))).toBeNull();
      expect(getBoardSquare(newBoard, square(10))).toBeNull();
      // Landed on row 0 → promoted to king
      expect(getBoardSquare(newBoard, square(1))).toEqual({ color: W, type: K });
    });
  });

  describe('promotion', () => {
    it('white pawn landing on square 1 (row 0) becomes a white king', () => {
      rules = setup();
      const board = buildBoard([{ sq: 5, color: W, type: P }]);
      const move: Move = { from: square(5), path: [square(1)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(1))).toEqual({ color: W, type: K });
    });

    it('white pawn landing on square 4 (row 0) becomes a white king', () => {
      rules = setup();
      const board = buildBoard([{ sq: 8, color: W, type: P }]);
      const move: Move = { from: square(8), path: [square(4)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(4))).toEqual({ color: W, type: K });
    });

    it('black pawn landing on square 29 (row 7) becomes a black king', () => {
      rules = setup();
      const board = buildBoard([{ sq: 25, color: B, type: P }]);
      const move: Move = { from: square(25), path: [square(29)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(29))).toEqual({ color: B, type: K });
    });

    it('black pawn landing on square 32 (row 7) becomes a black king', () => {
      rules = setup();
      const board = buildBoard([{ sq: 28, color: B, type: P }]);
      const move: Move = { from: square(28), path: [square(32)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(32))).toEqual({ color: B, type: K });
    });

    it('white pawn landing on square 5 (row 1, not king row) stays a pawn', () => {
      rules = setup();
      const board = buildBoard([{ sq: 9, color: W, type: P }]);
      const move: Move = { from: square(9), path: [square(5)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(5))).toEqual({ color: W, type: P });
    });

    it('king landing on king row does not change (already a king)', () => {
      rules = setup();
      const board = buildBoard([{ sq: 5, color: W, type: K }]);
      const move: Move = { from: square(5), path: [square(1)], captured: [] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(1))).toEqual({ color: W, type: K });
    });

    it('pawn jump-capturing onto king row: promoted AND captured piece removed', () => {
      rules = setup();
      // White on 9, black on 6. Jump to 2 (row 0).
      const board = buildBoard([
        { sq: 9, color: W, type: P },
        { sq: 6, color: B, type: P },
      ]);
      const move: Move = { from: square(9), path: [square(2)], captured: [square(6)] };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(9))).toBeNull();
      expect(getBoardSquare(newBoard, square(6))).toBeNull();
      expect(getBoardSquare(newBoard, square(2))).toEqual({ color: W, type: K });
    });

    it('pawn multi-jump ending on king row: promoted to king', () => {
      rules = setup();
      // White on 18 → 11(over15) → 2(over7) — row 0 = promotion
      const board = buildBoard([
        { sq: 18, color: W, type: P },
        { sq: 15, color: B, type: P },
        { sq: 7, color: B, type: P },
      ]);
      const move: Move = {
        from: square(18),
        path: [square(11), square(2)],
        captured: [square(15), square(7)],
      };
      const newBoard = rules.applyMove(board, move);

      expect(getBoardSquare(newBoard, square(2))).toEqual({ color: W, type: K });
      expect(getBoardSquare(newBoard, square(15))).toBeNull();
      expect(getBoardSquare(newBoard, square(7))).toBeNull();
    });
  });

  describe('error handling', () => {
    it('throws when called with a move from an empty square', () => {
      rules = setup();
      const board = emptyBoard();
      const move: Move = { from: square(14), path: [square(10)], captured: [] };

      expect(() => rules.applyMove(board, move)).toThrow('no piece at square');
    });

    it('throws when move has an empty path', () => {
      rules = setup();
      const board = buildBoard([{ sq: 14, color: W, type: P }]);
      const move: Move = { from: square(14), path: [], captured: [] };

      expect(() => rules.applyMove(board, move)).toThrow('empty path');
    });
  });
});

// ===========================================================================
// checkGameOver
// ===========================================================================

describe('AmericanRules.checkGameOver', () => {
  describe('game continues', () => {
    it('initial board, White turn: returns null', () => {
      rules = setup();
      const board = createInitialBoard();
      expect(rules.checkGameOver(board, W)).toBeNull();
    });

    it('mid-game position with moves available: returns null', () => {
      rules = setup();
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 18, color: B, type: P },
      ]);
      expect(rules.checkGameOver(board, W)).toBeNull();
      expect(rules.checkGameOver(board, B)).toBeNull();
    });
  });

  describe('win by no pieces', () => {
    it('only white pieces, Black turn: WhiteWin / NoPiecesLeft', () => {
      rules = setup();
      const board = buildBoard([{ sq: 14, color: W, type: K }]);
      const result = rules.checkGameOver(board, B);

      expect(result).toEqual({
        type: GameResultType.WhiteWin,
        reason: GameEndReason.NoPiecesLeft,
      });
    });

    it('only black pieces, White turn: BlackWin / NoPiecesLeft', () => {
      rules = setup();
      const board = buildBoard([{ sq: 14, color: B, type: K }]);
      const result = rules.checkGameOver(board, W);

      expect(result).toEqual({
        type: GameResultType.BlackWin,
        reason: GameEndReason.NoPiecesLeft,
      });
    });
  });

  describe('win by no legal moves (blocked)', () => {
    it('single white pawn blocked: BlackWin / NoLegalMoves', () => {
      rules = setup();
      // White pawn on 4 (row 0) — no forward moves for a pawn on row 0
      const board = buildBoard([{ sq: 4, color: W, type: P }]);
      const result = rules.checkGameOver(board, W);

      expect(result).toEqual({
        type: GameResultType.BlackWin,
        reason: GameEndReason.NoLegalMoves,
      });
    });

    it('single piece with no legal moves: WhiteWin / NoLegalMoves', () => {
      rules = setup();
      // Black pawn on 32 (row7,col6 — black's king row).
      // Black pawns move backward (toward row 7), but row 7 is already the edge.
      // BL→row8→off board. BR→row8→off board. No legal moves.
      // (In a real game this pawn would have been promoted, but the
      // test verifies checkGameOver handles the blocked case.)
      const board = buildBoard([
        { sq: 32, color: B, type: P },
        { sq: 14, color: W, type: K }, // white piece so we don't get NoPiecesLeft for white
      ]);
      const result = rules.checkGameOver(board, B);

      expect(result).toEqual({
        type: GameResultType.WhiteWin,
        reason: GameEndReason.NoLegalMoves,
      });
    });
  });

  describe('active player has moves — game continues', () => {
    it('active player has moves even if opponent has no pieces: returns null', () => {
      rules = setup();
      // Only white pieces, White's turn — White has moves, game continues
      const board = buildBoard([{ sq: 14, color: W, type: K }]);
      expect(rules.checkGameOver(board, W)).toBeNull();
    });
  });

  describe('empty board', () => {
    it('empty board, White turn: BlackWin / NoPiecesLeft', () => {
      rules = setup();
      expect(rules.checkGameOver(emptyBoard(), W)).toEqual({
        type: GameResultType.BlackWin,
        reason: GameEndReason.NoPiecesLeft,
      });
    });

    it('empty board, Black turn: WhiteWin / NoPiecesLeft', () => {
      rules = setup();
      expect(rules.checkGameOver(emptyBoard(), B)).toEqual({
        type: GameResultType.WhiteWin,
        reason: GameEndReason.NoPiecesLeft,
      });
    });
  });
});

// ===========================================================================
// shouldPromote
// ===========================================================================

describe('AmericanRules.shouldPromote', () => {
  rules = setup();

  it('white pawn on square 1: true', () => {
    expect(rules.shouldPromote({ color: W, type: P }, square(1))).toBe(true);
  });

  it('white pawn on square 4: true', () => {
    expect(rules.shouldPromote({ color: W, type: P }, square(4))).toBe(true);
  });

  it('white pawn on square 5: false', () => {
    expect(rules.shouldPromote({ color: W, type: P }, square(5))).toBe(false);
  });

  it('black pawn on square 29: true', () => {
    expect(rules.shouldPromote({ color: B, type: P }, square(29))).toBe(true);
  });

  it('black pawn on square 32: true', () => {
    expect(rules.shouldPromote({ color: B, type: P }, square(32))).toBe(true);
  });

  it('black pawn on square 28: false', () => {
    expect(rules.shouldPromote({ color: B, type: P }, square(28))).toBe(false);
  });

  it('white king on square 1: false (already a king)', () => {
    expect(rules.shouldPromote({ color: W, type: K }, square(1))).toBe(false);
  });

  it('black king on square 29: false (already a king)', () => {
    expect(rules.shouldPromote({ color: B, type: K }, square(29))).toBe(false);
  });
});

// ===========================================================================
// getLegalMoves (delegation)
// ===========================================================================

describe('AmericanRules.getLegalMoves', () => {
  it('initial board, White turn: returns 7 moves', () => {
    rules = setup();
    const moves = rules.getLegalMoves(createInitialBoard(), W);
    expect(moves).toHaveLength(7);
  });

  it('initial board, Black turn: returns 7 moves', () => {
    rules = setup();
    const moves = rules.getLegalMoves(createInitialBoard(), B);
    expect(moves).toHaveLength(7);
  });

  it('position with forced jumps: returns only jumps', () => {
    rules = setup();
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 24, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const moves = rules.getLegalMoves(board, W);
    expect(moves.every((m) => m.captured.length > 0)).toBe(true);
  });
});

// ===========================================================================
// Integration: full move sequences
// ===========================================================================

describe('move sequence integration', () => {
  it('opening 4 moves: 11-15, 23-19, 8-11, 22-17', () => {
    rules = setup();
    let board: BoardState = createInitialBoard();

    // Move 1: Black 11-15 (sq11 → sq15)
    // sq 11 (row2,col5). BL→row3,col4=sq15.
    const m1: Move = { from: square(11), path: [square(15)], captured: [] };
    board = rules.applyMove(board, m1);
    expect(getBoardSquare(board, square(11))).toBeNull();
    expect(getBoardSquare(board, square(15))).toEqual({ color: B, type: P });

    // Move 2: White 23-19 (sq23 → sq19)
    // sq 23 (row5,col4). FL→row4,col3=sq18... wait, need FR→row4,col5=sq19.
    const m2: Move = { from: square(23), path: [square(19)], captured: [] };
    board = rules.applyMove(board, m2);
    expect(getBoardSquare(board, square(23))).toBeNull();
    expect(getBoardSquare(board, square(19))).toEqual({ color: W, type: P });

    // Move 3: Black 8-11 (sq8 → sq11)
    const m3: Move = { from: square(8), path: [square(11)], captured: [] };
    board = rules.applyMove(board, m3);
    expect(getBoardSquare(board, square(8))).toBeNull();
    expect(getBoardSquare(board, square(11))).toEqual({ color: B, type: P });

    // Move 4: White 22-17 (sq22 → sq17)
    const m4: Move = { from: square(22), path: [square(17)], captured: [] };
    board = rules.applyMove(board, m4);
    expect(getBoardSquare(board, square(22))).toBeNull();
    expect(getBoardSquare(board, square(17))).toEqual({ color: W, type: P });
  });

  it('first capture: apply a forced jump and verify board state', () => {
    rules = setup();
    // Set up a position after some moves where a capture is forced
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 1, color: B, type: P }, // unrelated piece
    ]);
    const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
    const newBoard = rules.applyMove(board, move);

    expect(getBoardSquare(newBoard, square(22))).toBeNull();
    expect(getBoardSquare(newBoard, square(18))).toBeNull();
    expect(getBoardSquare(newBoard, square(15))).toEqual({ color: W, type: P });
    // Unrelated piece untouched
    expect(getBoardSquare(newBoard, square(1))).toEqual({ color: B, type: P });
  });

  it('promotion sequence: advance pawn to king row, verify king moves backward', () => {
    rules = setup();
    // White pawn on sq 5 (row 1). Move to sq 1 (row 0) → promoted.
    const board = buildBoard([
      { sq: 5, color: W, type: P },
      { sq: 14, color: B, type: P }, // unrelated
    ]);

    const promoteMove: Move = { from: square(5), path: [square(1)], captured: [] };
    const afterPromo = rules.applyMove(board, promoteMove);
    expect(getBoardSquare(afterPromo, square(1))).toEqual({ color: W, type: K });

    // Now the king on sq 1 (row0,col1) should be able to move backward.
    // BL→row1,col0=sq5. BR→row1,col2=sq6.
    const kingMoves = rules.getLegalMoves(afterPromo, W);
    expect(kingMoves.length).toBeGreaterThan(0);
    // At least one move should go to a higher-numbered square (backward)
    const hasBackward = kingMoves.some((m) => (m.path[0] as number) > (m.from as number));
    expect(hasBackward).toBe(true);
  });

  it('game to completion: play until one side has no pieces', () => {
    rules = setup();
    // Set up a near-endgame: white king on 14 can capture black pawn on 18 → 23.
    // After capture, black has no pieces → game over.
    let board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 18, color: B, type: P },
    ]);

    // White's turn — should not be over yet
    expect(rules.checkGameOver(board, W)).toBeNull();

    // Apply the capture
    const move: Move = { from: square(14), path: [square(23)], captured: [square(18)] };
    board = rules.applyMove(board, move);

    // Now it's Black's turn — Black has no pieces
    const result = rules.checkGameOver(board, B);
    expect(result).toEqual({
      type: GameResultType.WhiteWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('multi-jump promotion: pawn multi-jump ending on king row', () => {
    rules = setup();
    // White on 18 → 11(over15) → 2(over7) — row 0 promotion
    const board = buildBoard([
      { sq: 18, color: W, type: P },
      { sq: 15, color: B, type: P },
      { sq: 7, color: B, type: P },
    ]);
    const move: Move = {
      from: square(18),
      path: [square(11), square(2)],
      captured: [square(15), square(7)],
    };
    const newBoard = rules.applyMove(board, move);

    expect(getBoardSquare(newBoard, square(18))).toBeNull();
    expect(getBoardSquare(newBoard, square(15))).toBeNull();
    expect(getBoardSquare(newBoard, square(7))).toBeNull();
    expect(getBoardSquare(newBoard, square(11))).toBeNull();
    expect(getBoardSquare(newBoard, square(2))).toEqual({ color: W, type: K });
  });
});
