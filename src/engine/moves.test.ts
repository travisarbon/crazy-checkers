import { describe, it, expect } from 'vitest';
import {
  getSimpleMovesForPiece,
  getJumpsForPiece,
  getLegalMoves,
  getLegalMovesForPiece,
  getMovesToSquare,
} from './moves';
import { createInitialBoard } from './board';
import { square } from './types';
import type { Move } from './types';
import { W, B, P, K, emptyBoard, buildBoard } from './test-utils';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Returns the set of final destination squares from a list of moves. */
function destinations(moves: Move[]): number[] {
  return moves.map((m) => m.path[m.path.length - 1] as number).sort((a, b) => a - b);
}


// ===========================================================================
// getSimpleMovesForPiece
// ===========================================================================

describe('getSimpleMovesForPiece', () => {
  describe('white pawns', () => {
    it('returns 2 moves from a center opening-row square', () => {
      // White pawn on sq 22 (row 5, col 2) — forward-left=sq 17, forward-right=sq 18
      const board = buildBoard([{ sq: 22, color: W, type: P }]);
      const moves = getSimpleMovesForPiece(board, square(22));
      expect(moves).toHaveLength(2);
      expect(destinations(moves)).toEqual([17, 18]);
    });

    it('returns 1 move from a left-edge square', () => {
      // White pawn on sq 21 (row 5, col 0) — forward-left off board, forward-right=sq 17
      const board = buildBoard([{ sq: 21, color: W, type: P }]);
      const moves = getSimpleMovesForPiece(board, square(21));
      expect(moves).toHaveLength(1);
      expect(destinations(moves)).toEqual([17]);
    });

    it('returns 1 move from a right-edge square', () => {
      // White pawn on sq 28 (row6, col7) — forward-left=sq24, forward-right off board
      const board = buildBoard([{ sq: 28, color: W, type: P }]);
      const moves = getSimpleMovesForPiece(board, square(28));
      expect(moves).toHaveLength(1);
      expect(destinations(moves)).toEqual([24]);
    });

    it('returns 0 moves when both forward squares are occupied', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 17, color: B, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const moves = getSimpleMovesForPiece(board, square(22));
      expect(moves).toHaveLength(0);
    });

    it('does not return backward moves', () => {
      // White pawn on sq 14 (row 3, col 2) — only forward moves
      const board = buildBoard([{ sq: 14, color: W, type: P }]);
      const moves = getSimpleMovesForPiece(board, square(14));
      // Forward-left=sq 10, forward-right=sq 11
      expect(moves).toHaveLength(2);
      for (const m of moves) {
        // All destinations should be lower square numbers (toward row 0)
        expect(m.path[0] as number).toBeLessThan(14);
      }
    });
  });

  describe('black pawns', () => {
    it('returns 2 moves from a center opening-row square', () => {
      // Black pawn on sq 10 (row 2, col 2) — backward-left=sq 14, backward-right=sq 15
      const board = buildBoard([{ sq: 10, color: B, type: P }]);
      const moves = getSimpleMovesForPiece(board, square(10));
      expect(moves).toHaveLength(2);
      expect(destinations(moves)).toEqual([14, 15]);
    });

    it('returns 0 moves when both forward squares are occupied', () => {
      const board = buildBoard([
        { sq: 10, color: B, type: P },
        { sq: 14, color: W, type: P },
        { sq: 15, color: W, type: P },
      ]);
      const moves = getSimpleMovesForPiece(board, square(10));
      expect(moves).toHaveLength(0);
    });

    it('does not return backward (toward row 0) moves', () => {
      const board = buildBoard([{ sq: 14, color: B, type: P }]);
      const moves = getSimpleMovesForPiece(board, square(14));
      for (const m of moves) {
        expect(m.path[0] as number).toBeGreaterThan(14);
      }
    });
  });

  describe('kings', () => {
    it('returns up to 4 moves from a center square with all diagonals empty', () => {
      const board = buildBoard([{ sq: 14, color: W, type: K }]);
      const moves = getSimpleMovesForPiece(board, square(14));
      expect(moves).toHaveLength(4);
    });

    it('returns moves in both forward and backward directions', () => {
      const board = buildBoard([{ sq: 14, color: W, type: K }]);
      const moves = getSimpleMovesForPiece(board, square(14));
      const dests = destinations(moves);
      // Should have squares both less than and greater than 14
      expect(dests.some((d) => d < 14)).toBe(true);
      expect(dests.some((d) => d > 14)).toBe(true);
    });

    it('returns 0 moves when all adjacent squares are occupied', () => {
      // sq 14 (row3, col2) has neighbors at 9, 10, 17, 18
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 9, color: W, type: P },
        { sq: 10, color: W, type: P },
        { sq: 17, color: B, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const moves = getSimpleMovesForPiece(board, square(14));
      expect(moves).toHaveLength(0);
    });
  });

  describe('empty square', () => {
    it('returns empty array when called on an empty square', () => {
      const board = emptyBoard();
      const moves = getSimpleMovesForPiece(board, square(14));
      expect(moves).toHaveLength(0);
    });
  });
});

