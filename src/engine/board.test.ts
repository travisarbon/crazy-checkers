import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE,
  countPieces,
  createInitialBoard,
  getAdjacentSquare,
  getAllAdjacentSquares,
  getBoardSquare,
  getJumpTarget,
  getPromotionRow,
  getSquaresWithColor,
  gridToSquare,
  isPromotionSquare,
  setBoardSquare,
  squareToGrid,
} from './board';
import { Direction, PieceColor, PieceType, square } from './types';
import type { SquareState } from './types';

describe('createInitialBoard()', () => {
  const board = createInitialBoard();

  it('returns an array of length 32', () => {
    expect(board).toHaveLength(BOARD_SIZE);
  });

  it('squares 1–12 are Black pawns', () => {
    for (let i = 1; i <= 12; i++) {
      const piece = getBoardSquare(board, square(i));
      expect(piece).toEqual({ color: PieceColor.Black, type: PieceType.Pawn });
    }
  });

  it('squares 13–20 are empty', () => {
    for (let i = 13; i <= 20; i++) {
      expect(getBoardSquare(board, square(i))).toBeNull();
    }
  });

  it('squares 21–32 are White pawns', () => {
    for (let i = 21; i <= 32; i++) {
      const piece = getBoardSquare(board, square(i));
      expect(piece).toEqual({ color: PieceColor.White, type: PieceType.Pawn });
    }
  });

  it('no kings are present in the initial position', () => {
    for (let i = 1; i <= 32; i++) {
      const piece = getBoardSquare(board, square(i));
      if (piece !== null) {
        expect(piece.type).not.toBe(PieceType.King);
      }
    }
  });
});

describe('getBoardSquare / setBoardSquare', () => {
  const board = createInitialBoard();

  it('getBoardSquare returns the correct piece for an occupied square', () => {
    expect(getBoardSquare(board, square(1))).toEqual({
      color: PieceColor.Black,
      type: PieceType.Pawn,
    });
  });

  it('getBoardSquare returns null for an empty square', () => {
    expect(getBoardSquare(board, square(15))).toBeNull();
  });

  it('setBoardSquare returns a new array (does not mutate original)', () => {
    const newBoard = setBoardSquare(board, square(15), {
      color: PieceColor.White,
      type: PieceType.King,
    });
    expect(newBoard).not.toBe(board);
    expect(getBoardSquare(board, square(15))).toBeNull();
    expect(getBoardSquare(newBoard, square(15))).toEqual({
      color: PieceColor.White,
      type: PieceType.King,
    });
  });

  it('setBoardSquare correctly places a piece on an empty square', () => {
    const piece = { color: PieceColor.Black, type: PieceType.King } as const;
    const newBoard = setBoardSquare(board, square(14), piece);
    expect(getBoardSquare(newBoard, square(14))).toEqual(piece);
  });

  it('setBoardSquare correctly clears an occupied square', () => {
    const newBoard = setBoardSquare(board, square(1), null);
    expect(getBoardSquare(newBoard, square(1))).toBeNull();
  });
});

describe('squareToGrid()', () => {
  it('square 1 → { row: 0, col: 1 }', () => {
    expect(squareToGrid(square(1))).toEqual({ row: 0, col: 1 });
  });

  it('square 4 → { row: 0, col: 7 }', () => {
    expect(squareToGrid(square(4))).toEqual({ row: 0, col: 7 });
  });

  it('square 5 → { row: 1, col: 0 }', () => {
    expect(squareToGrid(square(5))).toEqual({ row: 1, col: 0 });
  });

  it('square 29 → { row: 7, col: 0 }', () => {
    expect(squareToGrid(square(29))).toEqual({ row: 7, col: 0 });
  });

  it('square 32 → { row: 7, col: 6 }', () => {
    expect(squareToGrid(square(32))).toEqual({ row: 7, col: 6 });
  });

  it('round-trip: gridToSquare(squareToGrid(sq)) === sq for all 32 squares', () => {
    for (let i = 1; i <= 32; i++) {
      const sq = square(i);
      const { row, col } = squareToGrid(sq);
      expect(gridToSquare(row, col)).toBe(sq);
    }
  });
});

describe('gridToSquare()', () => {
  it('returns correct square for all 32 playable positions', () => {
    const seen = new Set<number>();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const result = gridToSquare(row, col);
        if (result !== null) {
          seen.add(result);
        }
      }
    }
    expect(seen.size).toBe(32);
  });

  it('returns null for light (non-playable) squares', () => {
    // Row 0 even: playable cols are 1,3,5,7 → col 0 is light
    expect(gridToSquare(0, 0)).toBeNull();
    expect(gridToSquare(0, 2)).toBeNull();
    // Row 1 odd: playable cols are 0,2,4,6 → col 1 is light
    expect(gridToSquare(1, 1)).toBeNull();
    expect(gridToSquare(1, 3)).toBeNull();
  });

  it('returns null for out-of-bounds coordinates', () => {
    expect(gridToSquare(-1, 0)).toBeNull();
    expect(gridToSquare(0, -1)).toBeNull();
    expect(gridToSquare(8, 0)).toBeNull();
    expect(gridToSquare(0, 8)).toBeNull();
  });
});

