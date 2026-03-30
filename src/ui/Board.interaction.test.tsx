import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Board from './Board';
import { createInitialBoard, setBoardSquare } from '../engine/board';
import type { BoardState } from '../engine/types';
import { PieceColor, PieceType, square } from '../engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getGridcell(label: string): HTMLElement {
  return screen.getByRole('gridcell', { name: label });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Board interaction rendering', () => {
  it('1. highlight appears on selected square', () => {
    const board = createInitialBoard();
    const selectedSq = square(21);
    const { container } = render(
      <Board
        board={board}
        selectedSquare={selectedSq}
        legalMoveSquares={new Set([17])}
        onSquareClick={vi.fn()}
      />,
    );

    const highlights = container.querySelectorAll('[data-testid="highlight-selected"]');
    expect(highlights).toHaveLength(1);
  });

  it('2. legal destination dots appear on empty squares', () => {
    const board = createInitialBoard();
    const selectedSq = square(21);
    // Squares 17 is empty in the initial board
    const legalDests = new Set([17]);
    const { container } = render(
      <Board
        board={board}
        selectedSquare={selectedSq}
        legalMoveSquares={legalDests}
        onSquareClick={vi.fn()}
      />,
    );

    const dots = container.querySelectorAll('[data-testid="legal-dot"]');
    expect(dots).toHaveLength(1);
  });

  it('3. no highlights when nothing is selected', () => {
    const { container } = render(
      <Board
        board={createInitialBoard()}
        selectedSquare={null}
        legalMoveSquares={new Set()}
        onSquareClick={vi.fn()}
      />,
    );

    const selectedHighlights = container.querySelectorAll('[data-testid="highlight-selected"]');
    const legalDots = container.querySelectorAll('[data-testid="legal-dot"]');
    expect(selectedHighlights).toHaveLength(0);
    expect(legalDots).toHaveLength(0);
  });

  it('4. capture ring appears on occupied legal destination', () => {
    // White pawn on 21, Black pawn on 17 — square 17 is a legal destination
    // but also has a piece (for the capture ring display, the destination
    // is the landing square, not the captured piece's square)
    let board = emptyBoard();
    board = placePiece(board, 21, PieceColor.White);
    board = placePiece(board, 14, PieceColor.Black);
    // If 14 is a legal destination (a jump landing on an occupied square is unusual,
    // but for ring display we test with a piece on a legal dest square)
    // Let's use a more realistic scenario: legal dest is 14 which has a piece
    const { container } = render(
      <Board
        board={board}
        selectedSquare={square(21)}
        legalMoveSquares={new Set([14])}
        onSquareClick={vi.fn()}
      />,
    );

    const rings = container.querySelectorAll('[data-testid="legal-capture-ring"]');
    expect(rings).toHaveLength(1);
  });

  it('5. onSquareClick is called when clicking a dark square', () => {
    const onSquareClick = vi.fn();
    render(
      <Board
        board={createInitialBoard()}
        onSquareClick={onSquareClick}
        selectablePieces={new Set([21])}
      />,
    );

    const cell = getGridcell('Square 21, white pawn');
    fireEvent.click(cell);

    expect(onSquareClick).toHaveBeenCalledWith(square(21));
  });

  it('6. cursor is pointer on selectable pieces', () => {
    render(
      <Board
        board={createInitialBoard()}
        selectablePieces={new Set([21, 22])}
        onSquareClick={vi.fn()}
      />,
    );

    const gridcells = screen.getAllByRole('gridcell');
    const sq21Cell = gridcells.find(
      (cell) => cell.getAttribute('aria-label') === 'Square 21, white pawn',
    );

    expect(sq21Cell).toBeDefined();
    if (sq21Cell) {
      expect(sq21Cell.style.cursor).toBe('pointer');
    }
  });

  it('7. non-selectable pieces do not have pointer cursor', () => {
    render(
      <Board
        board={createInitialBoard()}
        selectablePieces={new Set([21])}
        onSquareClick={vi.fn()}
      />,
    );

    const gridcells = screen.getAllByRole('gridcell');
    // Square 13 is empty and not selectable
    const sq13Cell = gridcells.find(
      (cell) => cell.getAttribute('aria-label') === 'Square 13, empty',
    );

    expect(sq13Cell).toBeDefined();
    if (sq13Cell) {
      expect(sq13Cell.style.cursor).toBe('default');
    }
  });

  it('highlight uses CSS custom properties, not hardcoded colors', () => {
    const board = createInitialBoard();
    const { container } = render(
      <Board
        board={board}
        selectedSquare={square(21)}
        legalMoveSquares={new Set([17])}
        onSquareClick={vi.fn()}
      />,
    );

    const selectedHighlight = container.querySelector('[data-testid="highlight-selected"]');
    expect(selectedHighlight).not.toBeNull();
    if (selectedHighlight) {
      expect(selectedHighlight.getAttribute('fill')).toBe('var(--highlight-selected)');
    }

    const legalHighlight = container.querySelector('[data-testid="highlight-legal"]');
    expect(legalHighlight).not.toBeNull();
    if (legalHighlight) {
      expect(legalHighlight.getAttribute('fill')).toBe('var(--highlight-legal)');
    }
  });
});