// ===========================================================================
// getJumpsForPiece
// ===========================================================================

describe('getJumpsForPiece', () => {
  describe('single jumps', () => {
    it('white pawn jumps forward-left over a black piece', () => {
      // White on 22 (row5,col2), Black on 18 (row4,col2) → land on 15 (row3,col2)
      // Wait, need to verify: sq 22 row5,col2. FL → row4,col1 = sq 17. Jump target → row3,col0 = sq 13
      // Let's use sq 23 (row5,col4). FL → sq 18 (row4,col2)... hmm let me think about this more carefully.
      // sq 22: row=5, col=2 (odd row). FL: row4,col1 = sq 17. Jump: row3,col0 = sq 13.
      // Place black on 17, white on 22 → jump lands on 13.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 17, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(22));
      expect(jumps).toHaveLength(1);
      expect(jumps[0]?.path).toEqual([square(13)]);
      expect(jumps[0]?.captured).toEqual([square(17)]);
    });

    it('white pawn jumps forward-right over a black piece', () => {
      // sq 22 (row5,col2). FR: row4,col3 = sq 18. Jump: row3,col4 = sq 15.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(22));
      expect(jumps).toHaveLength(1);
      expect(jumps[0]?.path).toEqual([square(15)]);
      expect(jumps[0]?.captured).toEqual([square(18)]);
    });

    it('black pawn jumps over a white piece', () => {
      // Black on sq 10 (row2,col2). BL: row3,col1 → sq 14 (row3,col2)...
      // sq 10: row=2, col=2 (even row → cols 1,3,5,7... wait)
      // Actually: row=2, index in row = 10-1 - 2*4 = 1. Even row: col = 1*2+1 = 3.
      // sq 10: row=2, col=3. BL: row3,col2 = sq 14. Jump: row4,col1 = sq 17.
      const board = buildBoard([
        { sq: 10, color: B, type: P },
        { sq: 14, color: W, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(10));
      expect(jumps).toHaveLength(1);
      expect(jumps[0]?.path).toEqual([square(17)]);
      expect(jumps[0]?.captured).toEqual([square(14)]);
    });

    it('returns no jumps when adjacent piece is same color', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 17, color: W, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(22));
      expect(jumps).toHaveLength(0);
    });

    it('returns no jumps when landing square is occupied', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
        { sq: 15, color: B, type: P }, // blocks the landing
      ]);
      const jumps = getJumpsForPiece(board, square(22));
      expect(jumps).toHaveLength(0);
    });

    it('returns no jumps when adjacent square is empty', () => {
      const board = buildBoard([{ sq: 22, color: W, type: P }]);
      const jumps = getJumpsForPiece(board, square(22));
      expect(jumps).toHaveLength(0);
    });

    it('returns no jumps when jump would land off the board', () => {
      // White on sq 5 (row1,col0). Only FR adj = sq 1 (row0,col1). Jump target FL = null (off board).
      // Actually sq 5 FL → null (off board). FR → sq 1. Jump target FR from 5 → row-1 → null.
      const board = buildBoard([
        { sq: 5, color: W, type: P },
        { sq: 1, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(5));
      expect(jumps).toHaveLength(0);
    });
  });

  describe('multi-jumps — linear chain', () => {
    it('white pawn captures 2 pieces in a zig-zag chain', () => {
      // White on 22 (row5,col2). Black on 18(row4,col3). Jump→15(row3,col4).
      // From 15 (row3,col4): FL→row2,col3=sq10. Jump→row1,col2=sq6.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(22));
      expect(jumps).toHaveLength(1);
      expect(jumps[0]?.path).toEqual([square(15), square(6)]);
      expect(jumps[0]?.captured).toEqual([square(18), square(10)]);
    });

    it('chain stops when no further jumps are available', () => {
      // Same as above but without the second black piece
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(22));
      expect(jumps).toHaveLength(1);
      expect(jumps[0]?.path).toEqual([square(15)]);
    });
  });

  describe('multi-jumps — branching', () => {
    it('piece with 2 continuation directions returns 2 separate moves', () => {
      // White on 22 (row5,col2). Black on 18 (row4,col3) → land on 15 (row3,col4).
      // From 15 (row3,col4): FL over 10(row2,col3)→6(row1,col2)
      //                      FR over 11(row2,col5)→8(row1,col6)
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
        { sq: 10, color: B, type: P },
        { sq: 11, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(22));
      expect(jumps).toHaveLength(2);
      const finalSquares = destinations(jumps);
      expect(finalSquares).toEqual([6, 8]);
    });

    it('branches of different lengths are both returned', () => {
      // Branch A: 2 jumps. Branch B: 1 jump (no continuation).
      // White on 22. Black on 18 → land 15. From 15: Black on 10 → land 6 (branch A, 2 hops total).
      // Also Black on 17 from 22: FL → row4,col1=sq17. Jump → row3,col0=sq13 (branch B, 1 hop to 13).
      // From 13: row3,col0. FL→row2,col-1=off board. FR→row2,col1=sq9. Need black on 9 for branch B to continue.
      // Without black on 9, branch B stops at 13.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
        { sq: 17, color: B, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(22));
      // Branch via 18→15→10→6 (length 2) and branch via 17→13 (length 1)
      expect(jumps.length).toBeGreaterThanOrEqual(2);
      const pathLengths = jumps.map((j) => j.path.length).sort();
      expect(pathLengths).toContain(1);
      expect(pathLengths).toContain(2);
    });
  });

  describe('multi-jumps — no re-capture', () => {
    it('a piece cannot jump over the same opponent piece twice', () => {
      // King on 14 (row3,col2). Black on 10 (row2,col3). Jump to 7 (row1,col4).
      // From 7: BL→row2,col3=10 — already captured. Should not re-jump.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 10, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(14));
      // Should have only single jumps, no cycles
      for (const j of jumps) {
        const capturedSet = new Set(j.captured.map((c) => c as number));
        expect(capturedSet.size).toBe(j.captured.length);
      }
    });
  });

  describe('multi-jumps — vacated starting square', () => {
    it('a piece can land on its own starting square during a multi-jump', () => {
      // King on 14 (row3,col2). Set up a loop that returns to 14.
      // 14→jump over 10(row2,col3)→7(row1,col4)→jump over 11(row2,col5)→16(row3,col6)
      // →jump over 19(row4,col5)→23(row5,col4)→jump over 18(row4,col3)→14(row3,col2) ← back to start
      // Verify 14 is reachable as a landing since the king vacated it.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 10, color: B, type: P },
        { sq: 11, color: B, type: P },
        { sq: 19, color: B, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(14));
      // At least one chain should include 14 in its path (returned to start)
      const returnsToStart = jumps.some((j) =>
        j.path.some((s) => (s as number) === 14),
      );
      expect(returnsToStart).toBe(true);
    });
  });

  describe('king jumps', () => {
    it('king can jump in all 4 diagonal directions', () => {
      // King on 14 (row3,col2). Place opponents at all 4 adjacent squares with open landings.
      // FL: adj=10(row2,col3), land=7(row1,col4) — need 7 empty.
      // FR: adj=11(row2,col5)... wait, sq14 FR → row2,col3? Let me recalculate.
      // sq 14: row=3 (odd row), posInRow=1, col=1*2=2. So row3,col2.
      // FL: row2,col1 = sq 9 (even row, posInRow=(1-1)/2=0, sq=2*4+0+1=9). Jump: row1,col0 = sq 5.
      // FR: row2,col3 = sq 10 (even row, posInRow=(3-1)/2=1, sq=2*4+1+1=10). Jump: row1,col4 = sq 7.
      // BL: row4,col1 = sq 17 (even row, posInRow=(1-1)/2=0, sq=4*4+0+1=17). Jump: row5,col0 = sq 21.
      // BR: row4,col3 = sq 18 (even row, posInRow=(3-1)/2=1, sq=4*4+1+1=18). Jump: row5,col4 = sq 23.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 9, color: B, type: P },
        { sq: 10, color: B, type: P },
        { sq: 17, color: B, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(14));
      // Should have multi-jump chains since all 4 directions are jumpable
      expect(jumps.length).toBeGreaterThanOrEqual(4);
    });

    it('king can chain jumps mixing forward and backward directions', () => {
      // King on 14. Black on 10 (FL adj=9, not 10). Let me redo.
      // sq 14 FL adj = sq 9, jump = sq 5. Black on 9 → land 5.
      // From 5 (row1,col0). BR: row2,col1=sq9 — already captured. BL: off board.
      // From 5 FL: row0,col-1 = off board. FR: row0,col1=sq1. Need black on 1? No, just simple.
      // Better test: king on 15 (row3,col4).
      // FL: row2,col3=sq10. Jump: row1,col2=sq6.
      // From 6 (row1,col2): BL: row2,col1=sq9. Jump: row3,col0=sq13. Place black on 9.
      const board = buildBoard([
        { sq: 15, color: W, type: K },
        { sq: 10, color: B, type: P },
        { sq: 9, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(15));
      // Should find a chain: 15→6 (over 10)→13 (over 9) — forward then backward
      const twoHopChain = jumps.find((j) => j.path.length === 2);
      expect(twoHopChain).toBeDefined();
      expect(twoHopChain?.captured).toHaveLength(2);
    });
  });

  describe('pawn direction restrictions', () => {
    it('white pawn cannot jump backward', () => {
      // White pawn on 14 (row3,col2). Black on 18 (row4,col3 — backward-right neighbor).
      // Even though the geometry allows a jump, pawns can't move backward.
      // sq 14 BR: row4,col3=sq18. Jump: row5,col4=sq23.
      const board = buildBoard([
        { sq: 14, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(14));
      expect(jumps).toHaveLength(0);
    });

    it('black pawn cannot jump forward (toward row 0)', () => {
      // Black pawn on 14 (row3,col2). White on 9 (row2,col1 — forward-left neighbor).
      // Black pawns only move backward (toward row 7).
      const board = buildBoard([
        { sq: 14, color: B, type: P },
        { sq: 9, color: W, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(14));
      expect(jumps).toHaveLength(0);
    });
  });

  describe('promotion stop rule', () => {
    it('white pawn reaching row 0 during a multi-jump: chain stops', () => {
      // White pawn on 10 (row2,col3). Black on 6 (row1,col2). Jump to 1 (row0,col1) — king row.
      // If there were another black piece to jump from 1, the chain should NOT continue.
      // sq 10: row2,col3 (even row). FL: row1,col2=sq6. Jump: row0,col1=sq1.
      // Place another black piece that would be jumpable from sq 1 if king movement were allowed.
      // sq 1 (row0,col1): BL: row1,col0=sq5. Jump to row2,col-1 → off board. Not useful.
      // sq 1 BR: row1,col2=sq6 — already captured.
      // Use different setup: White on 11 (row2,col5). Black on 7 (row1,col4). Jump to 2 (row0,col3).
      // From 2 as king: BL→row1,col2=sq6. Black on 6 → jump to 9 (row2,col1).
      const board = buildBoard([
        { sq: 11, color: W, type: P },
        { sq: 7, color: B, type: P },
        { sq: 6, color: B, type: P }, // would be jumpable if piece became king
      ]);
      const jumps = getJumpsForPiece(board, square(11));
      expect(jumps).toHaveLength(1);
      expect(jumps[0]?.path).toEqual([square(2)]); // stops at king row
      expect(jumps[0]?.captured).toEqual([square(7)]);
    });

    it('white pawn reaching row 0 on first jump: returns single-jump move', () => {
      // White on 6 (row1,col2). Black on 2 (row0,col1)... wait, can't jump over to row-1.
      // sq 6 (row1,col2). FL: row0,col1=sq1. Jump: row-1 → off board. Not jumpable.
      // White on 9 (row2,col1). Black on 5 (row1,col0). Jump: row0,col-1 → off board.
      // White on 9 (row2,col1). Black on 6 (row1,col2). Jump: row0,col3=sq2. Yes!
      const board = buildBoard([
        { sq: 9, color: W, type: P },
        { sq: 6, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(9));
      expect(jumps).toHaveLength(1);
      expect(jumps[0]?.path).toEqual([square(2)]);
      expect(jumps[0]?.captured).toEqual([square(6)]);
    });

    it('black pawn reaching row 7 during multi-jump: chain stops', () => {
      // Black on 22 (row5,col2). White on 25 (row6,col0)...
      // sq 22 (row5,col2). BL: row6,col1=sq25. Jump: row7,col0=sq29. King row for black!
      // Place white piece at 25.
      const board = buildBoard([
        { sq: 22, color: B, type: P },
        { sq: 25, color: W, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(22));
      expect(jumps).toHaveLength(1);
      expect(jumps[0]?.path).toEqual([square(29)]);
    });

    it('king passing through row 0 or row 7 mid-chain does NOT stop', () => {
      // White king on 6 (row1,col2). Black on 2 (row0,col1)... can't jump off board.
      // White king on 9 (row2,col1). Black on 6 (row1,col2). Jump to 2 (row0,col3).
      // From 2 as king: BL→row1,col2=sq6 — captured. BR→row1,col4=sq7. If black on 7, jump to 11(row2,col5).
      const board = buildBoard([
        { sq: 9, color: W, type: K },
        { sq: 6, color: B, type: P },
        { sq: 7, color: B, type: P },
      ]);
      const jumps = getJumpsForPiece(board, square(9));
      // Should find a 2-jump chain: 9→2(over 6)→11(over 7), passing through row 0
      const twoHop = jumps.find((j) => j.path.length === 2);
      expect(twoHop).toBeDefined();
      expect(twoHop?.path).toEqual([square(2), square(11)]);
      expect(twoHop?.captured).toEqual([square(6), square(7)]);
    });

    it('pawn multi-jump that reaches king row on second jump stops there', () => {
      // White on 18 (row4,col3). Black on 15 (row3,col4). Jump to 11 (row2,col5).
      // From 11: Black on 7 (row1,col4). Jump to 2 (row0,col3). King row — stop.
      // If there was another capturable piece from 2, pawn should NOT continue.
      const board = buildBoard([
        { sq: 18, color: W, type: P },
        { sq: 15, color: B, type: P },
        { sq: 7, color: B, type: P },
        { sq: 3, color: B, type: P }, // on row 0, would be jumpable by king from sq 2
      ]);
      const jumps = getJumpsForPiece(board, square(18));
      // Should stop at sq 2 (king row) after 2 jumps
      expect(jumps).toHaveLength(1);
      expect(jumps[0]?.path).toEqual([square(11), square(2)]);
      expect(jumps[0]?.captured).toEqual([square(15), square(7)]);
    });
  });

  describe('empty square', () => {
    it('returns empty array when called on an empty square', () => {
      const board = emptyBoard();
      expect(getJumpsForPiece(board, square(14))).toHaveLength(0);
    });
  });
});

// ===========================================================================
// getLegalMoves
// ===========================================================================

describe('getLegalMoves', () => {
  describe('opening position', () => {
    const board = createInitialBoard();

    it('White has 7 legal moves from the starting position', () => {
      const moves = getLegalMoves(board, W);
      expect(moves).toHaveLength(7);
    });

    it('Black has 7 legal moves from the starting position', () => {
      const moves = getLegalMoves(board, B);
      expect(moves).toHaveLength(7);
    });

    it('all moves in the opening are simple (no captures)', () => {
      const moves = getLegalMoves(board, W);
      for (const m of moves) {
        expect(m.captured).toHaveLength(0);
      }
    });
  });

  describe('mandatory capture', () => {
    it('only jumps are returned when one piece can jump and others can only simple-move', () => {
      // White pawn on 22 can jump over black on 18 → 15.
      // White pawn on 24 can simple-move.
      // Only the jump should be legal.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 24, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const moves = getLegalMoves(board, W);
      expect(moves.every((m) => m.captured.length > 0)).toBe(true);
    });

    it('when multiple pieces can jump, all jumps from all pieces are returned', () => {
      // Two white pieces, each with a jump available.
      // sq 22 (row5,col2) jumps over 18(row4,col3) → 15.
      // sq 24 (row5,col6) jumps over 19(row4,col5) → 15... wait, that's the same landing.
      // Use sq 23 (row5,col4) and sq 21 (row5,col0).
      // sq 23 FL: row4,col3=sq18. Jump: row3,col2=sq14.
      // sq 21 FR: row4,col1=sq17. Jump: row3,col2=sq14... same landing again.
      // Better: sq 22 over 18→15, and sq 26(row6,col3) over 22... can't, 22 is white.
      // Use: sq 22 over 18→15, and sq 30(row7,col2) over 26(row6,col3)→23(row5,col4).
      // Wait, sq 30 is row 7 — black's king row. Let's keep it simpler:
      // sq 22(row5,col2) over 18→15. sq 23(row5,col4) over 19(row4,col5)→16(row3,col6).
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 23, color: W, type: P },
        { sq: 18, color: B, type: P },
        { sq: 19, color: B, type: P },
      ]);
      const moves = getLegalMoves(board, W);
      expect(moves.length).toBeGreaterThanOrEqual(2);
      expect(moves.every((m) => m.captured.length > 0)).toBe(true);
      const froms = new Set(moves.map((m) => m.from as number));
      expect(froms.size).toBe(2);
    });

    it('when no jumps exist, all simple moves are returned', () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 24, color: W, type: P },
      ]);
      const moves = getLegalMoves(board, W);
      expect(moves.length).toBeGreaterThan(0);
      expect(moves.every((m) => m.captured.length === 0)).toBe(true);
    });
  });

  describe('no legal moves', () => {
    it('returns empty array when the active color has no pieces', () => {
      const board = buildBoard([{ sq: 14, color: B, type: P }]);
      expect(getLegalMoves(board, W)).toHaveLength(0);
    });

    it('returns empty array when all pieces are blocked', () => {
      // White pawn on 4 (row0,col7) — no forward moves (already on row 0).
      // This is a king-row square so in practice it'd be kinged, but testing with pawn.
      const board = buildBoard([{ sq: 4, color: W, type: P }]);
      const moves = getLegalMoves(board, W);
      expect(moves).toHaveLength(0);
    });

    it('returns empty array on a truly empty board', () => {
      expect(getLegalMoves(emptyBoard(), W)).toHaveLength(0);
    });
  });

  describe('forced multi-jump', () => {
    it('only complete multi-jump chains are returned — no partial jumps', () => {
      // White on 22. Black on 18 → land 15. Black on 10 → land 6.
      // Only the 2-jump chain should appear, not a 1-jump partial stopping at 15.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 18, color: B, type: P },
        { sq: 10, color: B, type: P },
      ]);
      const moves = getLegalMoves(board, W);
      expect(moves).toHaveLength(1);
      expect(moves[0]?.path).toEqual([square(15), square(6)]);
      expect(moves[0]?.captured).toHaveLength(2);
    });
  });

  describe('complex mid-game position', () => {
    it('position with mix of pawns and kings produces correct moves', () => {
      // White king on 14, white pawn on 22. Black pawn on 10, black pawn on 26.
      // King on 14: FL adj=9(empty)→simple move. FR adj=10(black)→jump to 7.
      //             BL adj=17(empty)→simple move. BR adj=18(empty)→simple move.
      // But jump exists (14→7 over 10), so mandatory capture.
      // Pawn on 22: FL adj=17(empty), FR adj=18(empty) — simple moves, blocked by mandatory capture.
      const board = buildBoard([
        { sq: 14, color: W, type: K },
        { sq: 22, color: W, type: P },
        { sq: 10, color: B, type: P },
        { sq: 26, color: B, type: P },
      ]);
      const moves = getLegalMoves(board, W);
      // Only jumps should be returned (the king's jump over 10)
      expect(moves.every((m) => m.captured.length > 0)).toBe(true);
      expect(moves.some((m) => (m.from as number) === 14)).toBe(true);
    });
  });
});

