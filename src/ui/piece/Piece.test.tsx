import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { Piece } from './Piece';
import { _clearPieceRegistry } from './PieceRegistry';
import { registerDraughtsPieces } from './assets/draughts';
import { _resetPieceFamilyRegistration } from './assets';
import { crazyTheme } from '../../themes/crazy';

function inSvg(ui: ReactElement) {
  return render(<svg>{ui}</svg>);
}

beforeEach(() => {
  _clearPieceRegistry();
  _resetPieceFamilyRegistration();
  registerDraughtsPieces();
});

describe('<Piece>', () => {
  it('renders a draughts pawn circle with theme fill', () => {
    const { container } = inSvg(
      <Piece
        pieceId="pawn-white"
        owner="white"
        position={{ x: 10, y: 10 }}
        theme={crazyTheme}
      />,
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe(crazyTheme.pieceWhite);
    expect(circle?.getAttribute('stroke')).toBe(crazyTheme.pieceWhiteStroke);
  });

  it('renders a crown glyph for a king', () => {
    inSvg(
      <Piece
        pieceId="king-white"
        owner="white"
        position={{ x: 10, y: 10 }}
        theme={crazyTheme}
      />,
    );
    expect(screen.getByTestId('crown')).toBeInTheDocument();
  });

  it('renders a halo when selected', () => {
    inSvg(
      <Piece
        pieceId="pawn-white"
        owner="white"
        position={{ x: 0, y: 0 }}
        theme={crazyTheme}
        selected
      />,
    );
    expect(screen.getByTestId('piece-halo')).toBeInTheDocument();
  });

  it('uses computed aria-label with square context', () => {
    const { container } = inSvg(
      <Piece
        pieceId="king-black"
        owner="black"
        position={{ x: 0, y: 0 }}
        theme={crazyTheme}
        squareLabel="5"
        selected
      />,
    );
    const piece = container.querySelector('[data-testid="piece"]');
    expect(piece?.getAttribute('aria-label')).toBe(
      'Black king on square 5 — selected',
    );
  });
});
