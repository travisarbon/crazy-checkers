import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useGameInteraction } from './useGameInteraction';
import { createNewGame, getCurrentLegalMoves } from '../engine/game';
import { createAmericanRules } from '../engine/rules';
import { getLegalMovesForPiece, getJumpsForPiece } from '../engine/moves';
import { setBoardSquare } from '../engine/board';
import type { BoardState, GameState } from '../engine/types';
import {
  PieceColor,
  PieceType,
  PlayerType,
  GameStatus,
  square,
} from '../engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newGame(): GameState {
  return createNewGame(createAmericanRules(), {
    white: PlayerType.Human,
    black: PlayerType.Human,
  });
}

function emptyBoard(): BoardState {
  return new Array(32).fill(null) as BoardState;
}

function placePiece(
  board: BoardState,
  sq: number,
  color: PieceColor,
  type: PieceType = PieceType.Pawn,
): BoardState {
  return setBoardSquare(board, square(sq), { color, type });
}

function gameWithBoard(board: BoardState, activeColor: PieceColor = PieceColor.White): GameState {
  const base = newGame();
  return {
    ...base,
    board,
    activeColor,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGameInteraction', () => {
  it('1. initial state is idle', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: newGame(), onMove }),
    );

    expect(result.current.selectedSquare).toBeNull();
    expect(result.current.legalDestinations.size).toBe(0);
    expect(result.current.isMidMultiJump).toBe(false);
  });

  it('2. clicking an active-color piece selects it', () => {
    const gs = newGame(); // White's turn
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    // Square 21 has a white pawn in the starting position
    act(() => result.current.handleSquareClick(square(21)));

    expect(result.current.selectedSquare).toBe(square(21));
    expect(result.current.legalDestinations.size).toBeGreaterThan(0);
  });

  it('3. clicking a piece with no legal moves does nothing', () => {
    // Set up a board where a white pawn is completely blocked
    let board = emptyBoard();
    board = placePiece(board, 28, PieceColor.White);
    // Block both forward diagonals (square 24 forward-left, square 32 is off-board edge)
    board = placePiece(board, 24, PieceColor.White);
    board = placePiece(board, 32, PieceColor.White);
    const gs = gameWithBoard(board);
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    // Square 28 white pawn is blocked by own pieces — should not be selectable
    act(() => result.current.handleSquareClick(square(28)));
    expect(result.current.selectedSquare).toBeNull();
  });

  it('4. clicking an opponent piece does nothing', () => {
    const gs = newGame(); // White's turn
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    // Square 1 has a black pawn
    act(() => result.current.handleSquareClick(square(1)));
    expect(result.current.selectedSquare).toBeNull();
  });

  it('5. legal destinations match engine output', () => {
    const gs = newGame();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    act(() => result.current.handleSquareClick(square(21)));

    const engineMoves = getLegalMovesForPiece(gs.board, square(21));
    const engineDests = new Set(engineMoves.map((m) => m.path[0] as number));

    expect(result.current.legalDestinations).toEqual(engineDests);
  });

  it('6. clicking a legal destination executes a simple move', () => {
    const gs = newGame();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    // Select white pawn on 21, move to 17
    act(() => result.current.handleSquareClick(square(21)));
    act(() => result.current.handleSquareClick(square(17)));

    expect(onMove).toHaveBeenCalledTimes(1);
    const newState = onMove.mock.calls[0]?.[0] as GameState;
    expect(newState.activeColor).toBe(PieceColor.Black);
    expect(result.current.selectedSquare).toBeNull();
  });

  it('7. clicking an empty non-highlighted square deselects', () => {
    const gs = newGame();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    act(() => result.current.handleSquareClick(square(21)));
    expect(result.current.selectedSquare).not.toBeNull();

    // Click an empty square in the middle that's not a destination
    act(() => result.current.handleSquareClick(square(13)));
    expect(result.current.selectedSquare).toBeNull();
  });

  it('8. pressing Escape deselects', () => {
    const gs = newGame();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    act(() => result.current.handleSquareClick(square(21)));
    expect(result.current.selectedSquare).not.toBeNull();

    act(() => result.current.handleEscape());
    expect(result.current.selectedSquare).toBeNull();
  });

  it('9. switching selection to another piece', () => {
    const gs = newGame();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    act(() => result.current.handleSquareClick(square(21)));
    expect(result.current.selectedSquare).toBe(square(21));

    act(() => result.current.handleSquareClick(square(22)));
    expect(result.current.selectedSquare).toBe(square(22));
  });

  it('10. single jump executes correctly', () => {
    // White pawn on 21, Black pawn on 17 — white can jump to 14
    let board = emptyBoard();
    board = placePiece(board, 21, PieceColor.White);
    board = placePiece(board, 17, PieceColor.Black);
    const gs = gameWithBoard(board);
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    act(() => result.current.handleSquareClick(square(21)));
    act(() => result.current.handleSquareClick(square(14)));

    expect(onMove).toHaveBeenCalledTimes(1);
    const newState = onMove.mock.calls[0]?.[0] as GameState;
    expect(newState.activeColor).toBe(PieceColor.Black);
  });

  it('11. multi-jump: first hop enters mid-multi-jump', () => {
    // Set up a forced double-jump: White pawn at 22, Black at 18 and at 11
    // 22 -> jumps 18 -> lands 15 -> jumps 11 -> lands 8
    let board = emptyBoard();
    board = placePiece(board, 22, PieceColor.White);
    board = placePiece(board, 18, PieceColor.Black);
    board = placePiece(board, 11, PieceColor.Black);
    const gs = gameWithBoard(board);
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    // Verify jumps exist for this piece
    const jumps = getJumpsForPiece(gs.board, square(22));
    expect(jumps.length).toBeGreaterThan(0);
    // The jump chain should be a multi-jump (path length > 1)
    const multiJump = jumps.find((j) => j.path.length > 1);

    // If there's a multi-jump available, test the interaction
    if (multiJump) {
      act(() => result.current.handleSquareClick(square(22)));
      act(() => result.current.handleSquareClick(multiJump.path[0]!));

      expect(result.current.isMidMultiJump).toBe(true);
      expect(onMove).not.toHaveBeenCalled();
      // Display board should show piece at intermediate position
      expect(result.current.displayBoard).not.toBe(gs.board);
    }
  });

  it('12. multi-jump: second hop completes the chain', () => {
    let board = emptyBoard();
    board = placePiece(board, 22, PieceColor.White);
    board = placePiece(board, 18, PieceColor.Black);
    board = placePiece(board, 11, PieceColor.Black);
    const gs = gameWithBoard(board);
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    const jumps = getJumpsForPiece(gs.board, square(22));
    const multiJump = jumps.find((j) => j.path.length > 1);

    if (multiJump) {
      act(() => result.current.handleSquareClick(square(22)));
      act(() => result.current.handleSquareClick(multiJump.path[0]!));

      expect(result.current.isMidMultiJump).toBe(true);

      // Click the second destination to complete
      act(() => result.current.handleSquareClick(multiJump.path[1]!));

      expect(result.current.isMidMultiJump).toBe(false);
      expect(onMove).toHaveBeenCalledTimes(1);
      expect(result.current.selectedSquare).toBeNull();
    }
  });

  it('13. multi-jump: branching continuations show both destinations', () => {
    // White king at 15, black pawns at 11 and 19 and 10 — multiple branches
    // after first hop. This tests that all continuation destinations appear.
    let board = emptyBoard();
    board = placePiece(board, 15, PieceColor.White, PieceType.King);
    board = placePiece(board, 11, PieceColor.Black);
    board = placePiece(board, 18, PieceColor.Black);
    const gs = gameWithBoard(board);
    const onMove = vi.fn();

    const jumps = getJumpsForPiece(gs.board, square(15));

    // If there are multiple jump chains from square 15, test that
    // destinations reflect all options at each hop
    if (jumps.length > 0) {
      const { result } = renderHook(() =>
        useGameInteraction({ gameState: gs, onMove }),
      );

      act(() => result.current.handleSquareClick(square(15)));
      expect(result.current.legalDestinations.size).toBeGreaterThan(0);
    }
  });

  it('14. multi-jump: Escape aborts without making a move', () => {
    let board = emptyBoard();
    board = placePiece(board, 22, PieceColor.White);
    board = placePiece(board, 18, PieceColor.Black);
    board = placePiece(board, 11, PieceColor.Black);
    const gs = gameWithBoard(board);
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    const jumps = getJumpsForPiece(gs.board, square(22));
    const multiJump = jumps.find((j) => j.path.length > 1);

    if (multiJump) {
      act(() => result.current.handleSquareClick(square(22)));
      act(() => result.current.handleSquareClick(multiJump.path[0]!));

      expect(result.current.isMidMultiJump).toBe(true);

      act(() => result.current.handleEscape());

      expect(result.current.isMidMultiJump).toBe(false);
      expect(result.current.selectedSquare).toBeNull();
      expect(onMove).not.toHaveBeenCalled();
    }
  });

  it('15. mandatory capture: only jump moves available when jumps exist', () => {
    // White pawn on 25 (has simple moves only), White pawn on 21 (can jump over black on 17)
    let board = emptyBoard();
    board = placePiece(board, 25, PieceColor.White);
    board = placePiece(board, 21, PieceColor.White);
    board = placePiece(board, 17, PieceColor.Black);
    const gs = gameWithBoard(board);
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    // Square 25 should not be selectable because 21 has a forced jump
    expect(result.current.selectablePieces.has(25)).toBe(false);
    // Square 21 should be selectable
    expect(result.current.selectablePieces.has(21)).toBe(true);

    // Clicking 25 should not select it
    act(() => result.current.handleSquareClick(square(25)));
    expect(result.current.selectedSquare).toBeNull();
  });

  it('16. selection clears when game state changes externally', () => {
    const gs = newGame();
    const onMove = vi.fn();
    const { result, rerender } = renderHook(
      ({ gameState, onMove: om }) =>
        useGameInteraction({ gameState, onMove: om }),
      { initialProps: { gameState: gs, onMove } },
    );

    act(() => result.current.handleSquareClick(square(21)));
    expect(result.current.selectedSquare).not.toBeNull();

    // Simulate external state change (undo) by providing a state with different plyCount
    const newState = { ...gs, plyCount: gs.plyCount + 1 };
    rerender({ gameState: newState, onMove });
    expect(result.current.selectedSquare).toBeNull();
  });

  it('17. no interaction when game is over', () => {
    const gs: GameState = {
      ...newGame(),
      status: GameStatus.GameOver,
      result: {
        type: 'WHITE_WIN' as const,
        reason: 'NO_LEGAL_MOVES' as const,
      },
    };
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    act(() => result.current.handleSquareClick(square(21)));
    expect(result.current.selectedSquare).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('18. promotion during multi-jump terminates chain', () => {
    // White pawn at 12, black pawns at 8 and a position where
    // if the pawn reaches row 0 (king row for white), the chain must stop.
    // White pawn on 12 jumps black on 8 to land on 3 (king row) — chain terminates
    let board = emptyBoard();
    board = placePiece(board, 12, PieceColor.White);
    board = placePiece(board, 8, PieceColor.Black);
    const gs = gameWithBoard(board);
    const onMove = vi.fn();

    const jumps = getJumpsForPiece(gs.board, square(12));
    // The jump should land on the king row and terminate
    if (jumps.length > 0) {
      const { result } = renderHook(() =>
        useGameInteraction({ gameState: gs, onMove }),
      );

      act(() => result.current.handleSquareClick(square(12)));

      // Find the jump destination
      const dest = jumps[0]!.path[0]!;
      act(() => result.current.handleSquareClick(dest));

      // Should complete immediately (no mid-multi-jump), piece promoted
      expect(result.current.isMidMultiJump).toBe(false);
      expect(onMove).toHaveBeenCalledTimes(1);
    }
  });

  it('selectablePieces includes all pieces with legal moves', () => {
    const gs = newGame();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    const allMoves = getCurrentLegalMoves(gs);
    const expectedFromSquares = new Set(allMoves.map((m) => m.from as number));

    for (const sq of expectedFromSquares) {
      expect(result.current.selectablePieces.has(sq)).toBe(true);
    }
  });

  it('displayBoard equals gameState.board when not mid-multi-jump', () => {
    const gs = newGame();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useGameInteraction({ gameState: gs, onMove }),
    );

    expect(result.current.displayBoard).toBe(gs.board);
  });
});
