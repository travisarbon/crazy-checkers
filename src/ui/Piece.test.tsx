import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Piece from './Piece';
import { PieceColor, PieceType, square } from '../engine/types';

// Helper: Piece must be rendered inside an SVG for valid DOM
function renderInSvg(ui: React.ReactElement) {
  return render(<svg>{ui}</svg>);
}

describe('Piece', () => {
  it('renders a circle for a pawn', () => {
    const { container } = renderInSvg(
      <Piece
        piece={{ color: PieceColor.White, type: PieceType.Pawn }}
        sq={square(22)}
        cx={150}
        cy={550}
      />,
    );
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute('fill')).toBe('var(--piece-white)');
    expect(circle!.getAttribute('stroke')).toBe('var(--piece-white-stroke)');
  });

  it('renders a circle and crown path for a king', () => {
    const { container } = renderInSvg(
      <Piece
        piece={{ color: PieceColor.Black, type: PieceType.King }}
        sq={square(5)}
        cx={50}
        cy={150}
      />,
    );
    const circle = container.querySelector('circle');
    const crown = container.querySelector('[data-testid="crown"]');
    expect(circle).not.toBeNull();
    expect(crown).not.toBeNull();
  });

  it('does not render a crown for a pawn', () => {
    const { container } = renderInSvg(
      <Piece
        piece={{ color: PieceColor.White, type: PieceType.Pawn }}
        sq={square(22)}
        cx={150}
        cy={550}
      />,
    );
    const crown = container.querySelector('[data-testid="crown"]');
    expect(crown).toBeNull();
  });

  it('has correct ARIA label for a white pawn', () => {
    renderInSvg(
      <Piece
        piece={{ color: PieceColor.White, type: PieceType.Pawn }}
        sq={square(22)}
        cx={150}
        cy={550}
      />,
    );
    const piece = screen.getByTestId('piece');
    expect(piece).toHaveAttribute('aria-label', 'White pawn on square 22');
  });

  it('has correct ARIA label for a black king', () => {
    renderInSvg(
      <Piece
        piece={{ color: PieceColor.Black, type: PieceType.King }}
        sq={square(5)}
        cx={50}
        cy={150}
      />,
    );
    const piece = screen.getByTestId('piece');
    expect(piece).toHaveAttribute('aria-label', 'Black king on square 5');
  });

  it('uses correct colors for a black piece', () => {
    const { container } = renderInSvg(
      <Piece
        piece={{ color: PieceColor.Black, type: PieceType.Pawn }}
        sq={square(3)}
        cx={250}
        cy={50}
      />,
    );
    const circle = container.querySelector('circle');
    expect(circle!.getAttribute('fill')).toBe('var(--piece-black)');
    expect(circle!.getAttribute('stroke')).toBe('var(--piece-black-stroke)');
  });

  it('positions the circle at the given cx/cy', () => {
    const { container } = renderInSvg(
      <Piece
        piece={{ color: PieceColor.White, type: PieceType.Pawn }}
        sq={square(15)}
        cx={350}
        cy={450}
      />,
    );
    const circle = container.querySelector('circle');
    expect(circle!.getAttribute('cx')).toBe('350');
    expect(circle!.getAttribute('cy')).toBe('450');
  });
});