describe('getAdjacentSquare()', () => {
  it('center square (14): returns valid neighbors in all 4 directions', () => {
    const sq = square(14);
    expect(getAdjacentSquare(sq, Direction.ForwardLeft)).not.toBeNull();
    expect(getAdjacentSquare(sq, Direction.ForwardRight)).not.toBeNull();
    expect(getAdjacentSquare(sq, Direction.BackwardLeft)).not.toBeNull();
    expect(getAdjacentSquare(sq, Direction.BackwardRight)).not.toBeNull();
  });

  it('corner square (1): ForwardLeft and ForwardRight return null (top edge)', () => {
    const sq = square(1);
    expect(getAdjacentSquare(sq, Direction.ForwardLeft)).toBeNull();
    expect(getAdjacentSquare(sq, Direction.ForwardRight)).toBeNull();
  });

  it('corner square (29): BackwardLeft returns null (bottom-left edge)', () => {
    const sq = square(29);
    expect(getAdjacentSquare(sq, Direction.BackwardLeft)).toBeNull();
  });

  it('left-edge square (5): ForwardLeft and BackwardLeft return null', () => {
    const sq = square(5);
    expect(getAdjacentSquare(sq, Direction.ForwardLeft)).toBeNull();
    expect(getAdjacentSquare(sq, Direction.BackwardLeft)).toBeNull();
  });

  it('right-edge square (4): ForwardRight and BackwardRight return null', () => {
    const sq = square(4);
    // square 4 is at row 0, col 7 — top-right corner
    expect(getAdjacentSquare(sq, Direction.ForwardRight)).toBeNull();
    // BackwardRight from row 0, col 7 → row 1, col 8 → off board
    expect(getAdjacentSquare(sq, Direction.BackwardRight)).toBeNull();
  });
});

describe('getJumpTarget()', () => {
  it('center square (14): returns valid jump targets in all 4 directions', () => {
    const sq = square(14);
    expect(getJumpTarget(sq, Direction.ForwardLeft)).not.toBeNull();
    expect(getJumpTarget(sq, Direction.ForwardRight)).not.toBeNull();
    expect(getJumpTarget(sq, Direction.BackwardLeft)).not.toBeNull();
    expect(getJumpTarget(sq, Direction.BackwardRight)).not.toBeNull();
  });

  it('edge square (1): returns null for directions that go off the board', () => {
    const sq = square(1);
    expect(getJumpTarget(sq, Direction.ForwardLeft)).toBeNull();
    expect(getJumpTarget(sq, Direction.ForwardRight)).toBeNull();
  });

  it('near-edge square (5): returns null for jumps that would land off the board', () => {
    const sq = square(5);
    // Row 1, col 0 → jumping forward-left goes to row -1 → off board
    expect(getJumpTarget(sq, Direction.ForwardLeft)).toBeNull();
    // Row 1, col 0 → jumping backward-left goes to row 3, col -2 → off board
    expect(getJumpTarget(sq, Direction.BackwardLeft)).toBeNull();
  });

  it('jump target is exactly 2 diagonal steps from the origin', () => {
    const sq = square(14); // row 3, col 2
    const target = getJumpTarget(sq, Direction.ForwardLeft);
    expect(target).not.toBeNull();
    if (target === null) return;
    const originGrid = squareToGrid(sq);
    const targetGrid = squareToGrid(target);
    expect(Math.abs(targetGrid.row - originGrid.row)).toBe(2);
    expect(Math.abs(targetGrid.col - originGrid.col)).toBe(2);
  });
});

describe('getAllAdjacentSquares()', () => {
  it('center square returns 4 entries (all directions valid)', () => {
    const results = getAllAdjacentSquares(square(14));
    expect(results).toHaveLength(4);
  });

  it('corner square (4) returns expected entries', () => {
    // square 4 is at row 0, col 7 — only BackwardLeft is valid
    const results = getAllAdjacentSquares(square(4));
    expect(results).toHaveLength(1);
    expect(results[0]?.direction).toBe(Direction.BackwardLeft);
  });

  it('edge square returns 2 entries', () => {
    // square 5: row 1, col 0 — ForwardRight and BackwardRight valid
    const results = getAllAdjacentSquares(square(5));
    expect(results).toHaveLength(2);
  });

  it('each entry includes direction, adjacent square, and jump target', () => {
    const results = getAllAdjacentSquares(square(14));
    for (const entry of results) {
      expect(entry).toHaveProperty('direction');
      expect(entry).toHaveProperty('adjacent');
      expect(entry).toHaveProperty('jumpTarget');
      expect(typeof entry.adjacent).toBe('number');
    }
  });
});

