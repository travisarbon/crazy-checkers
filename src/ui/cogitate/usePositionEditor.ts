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
 */

import { useCallback, useMemo, useState } from 'react';
import type { BoardState, Piece, Square, SquareState } from '../../engine/types';
import { PieceColor, PieceType } from '../../engine/types';
import { BOARD_SIZE } from '../../engine/board';
import type { CogitateGameAdapter } from '../../cogitate/CogitateGameAdapter';
import type { PieceDefinition, ValidationResult } from '../../cogitate/types';

export interface UsePositionEditorOptions {
  readonly adapter: CogitateGameAdapter;
}

export interface UsePositionEditorReturn {
  readonly board: BoardState;
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

export function usePositionEditor(
  options: UsePositionEditorOptions,
): UsePositionEditorReturn {
  const { adapter } = options;

  const startingPosition = useMemo(
    () => adapter.getStartingPosition(),
    [adapter],
  );

  const [board, setBoard] = useState<BoardState>(() => startingPosition);
  const [selectedPiece, setSelectedPiece] = useState<PieceDefinition | null>(null);

  const piecePalette = useMemo(() => adapter.getPiecePalette(), [adapter]);

  const validation = useMemo<ValidationResult>(
    () => adapter.validatePosition(board),
    [adapter, board],
  );

  const isDirty = useMemo(
    () => !boardsEqual(board, startingPosition),
    [board, startingPosition],
  );

  const selectPiece = useCallback((piece: PieceDefinition | null) => {
    setSelectedPiece(piece);
  }, []);

  const handleSquareClick = useCallback(
    (sq: Square) => {
      setBoard((current) => {
        const idx = (sq as number) - 1;
        const existing = current[idx] ?? null;
        if (selectedPiece) {
          // Placement mode — replace/place.
          const placed: Piece = {
            color: selectedPiece.color,
            type: selectedPiece.type,
          };
          return setSquare(current, sq, placed);
        }
        // Cycle mode — only operates on occupied squares.
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
    setBoard((current) => setSquare(current, sq, null));
  }, []);

  const clearBoard = useCallback(() => {
    setBoard(emptyBoard());
    setSelectedPiece(null);
  }, []);

  const standardSetup = useCallback(() => {
    setBoard(startingPosition);
    setSelectedPiece(null);
  }, [startingPosition]);

  const loadBoard = useCallback((next: BoardState) => {
    setBoard(next);
    setSelectedPiece(null);
  }, []);

  return {
    board,
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
  };
}
