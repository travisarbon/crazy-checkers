import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Board from './Board';
import { createInitialBoard } from '../engine/board';
import { square } from '../engine/types';

/** Helper to get the class attribute string for an SVG element. */
function getClassAttr(el: Element | null): string {
  return el?.getAttribute('class') ?? '';
}

describe('Board visual polish', () => {
  describe('hover effects — interactive class', () => {
    it('applies boardSquareInteractive class to legal move destination squares', () => {
      const legalMoves = new Set([13, 14]);
      const selectablePieces = new Set([22]);
      const { container } = render(
        <Board
          board={createInitialBoard()}
          legalMoveSquares={legalMoves}
          selectablePieces={selectablePieces}
          selectedSquare={square(22)}
        />,
      );

      const sq13 = container.querySelector('[data-square="13"]');
      const sq14 = container.querySelector('[data-square="14"]');
      expect(getClassAttr(sq13)).toContain('boardSquareInteractive');
      expect(getClassAttr(sq14)).toContain('boardSquareInteractive');
    });

    it('applies boardSquareInteractive class to selectable piece squares', () => {
      const selectablePieces = new Set([21, 22]);
      const { container } = render(
        <Board
          board={createInitialBoard()}
          selectablePieces={selectablePieces}
        />,
      );

      const sq21 = container.querySelector('[data-square="21"]');
      const sq22 = container.querySelector('[data-square="22"]');
      expect(getClassAttr(sq21)).toContain('boardSquareInteractive');
      expect(getClassAttr(sq22)).toContain('boardSquareInteractive');
    });

    it('does not apply boardSquareInteractive to non-interactive squares', () => {
      const selectablePieces = new Set([22]);
      const { container } = render(
        <Board
          board={createInitialBoard()}
          selectablePieces={selectablePieces}
        />,
      );

      const sq1 = container.querySelector('[data-square="1"]');
      expect(getClassAttr(sq1)).not.toContain('boardSquareInteractive');
    });

    it('does not apply boardSquareInteractive during animation', () => {
      const selectablePieces = new Set([22]);
      const legalMoves = new Set([13]);
      const { container } = render(
        <Board
          board={createInitialBoard()}
          selectablePieces={selectablePieces}
          legalMoveSquares={legalMoves}
          isAnimating={true}
        />,
      );

      const sq22 = container.querySelector('[data-square="22"]');
      const sq13 = container.querySelector('[data-square="13"]');
      expect(getClassAttr(sq22)).not.toContain('boardSquareInteractive');
      expect(getClassAttr(sq13)).not.toContain('boardSquareInteractive');
    });
  });

  describe('legal dot animation', () => {
    it('applies legalDot class to legal destination dots', () => {
      const legalMoves = new Set([13]);
      const { container } = render(
        <Board
          board={createInitialBoard()}
          legalMoveSquares={legalMoves}
          selectedSquare={square(22)}
        />,
      );

      const dots = container.querySelectorAll('[data-testid="legal-dot"]');
      for (const dot of dots) {
        expect(dot.getAttribute('class')).toContain('legalDot');
      }
    });
  });

  describe('board border', () => {
    it('has border radius of 6', () => {
      const { container } = render(<Board board={createInitialBoard()} />);
      const borderRect = container.querySelector('rect[rx="6"]');
      expect(borderRect).not.toBeNull();
    });
  });

  describe('piece shadow filter', () => {
    it('defines the piece-shadow filter in SVG defs', () => {
      const { container } = render(<Board board={createInitialBoard()} />);
      const filter = container.querySelector('filter#piece-shadow');
      expect(filter).not.toBeNull();
    });

    it('applies filter to pieces when pieceShadow is true', () => {
      render(<Board board={createInitialBoard()} pieceShadow={true} />);
      const pieces = screen.getAllByTestId('piece');
      const withFilter = pieces.filter(
        (p) => p.getAttribute('filter') === 'url(#piece-shadow)',
      );
      expect(withFilter.length).toBeGreaterThan(0);
    });

    it('does not apply filter when pieceShadow is false', () => {
      render(<Board board={createInitialBoard()} pieceShadow={false} />);
      const pieces = screen.getAllByTestId('piece');
      const withFilter = pieces.filter(
        (p) => p.getAttribute('filter') === 'url(#piece-shadow)',
      );
      expect(withFilter).toHaveLength(0);
    });
  });
});