// ===========================================================================
// getLegalMovesForPiece
// ===========================================================================

describe('getLegalMovesForPiece', () => {
  describe('mandatory capture interaction', () => {
    it("when another piece has a jump, this piece's simple moves are not returned", () => {
      // White pawn on 24 (no jump available), but white pawn on 22 can jump.
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 24, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const moves = getLegalMovesForPiece(board, square(24));
      expect(moves).toHaveLength(0); // 24 has no jumps, and jumps exist elsewhere
    });

    it("when this piece has a jump, only its jumps are returned", () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 24, color: W, type: P },
        { sq: 18, color: B, type: P },
      ]);
      const moves = getLegalMovesForPiece(board, square(22));
      expect(moves).toHaveLength(1);
      expect(moves[0]?.captured.length).toBeGreaterThan(0);
    });

    it("when no jumps exist anywhere, this piece's simple moves are returned", () => {
      const board = buildBoard([
        { sq: 22, color: W, type: P },
        { sq: 24, color: W, type: P },
      ]);
      const moves = getLegalMovesForPiece(board, square(22));
      expect(moves.length).toBeGreaterThan(0);
      expect(moves.every((m) => m.captured.length === 0)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for an empty square', () => {
      expect(getLegalMovesForPiece(emptyBoard(), square(14))).toHaveLength(0);
    });

    it('returns empty array for a piece with no legal moves when others can move', () => {
      // White pawn on 4 (row0 — no forward moves as pawn), white pawn on 22 (can move).
      const board = buildBoard([
        { sq: 4, color: W, type: P },
        { sq: 22, color: W, type: P },
      ]);
      const moves = getLegalMovesForPiece(board, square(4));
      expect(moves).toHaveLength(0);
    });
  });
});

