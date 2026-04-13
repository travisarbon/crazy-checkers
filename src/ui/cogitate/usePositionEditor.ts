/**
 * usePositionEditor — React hook managing the Free Play position editor state
 * (Task 21.5).
 *
 * Responsibilities:
 *   - Holds the mutable board under construction.
 *   - Tracks the currently selected palette piece.
 *   - Handles square clicks (place in placement mode, cycle in cycle mode).
 *   - Handles drag-and-drop repositioning and piece removal.
 *   - Runs the adapter's position validator on every change.
 *   - Exposes utilities: clearBoard, standardSetup, loadBoard, isDirty.
 *
 * Marching Orders extension: when Marching Orders is active in the Free
 * Play editor, the board expands to all 64 squares (dark + light). The
 * hook stores light-square pieces in a parallel 32-slot array and exposes
 * a derived 64-element `marchingOrdersGrid` that the UI can pass to
 * CogitateBoard so that light squares become interactive.
 */

import { useCallback, useMemo, useState } from 'react';
import type { BoardState, Piece, Square, SquareState } from '../../engine/types';
import { PieceColor, PieceType } from '../../engine/types';
import { BOARD_SIZE, squareToGrid } from '../../engine/board';
import type { CogitateGameAdapter } from '../../cogitate/CogitateGameAdapter';
import type { PieceDefinition, ValidationResult } from '../../cogitate/types';
import { extSquareToGrid } from '../../engine/events/marchingOrders';

export interface UsePositionEditorOptions {
  readonly adapter: CogitateGameAdapter;
}

/** Derived 64-element grid for Marching Orders rendering. */
export type MarchingOrdersGrid = readonly ({ color: PieceColor; type: PieceType } | null)[];

export interface UsePositionEditorReturn {
  readonly board: BoardState;
  /** Light-square pieces (32 slots, index corresponds to extSq - 33). */
  readonly lightBoard: BoardState;
  readonly piecePalette: readonly PieceDefinition[];
  readonly selectedPiece: PieceDefinition | null;
  readonly selectPiece: (piece: PieceDefinition | null) => void;
  readonly handleSquareClick: (square: Square) => void;
  readonly handleDragDrop: (from: Square, to: Square) => void;
  readonly handleRemovePiece: (square: Square) => void;
  readonly validation: ValidationResult;
  readonly clearBoard: () => void;
  readonly standardSetup: () => void;
  readonly loadBoard: (board: BoardState) => void;
  readonly isDirty: boolean;
  /**
   * Build a 64-element grid (8×8) representing both dark and light squares.
   * Used when Marching Orders is active so the board renderer and decorator
   * metadata see the complete edited position.
   */
  readonly getMarchingOrdersGrid: () => MarchingOrdersGrid;
}

/** Returns the next piece in the cycle order, or null for removal. */
function nextCyclePiece(current: Piece): SquareState {
  if (current.color === PieceColor.White && current.type === PieceType.Pawn) {
    return { color: PieceColor.White, type: PieceType.King };
  }
  if (current.color === PieceColor.White && current.type === PieceType.King) {
    return { color: PieceColor.Black, type: PieceType.Pawn };
  }
  if (current.color === PieceColor.Black && current.type === PieceType.Pawn) {
    return { color: PieceColor.Black, type: PieceType.King };
  }
  return null;
}

function setSquare(board: BoardState, sq: Square, value: SquareState): BoardState {
  const idx = (sq as number) - 1;
  const next = board.slice();
  next[idx] = value;
  return next;
}

/** Set a light-square entry (sq is an extended square 33-64). */
function setLightSquare(
  lightBoard: BoardState,
  extSq: number,
  value: SquareState,
): BoardState {
  const idx = extSq - 33;
  const next = lightBoard.slice();
  next[idx] = value;
  return next;
}

function emptyBoard(): BoardState {
  return new Array<SquareState>(BOARD_SIZE).fill(null);
}

function boardsEqual(a: BoardState, b: BoardState): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i] ?? null;
    const sb = b[i] ?? null;
    if (sa === null && sb === null) continue;
    if (sa === null || sb === null) return false;
    if (sa.color !== sb.color || sa.type !== sb.type) return false;
  }
  return true;
}

function lightBoardHasAny(lightBoard: BoardState): boolean {
  return lightBoard.some((sq) => sq !== null);
}

