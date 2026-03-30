import { describe, it, expect } from 'vitest';
import { computeZobristHash, updateZobristHash, isRepetition } from './zobrist';
import { createInitialBoard } from './board';
import { PieceColor, PieceType, square } from './types';
import type { Move, Piece, Square } from './types';
import { W, B, P, K, buildBoard } from './test-utils';

// ===========================================================================
// computeZobristHash
// ===========================================================================

describe('computeZobristHash', () => {
  it('initial position hash is a non-zero bigint', () => {
    const board = createInitialBoard();
    const hash = computeZobristHash(board, PieceColor.White);
    expect(typeof hash).toBe('bigint');
    expect(hash).not.toBe(0n);
  });

  it('same board + same active color = same hash', () => {
    const board = createInitialBoard();
    const h1 = computeZobristHash(board, PieceColor.White);
    const h2 = computeZobristHash(board, PieceColor.White);
    expect(h1).toBe(h2);
  });

  it('same board + different active color = different hash', () => {
    const board = createInitialBoard();
    const hWhite = computeZobristHash(board, PieceColor.White);
    const hBlack = computeZobristHash(board, PieceColor.Black);
    expect(hWhite).not.toBe(hBlack);
  });

  it('different piece placement = different hash', () => {
    const board1 = buildBoard([{ sq: 1, color: W, type: P }]);
    const board2 = buildBoard([{ sq: 2, color: W, type: P }]);
    const h1 = computeZobristHash(board1, PieceColor.White);
    const h2 = computeZobristHash(board2, PieceColor.White);
    expect(h1).not.toBe(h2);
  });

  it('hash is deterministic (calling twice produces the same result)', () => {
    const board = buildBoard([
      { sq: 5, color: W, type: K },
      { sq: 14, color: B, type: P },
    ]);
    const h1 = computeZobristHash(board, PieceColor.Black);
    const h2 = computeZobristHash(board, PieceColor.Black);
    expect(h1).toBe(h2);
  });
});

// ===========================================================================
// updateZobristHash
// ===========================================================================

describe('updateZobristHash', () => {
  it('incremental update matches full recomputation after a simple move', () => {
    // White pawn on 22 moves to 18
    const boardBefore = buildBoard([{ sq: 22, color: W, type: P }]);
    const move: Move = { from: square(22), path: [square(18)], captured: [] };
    const movingPiece: Piece = { color: PieceColor.White, type: PieceType.Pawn };
    const landingPiece: Piece = { color: PieceColor.White, type: PieceType.Pawn };

    const hashBefore = computeZobristHash(boardBefore, PieceColor.White);
    const incrementalHash = updateZobristHash(hashBefore, move, movingPiece, landingPiece, []);

    const boardAfter = buildBoard([{ sq: 18, color: W, type: P }]);
    const fullHash = computeZobristHash(boardAfter, PieceColor.Black);

    expect(incrementalHash).toBe(fullHash);
  });

  it('incremental update matches full recomputation after a single jump', () => {
    // White pawn on 22 jumps over black pawn on 18 to land on 15
    const boardBefore = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
    const movingPiece: Piece = { color: PieceColor.White, type: PieceType.Pawn };
    const landingPiece: Piece = { color: PieceColor.White, type: PieceType.Pawn };
    const captured: Array<{ sq: Square; piece: Piece }> = [
      { sq: square(18), piece: { color: PieceColor.Black, type: PieceType.Pawn } },
    ];

    const hashBefore = computeZobristHash(boardBefore, PieceColor.White);
    const incrementalHash = updateZobristHash(hashBefore, move, movingPiece, landingPiece, captured);

    const boardAfter = buildBoard([{ sq: 15, color: W, type: P }]);
    const fullHash = computeZobristHash(boardAfter, PieceColor.Black);

    expect(incrementalHash).toBe(fullHash);
  });

  it('incremental update matches full recomputation after a multi-jump', () => {
    // White king on 22 (row5,col2) jumps over 18 (row4,col3) to 15 (row3,col4),
    // then over 11 (row2,col5) to 8 (row1,col6).
    const boardBefore2 = buildBoard([
      { sq: 22, color: W, type: K },
      { sq: 18, color: B, type: P },
      { sq: 11, color: B, type: P },
    ]);
    const move2: Move = {
      from: square(22),
      path: [square(15), square(8)],
      captured: [square(18), square(11)],
    };
    const movingPiece2: Piece = { color: PieceColor.White, type: PieceType.King };
    const landingPiece2: Piece = { color: PieceColor.White, type: PieceType.King };
    const captured2: Array<{ sq: Square; piece: Piece }> = [
      { sq: square(18), piece: { color: PieceColor.Black, type: PieceType.Pawn } },
      { sq: square(11), piece: { color: PieceColor.Black, type: PieceType.Pawn } },
    ];

    const hashBefore2 = computeZobristHash(boardBefore2, PieceColor.White);
    const incrementalHash2 = updateZobristHash(hashBefore2, move2, movingPiece2, landingPiece2, captured2);

    const boardAfter2 = buildBoard([{ sq: 8, color: W, type: K }]);
    const fullHash2 = computeZobristHash(boardAfter2, PieceColor.Black);

    expect(incrementalHash2).toBe(fullHash2);
  });

  it('incremental update matches full recomputation after a promotion move', () => {
    // White pawn on 5 (row1,col0) moves to 1 (row0,col1) and promotes
    const boardBefore = buildBoard([{ sq: 5, color: W, type: P }]);
    const move: Move = { from: square(5), path: [square(1)], captured: [] };
    const movingPiece: Piece = { color: PieceColor.White, type: PieceType.Pawn };
    const landingPiece: Piece = { color: PieceColor.White, type: PieceType.King }; // promoted

    const hashBefore = computeZobristHash(boardBefore, PieceColor.White);
    const incrementalHash = updateZobristHash(hashBefore, move, movingPiece, landingPiece, []);

    const boardAfter = buildBoard([{ sq: 1, color: W, type: K }]);
    const fullHash = computeZobristHash(boardAfter, PieceColor.Black);

    expect(incrementalHash).toBe(fullHash);
  });
});

// ===========================================================================
// isRepetition
// ===========================================================================

describe('isRepetition', () => {
  it('returns false when hash appears only once', () => {
    expect(isRepetition([1n, 2n, 3n], 1n, 3)).toBe(false);
  });

  it('returns false when hash appears twice (threshold=3)', () => {
    expect(isRepetition([1n, 2n, 1n], 1n, 3)).toBe(false);
  });

  it('returns true when hash appears three times (threshold=3)', () => {
    // 1n appears 3 times in the array → true
    expect(isRepetition([1n, 2n, 1n, 3n, 1n], 1n, 3)).toBe(true);
    // Different hash not in array → false
    expect(isRepetition([1n, 2n, 1n, 3n, 1n], 99n, 3)).toBe(false);
    // Exactly 3 occurrences → true
    expect(isRepetition([1n, 1n, 1n], 1n, 3)).toBe(true);
  });

  it('returns true when hash appears more than three times', () => {
    expect(isRepetition([1n, 1n, 1n, 1n], 1n, 3)).toBe(true);
  });

  it('handles empty history array', () => {
    expect(isRepetition([], 1n, 3)).toBe(false);
  });
});
