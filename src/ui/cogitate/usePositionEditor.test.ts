import { describe, it, expect, beforeAll } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePositionEditor } from './usePositionEditor';
import { getAdapterOrThrow } from '../../cogitate/CogitateGameAdapter';
import '../../cogitate/adapters/registerAll';
import { PieceColor, PieceType, square } from '../../engine/types';
import type { BoardState, Piece, SquareState } from '../../engine/types';
import { BOARD_SIZE } from '../../engine/board';

describe('usePositionEditor', () => {
  beforeAll(() => {
    // registerAll imported above seeds adapters.
  });

  it('initializes with the adapter starting position and clean validation', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    expect(result.current.board.length).toBe(BOARD_SIZE);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.validation.isLegal).toBe(true);
  });

  it('places a selected palette piece on an empty square', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    act(() => { result.current.clearBoard(); });
    const whitePawn = result.current.piecePalette.find(
      (p) => p.color === PieceColor.White && p.type === PieceType.Pawn,
    );
    expect(whitePawn).toBeDefined();
    act(() => { result.current.selectPiece(whitePawn ?? null); });
    act(() => { result.current.handleSquareClick(square(14)); });
    const placed = result.current.board[13] as Piece | null;
    expect(placed).not.toBeNull();
    expect(placed?.color).toBe(PieceColor.White);
    expect(placed?.type).toBe(PieceType.Pawn);
    expect(result.current.isDirty).toBe(true);
  });

  it('replaces an occupied square when a palette piece is selected', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    const blackKing = result.current.piecePalette.find(
      (p) => p.color === PieceColor.Black && p.type === PieceType.King,
    );
    act(() => { result.current.selectPiece(blackKing ?? null); });
    act(() => { result.current.handleSquareClick(square(1)); });
    const placed = result.current.board[0] as Piece | null;
    expect(placed?.color).toBe(PieceColor.Black);
    expect(placed?.type).toBe(PieceType.King);
  });

  it('cycles an occupied square through all piece types then removes', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    // Square 21 starts as white pawn.
    act(() => { result.current.selectPiece(null); });
    // white pawn → white king
    act(() => { result.current.handleSquareClick(square(21)); });
    expect((result.current.board[20] as Piece).type).toBe(PieceType.King);
    expect((result.current.board[20] as Piece).color).toBe(PieceColor.White);
    // white king → black pawn
    act(() => { result.current.handleSquareClick(square(21)); });
    expect((result.current.board[20] as Piece).color).toBe(PieceColor.Black);
    expect((result.current.board[20] as Piece).type).toBe(PieceType.Pawn);
    // black pawn → black king
    act(() => { result.current.handleSquareClick(square(21)); });
    expect((result.current.board[20] as Piece).color).toBe(PieceColor.Black);
    expect((result.current.board[20] as Piece).type).toBe(PieceType.King);
    // black king → empty
    act(() => { result.current.handleSquareClick(square(21)); });
    expect(result.current.board[20]).toBeNull();
  });

  it('ignores clicks on empty squares in cycle mode', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    const before: BoardState = result.current.board;
    act(() => { result.current.handleSquareClick(square(15)); });
    // Square 15 is empty on starting board; cycle mode no-op.
    expect(result.current.board[14]).toBeNull();
    // Board identity unchanged.
    expect(result.current.board).toBe(before);
  });

  it('drag-drop moves a piece from source to destination', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    // Move black pawn from 1 to 13 (starts empty).
    const srcPiece = result.current.board[0] as Piece | null;
    expect(srcPiece).not.toBeNull();
    act(() => { result.current.handleDragDrop(square(1), square(13)); });
    expect(result.current.board[0]).toBeNull();
    const dst = result.current.board[12] as Piece | null;
    expect(dst?.color).toBe(PieceColor.Black);
    expect(dst?.type).toBe(PieceType.Pawn);
  });

  it('removes a piece with handleRemovePiece', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    act(() => { result.current.handleRemovePiece(square(1)); });
    expect(result.current.board[0]).toBeNull();
  });

  it('clearBoard empties all squares and clears selection', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    const white = result.current.piecePalette[0] ?? null;
    act(() => { result.current.selectPiece(white); });
    act(() => { result.current.clearBoard(); });
    expect(result.current.board.every((sq: SquareState) => sq === null)).toBe(true);
    expect(result.current.selectedPiece).toBeNull();
  });

  it('standardSetup restores starting position and isDirty=false', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    act(() => { result.current.clearBoard(); });
    expect(result.current.isDirty).toBe(true);
    act(() => { result.current.standardSetup(); });
    expect(result.current.isDirty).toBe(false);
  });

  it('loadBoard replaces the board and clears the selection', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    const custom: BoardState = new Array<SquareState>(BOARD_SIZE).fill(null);
    act(() => { result.current.loadBoard(custom); });
    expect(result.current.board.every((sq: SquareState) => sq === null)).toBe(true);
  });

  it('re-runs validation after board changes', () => {
    const adapter = getAdapterOrThrow('classic');
    const { result } = renderHook(() => usePositionEditor({ adapter }));
    act(() => { result.current.clearBoard(); });
    // Empty board is illegal (no pieces).
    expect(result.current.validation.isLegal).toBe(false);
  });
});
