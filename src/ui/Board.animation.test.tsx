import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Board from './Board';
import type { AnimatingPiece } from './useAnimationQueue';
import type { BoardState } from '../engine/types';
import { PieceColor, PieceType, square } from '../engine/types';

// Helper: create a board with a single piece
function boardWithPiece(sq: number, color = PieceColor.White, type = PieceType.Pawn): BoardState {
  const board = new Array(32).fill(null) as BoardState;
  const mutable = [...board];
  mutable[sq - 1] = { color, type };
  return mutable;
}

describe('Board animation integration', () => {
  it('renders piece at override position when animatingPieces is provided', () => {
    const board = boardWithPiece(11);
    const animatingPieces = new Map<number, AnimatingPiece>([
      [11, { overridePosition: { cx: 400, cy: 400 }, opacity: null, scale: null }],
    ]);

    const { container } = render(
      <Board board={board} animatingPieces={animatingPieces} />,
    );

    const pieceG = container.querySelector('[data-testid="piece"]');
    expect(pieceG).not.toBeNull();

    if (pieceG === null) return;
    // The piece should have its transform overridden to the animation position
    const transform = pieceG.getAttribute('transform');
    expect(transform).toContain('translate(400, 400)');
  });

  it('renders piece with transition style when animation duration > 0', () => {
    const board = boardWithPiece(11);
    const animatingPieces = new Map<number, AnimatingPiece>([
      [11, { overridePosition: { cx: 400, cy: 400 }, opacity: null, scale: null }],
    ]);

    const { container } = render(
      <Board board={board} animatingPieces={animatingPieces} animSpeedMultiplier={1.0} />,
    );

    const pieceG = container.querySelector('[data-testid="piece"]');
    expect(pieceG).not.toBeNull();

    if (pieceG === null) return;
    // The piece should have the pieceAnimating class (with will-change)
    expect(pieceG.classList.toString()).toContain('pieceAnimating');
  });

  it('renders captured piece with opacity 0 when in fadingSquares', () => {
    const board = boardWithPiece(14, PieceColor.Black);
    const fadingSquares = new Set<number>([14]);

    const { container } = render(
      <Board board={board} fadingSquares={fadingSquares} />,
    );

    const pieceG = container.querySelector('[data-testid="piece"]');
    expect(pieceG).not.toBeNull();

    if (pieceG === null) return;
    expect(pieceG.getAttribute('style')).toContain('opacity: 0');
  });

  it('suppresses clicks during animation', () => {
    const board = boardWithPiece(11);
    const onSquareClick = vi.fn();

    render(
      <Board
        board={board}
        isAnimating={true}
        onSquareClick={onSquareClick}
        selectablePieces={new Set([11])}
      />,
    );

    // Find a gridcell and click it
    const gridcells = screen.getAllByRole('gridcell');
    // Click all gridcells — none should trigger the callback
    for (const cell of gridcells) {
      fireEvent.click(cell);
    }

    expect(onSquareClick).not.toHaveBeenCalled();
  });

  it('does not show legal move dots during animation', () => {
    const board = boardWithPiece(11);

    const { container } = render(
      <Board
        board={board}
        isAnimating={true}
        legalMoveSquares={new Set([15, 16])}
      />,
    );

    const legalDots = container.querySelectorAll('[data-testid="legal-dot"]');
    expect(legalDots).toHaveLength(0);
  });

  it('does not show selected highlight during animation', () => {
    const board = boardWithPiece(11);

    const { container } = render(
      <Board
        board={board}
        isAnimating={true}
        selectedSquare={square(11)}
      />,
    );

    const highlights = container.querySelectorAll('[data-testid="highlight-selected"]');
    expect(highlights).toHaveLength(0);
  });

  it('renders piece without animation props normally (backward compatibility)', () => {
    const board = boardWithPiece(11);

    const { container } = render(<Board board={board} />);

    const pieceG = container.querySelector('[data-testid="piece"]');
    expect(pieceG).not.toBeNull();

    if (pieceG === null) return;
    // Should have default transform (no animation override)
    const transform = pieceG.getAttribute('transform');
    expect(transform).toContain('scale(1)');
    // Should have no transition
    const style = pieceG.getAttribute('style');
    expect(style).toContain('transition: none');
  });

  it('renders piece with scale override for king pulse', () => {
    const board = boardWithPiece(1, PieceColor.White, PieceType.King);
    const animatingPieces = new Map<number, AnimatingPiece>([
      [1, { overridePosition: { cx: 150, cy: 50 }, opacity: null, scale: 1.15 }],
    ]);

    const { container } = render(
      <Board board={board} animatingPieces={animatingPieces} />,
    );

    const pieceG = container.querySelector('[data-testid="piece"]');
    expect(pieceG).not.toBeNull();

    if (pieceG === null) return;
    const transform = pieceG.getAttribute('transform');
    expect(transform).toContain('scale(1.15)');
  });
});
