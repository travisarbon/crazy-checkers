import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { StackPiece } from './StackPiece';
import { _clearPieceRegistry } from './PieceRegistry';
import { registerStackingPieces } from './assets/stacking';
import { registerDraughtsPieces } from './assets/draughts';
import { _resetPieceFamilyRegistration } from './assets';
import { crazyTheme } from '../../themes/crazy';

beforeEach(() => {
  _clearPieceRegistry();
  _resetPieceFamilyRegistration();
  registerDraughtsPieces();
  registerStackingPieces();
});

describe('<StackPiece>', () => {
  it('throws on empty stack', () => {
    expect(() =>
      render(
        <svg>
          <StackPiece stack={[]} position={{ x: 0, y: 0 }} owner="white" theme={crazyTheme} />
        </svg>,
      ),
    ).toThrow();
  });

  it('renders each layer for a small stack', () => {
    const { container } = render(
      <svg>
        <StackPiece
          stack={['pawn-white', 'pawn-white', 'pawn-white']}
          position={{ x: 0, y: 0 }}
          owner="white"
          theme={crazyTheme}
        />
      </svg>,
    );
    const layers = container.querySelectorAll('[data-layer]');
    expect(layers.length).toBe(3);
  });

  it('surfaces a height badge when stack length ≥ threshold', () => {
    render(
      <svg>
        <StackPiece
          stack={new Array(10).fill('pawn-white') as string[]}
          position={{ x: 0, y: 0 }}
          owner="white"
          theme={crazyTheme}
        />
      </svg>,
    );
    expect(screen.getByTestId('stack-height-badge')).toBeInTheDocument();
  });

  it('exposes stack depth in the aria-label', () => {
    const { container } = render(
      <svg>
        <StackPiece
          stack={['pawn-white', 'pawn-white', 'pawn-white', 'pawn-white']}
          position={{ x: 0, y: 0 }}
          owner="white"
          theme={crazyTheme}
          squareLabel="a1"
        />
      </svg>,
    );
    const g = container.querySelector('[data-testid="stack-piece"]');
    expect(g?.getAttribute('aria-label')).toContain('stack of 4');
  });
});