describe('getSquaresWithColor()', () => {
  const board = createInitialBoard();

  it('initial board: 12 White squares (21–32)', () => {
    const whites = getSquaresWithColor(board, PieceColor.White);
    expect(whites).toHaveLength(12);
    for (let i = 21; i <= 32; i++) {
      expect(whites).toContain(i);
    }
  });

  it('initial board: 12 Black squares (1–12)', () => {
    const blacks = getSquaresWithColor(board, PieceColor.Black);
    expect(blacks).toHaveLength(12);
    for (let i = 1; i <= 12; i++) {
      expect(blacks).toContain(i);
    }
  });

  it('empty board: returns empty array for both colors', () => {
    const emptyBoard: SquareState[] = new Array<SquareState>(32).fill(null);
    expect(getSquaresWithColor(emptyBoard, PieceColor.White)).toHaveLength(0);
    expect(getSquaresWithColor(emptyBoard, PieceColor.Black)).toHaveLength(0);
  });
});

describe('countPieces()', () => {
  it('initial board: 12 white pawns, 0 white kings, 12 black pawns, 0 black kings', () => {
    const board = createInitialBoard();
    const counts = countPieces(board);
    expect(counts.white).toEqual({ pawns: 12, kings: 0 });
    expect(counts.black).toEqual({ pawns: 12, kings: 0 });
  });

  it('board with a mix of pawns and kings: counts correctly', () => {
    const board: SquareState[] = new Array<SquareState>(32).fill(null);
    board[0] = { color: PieceColor.Black, type: PieceType.Pawn };
    board[1] = { color: PieceColor.Black, type: PieceType.King };
    board[20] = { color: PieceColor.White, type: PieceType.King };
    board[21] = { color: PieceColor.White, type: PieceType.King };
    board[22] = { color: PieceColor.White, type: PieceType.Pawn };

    const counts = countPieces(board);
    expect(counts.black).toEqual({ pawns: 1, kings: 1 });
    expect(counts.white).toEqual({ pawns: 1, kings: 2 });
  });

  it('empty board: all counts are 0', () => {
    const emptyBoard: SquareState[] = new Array<SquareState>(32).fill(null);
    const counts = countPieces(emptyBoard);
    expect(counts.white).toEqual({ pawns: 0, kings: 0 });
    expect(counts.black).toEqual({ pawns: 0, kings: 0 });
  });
});

describe('isPromotionSquare()', () => {
  it('squares 1–4 are promotion squares for White', () => {
    for (let i = 1; i <= 4; i++) {
      expect(isPromotionSquare(square(i), PieceColor.White)).toBe(true);
    }
  });

  it('squares 5–32 are not promotion squares for White', () => {
    for (let i = 5; i <= 32; i++) {
      expect(isPromotionSquare(square(i), PieceColor.White)).toBe(false);
    }
  });

  it('squares 29–32 are promotion squares for Black', () => {
    for (let i = 29; i <= 32; i++) {
      expect(isPromotionSquare(square(i), PieceColor.Black)).toBe(true);
    }
  });

  it('squares 1–28 are not promotion squares for Black', () => {
    for (let i = 1; i <= 28; i++) {
      expect(isPromotionSquare(square(i), PieceColor.Black)).toBe(false);
    }
  });
});

describe('getPromotionRow()', () => {
  it('White promotes on row 0', () => {
    expect(getPromotionRow(PieceColor.White)).toBe(0);
  });

  it('Black promotes on row 7', () => {
    expect(getPromotionRow(PieceColor.Black)).toBe(7);
  });
});

describe('coordinate system integrity', () => {
  it('every square 1–32 round-trips through squareToGrid → gridToSquare', () => {
    for (let i = 1; i <= 32; i++) {
      const sq = square(i);
      const { row, col } = squareToGrid(sq);
      expect(gridToSquare(row, col)).toBe(sq);
    }
  });

  it('every playable grid position round-trips through gridToSquare → squareToGrid', () => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = gridToSquare(row, col);
        if (sq !== null) {
          const grid = squareToGrid(sq);
          expect(grid.row).toBe(row);
          expect(grid.col).toBe(col);
        }
      }
    }
  });

  it('the 32 grid positions produced by squareToGrid are all distinct', () => {
    const positions = new Set<string>();
    for (let i = 1; i <= 32; i++) {
      const { row, col } = squareToGrid(square(i));
      positions.add(`${String(row)},${String(col)}`);
    }
    expect(positions.size).toBe(32);
  });

  it('no two squares map to the same grid position', () => {
    const map = new Map<string, number>();
    for (let i = 1; i <= 32; i++) {
      const { row, col } = squareToGrid(square(i));
      const key = `${String(row)},${String(col)}`;
      expect(map.has(key)).toBe(false);
      map.set(key, i);
    }
  });
});