export function usePositionEditor(
  options: UsePositionEditorOptions,
): UsePositionEditorReturn {
  const { adapter } = options;

  const startingPosition = useMemo(
    () => adapter.getStartingPosition(),
    [adapter],
  );

  const [board, setBoard] = useState<BoardState>(() => startingPosition);
  const [lightBoard, setLightBoard] = useState<BoardState>(() => emptyBoard());
  const [selectedPiece, setSelectedPiece] = useState<PieceDefinition | null>(null);

  const piecePalette = useMemo(() => adapter.getPiecePalette(), [adapter]);

  const validation = useMemo<ValidationResult>(
    () => adapter.validatePosition(board),
    [adapter, board],
  );

  const isDirty = useMemo(
    () => !boardsEqual(board, startingPosition) || lightBoardHasAny(lightBoard),
    [board, startingPosition, lightBoard],
  );

  const selectPiece = useCallback((piece: PieceDefinition | null) => {
    setSelectedPiece(piece);
  }, []);

  const handleSquareClick = useCallback(
    (sq: Square) => {
      const sqNum = sq as number;
      if (sqNum > 32) {
        // Light square (Marching Orders).
        setLightBoard((current) => {
          const idx = sqNum - 33;
          const existing = current[idx] ?? null;
          if (selectedPiece) {
            const placed: Piece = {
              color: selectedPiece.color,
              type: selectedPiece.type,
            };
            return setLightSquare(current, sqNum, placed);
          }
          if (!existing) return current;
          return setLightSquare(current, sqNum, nextCyclePiece(existing));
        });
        return;
      }

      setBoard((current) => {
        const idx = sqNum - 1;
        const existing = current[idx] ?? null;
        if (selectedPiece) {
          const placed: Piece = {
            color: selectedPiece.color,
            type: selectedPiece.type,
          };
          return setSquare(current, sq, placed);
        }
        if (!existing) return current;
        return setSquare(current, sq, nextCyclePiece(existing));
      });
    },
    [selectedPiece],
  );

  const handleDragDrop = useCallback((from: Square, to: Square) => {
    setBoard((current) => {
      const fromIdx = (from as number) - 1;
      const piece = current[fromIdx] ?? null;
      if (!piece) return current;
      let next = setSquare(current, from, null);
      next = setSquare(next, to, piece);
      return next;
    });
  }, []);

  const handleRemovePiece = useCallback((sq: Square) => {
    const sqNum = sq as number;
    if (sqNum > 32) {
      setLightBoard((current) => setLightSquare(current, sqNum, null));
      return;
    }
    setBoard((current) => setSquare(current, sq, null));
  }, []);

  const clearBoard = useCallback(() => {
    setBoard(emptyBoard());
    setLightBoard(emptyBoard());
    setSelectedPiece(null);
  }, []);

  const standardSetup = useCallback(() => {
    setBoard(startingPosition);
    setLightBoard(emptyBoard());
    setSelectedPiece(null);
  }, [startingPosition]);

  const loadBoard = useCallback((next: BoardState) => {
    setBoard(next);
    setLightBoard(emptyBoard());
    setSelectedPiece(null);
  }, []);

  const getMarchingOrdersGrid = useCallback<() => MarchingOrdersGrid>(() => {
    const grid: (SquareState)[] = new Array<SquareState>(64).fill(null);
    for (let sq = 1; sq <= 32; sq++) {
      const piece = board[sq - 1];
      if (piece) {
        const { row, col } = squareToGrid(sq as Square);
        grid[row * 8 + col] = { color: piece.color, type: piece.type };
      }
    }
    for (let i = 0; i < 32; i++) {
      const piece = lightBoard[i];
      if (piece) {
        const extSq = 33 + i;
        const { row, col } = extSquareToGrid(extSq);
        grid[row * 8 + col] = { color: piece.color, type: piece.type };
      }
    }
    return grid as MarchingOrdersGrid;
  }, [board, lightBoard]);

  return {
    board,
    lightBoard,
    piecePalette,
    selectedPiece,
    selectPiece,
    handleSquareClick,
    handleDragDrop,
    handleRemovePiece,
    validation,
    clearBoard,
    standardSetup,
    loadBoard,
    isDirty,
    getMarchingOrdersGrid,
  };
}