// ===========================================================================
// getMovesToSquare
// ===========================================================================

describe('getMovesToSquare', () => {
  it('filters to moves whose first path step matches the target', () => {
    const moves: Move[] = [
      { from: square(22), path: [square(15)], captured: [] },
      { from: square(22), path: [square(17)], captured: [] },
    ];
    const result = getMovesToSquare(moves, square(15));
    expect(result).toHaveLength(1);
    expect(result[0]?.path[0]).toBe(square(15));
  });

  it('returns empty array when no moves match', () => {
    const moves: Move[] = [
      { from: square(22), path: [square(15)], captured: [] },
    ];
    expect(getMovesToSquare(moves, square(20))).toHaveLength(0);
  });

  it('returns multiple moves when multi-jump branches share a first hop', () => {
    const moves: Move[] = [
      { from: square(22), path: [square(15), square(6)], captured: [square(18), square(10)] },
      { from: square(22), path: [square(15), square(8)], captured: [square(18), square(11)] },
    ];
    const result = getMovesToSquare(moves, square(15));
    expect(result).toHaveLength(2);
  });
});

// ===========================================================================
// Known position regression tests
// ===========================================================================

describe('known positions', () => {
  it('double corner — no wrapping around board edges', () => {
    // White pawn on sq 4 (row0,col7) — top-right corner. Should have no moves at all (pawn on row 0).
    const board = buildBoard([{ sq: 4, color: W, type: P }]);
    expect(getSimpleMovesForPiece(board, square(4))).toHaveLength(0);
    expect(getJumpsForPiece(board, square(4))).toHaveLength(0);
  });

  it('king row approach — white pawn one step from promotion', () => {
    // White pawn on sq 5 (row1,col0). FR: row0,col1=sq1 (king row).
    const board = buildBoard([{ sq: 5, color: W, type: P }]);
    const moves = getSimpleMovesForPiece(board, square(5));
    expect(moves).toHaveLength(1);
    expect(moves[0]?.path).toEqual([square(1)]);
  });

  it('triple jump — forced 3-piece capture chain', () => {
    // White on 26 (row6,col2). Black on 22(row5,col2). Jump→17(row4,col0)...
    // That doesn't work. Let me set up a proper triple jump.
    // White on 26 (row6, col2, even row → posInRow=0... wait)
    // sq 26: index=25, row=6, posInRow=1. Even row: col=1*2+1=3. So row6,col3.
    // FL: row5,col2=sq22. Jump: row4,col1=sq17.
    // From 17 (row4,col1, even row, posInRow=0, col=0*2+1=1): FL: row3,col0=sq13. Jump: row2,col-1→off board.
    // FR: row3,col2=sq14. Jump: row2,col3=sq10.
    // Need black on sq22 and sq14. From 10 (row2,col3): FL: row1,col2=sq6. Jump: row0,col1=sq1 (promo).
    // Need black on sq6.
    // Actually, let me re-examine sq 17. sq 17: index=16, row=4, posInRow=0. Even row: col=0*2+1=1.
    // So sq 17 is at row4,col1. FL: row3,col0=sq13. FR: row3,col2=sq14.
    // Jump over 14: row2,col3=sq10.
    // From sq 10 (row2,col3). FL: row1,col2=sq6. Jump: row0,col1=sq1.
    const board = buildBoard([
      { sq: 26, color: W, type: P },
      { sq: 22, color: B, type: P },
      { sq: 14, color: B, type: P },
      { sq: 6, color: B, type: P },
    ]);
    const jumps = getJumpsForPiece(board, square(26));
    // Chain: 26→17(over22)→10(over14)→1(over6) — but stops at 1 (promotion)
    // Actually white pawn going forward: 26 FL to 22 (adj), jump to 17.
    // 17 FR to 14 (adj), jump to 10.
    // 10 FL to 6 (adj), jump to 1 — promotion stop.
    expect(jumps.length).toBeGreaterThanOrEqual(1);
    const tripleJump = jumps.find((j) => j.captured.length === 3);
    expect(tripleJump).toBeDefined();
    expect(tripleJump?.captured).toEqual([square(22), square(14), square(6)]);
  });

  it('mandatory capture blocks safer move', () => {
    // White pawn on 24 has a safe simple move. White pawn on 22 must jump.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 24, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const moves = getLegalMoves(board, W);
    // Only the jump from 22 should be legal
    expect(moves.every((m) => m.captured.length > 0)).toBe(true);
    expect(moves.every((m) => (m.from as number) === 22)).toBe(true);
  });

  it('opening position verification: White moves are exactly the 7 expected', () => {
    const board = createInitialBoard();
    const moves = getLegalMoves(board, W);
    // White pieces on row 5 (sq 21-24) can move forward.
    // sq 21(row5,col0): FR→sq17 only (FL off board)
    // sq 22(row5,col2): FL→sq17, FR→sq18
    // sq 23(row5,col4): FL→sq18... wait, these are blocked by pieces on row 4 (sq 17-20 are empty in initial position).
    // Actually sq 13-20 are empty. So pieces on 21-24 can move.
    // sq 21: 1 move (FR only, FL off board)
    // sq 22: 2 moves
    // sq 23: 2 moves
    // sq 24: 2 moves... that's 7. But wait, sq 24 (row5,col6): FL→row4,col5=sq20, FR→row4,col7=off board?
    // sq 24: row5, posInRow=3, col=3*2=6. FR: row4,col7=sq20 (row4 even: posInRow=(7-1)/2=3, sq=4*4+3+1=20).
    // So sq 24 FR → sq 20 is valid. FL: row4,col5=sq19 (posInRow=(5-1)/2=2, sq=4*4+2+1=19). Both valid → 2 moves.
    // Total: 1+2+2+2=7 ✓
    expect(moves).toHaveLength(7);
    const froms = moves.map((m) => m.from as number);
    expect(froms.filter((f) => f === 21)).toHaveLength(1);
    expect(froms.filter((f) => f === 22)).toHaveLength(2);
    expect(froms.filter((f) => f === 23)).toHaveLength(2);
    expect(froms.filter((f) => f === 24)).toHaveLength(2);
  });
});
