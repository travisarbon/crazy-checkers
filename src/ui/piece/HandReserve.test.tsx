import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HandReserve } from './HandReserve';
import { _clearPieceRegistry } from './PieceRegistry';
import { registerShogiPieces } from './assets/shogi';
import { _resetPieceFamilyRegistration } from './assets';
import {
  asPieceVocabularyId,
  createPieceVocabulary,
} from '../../engine/classified/pieceVocabulary';
import { crazyTheme } from '../../themes/crazy';

const TEST_VOCAB = createPieceVocabulary(
  asPieceVocabularyId('shogi-standard'),
  [{ pieceId: 'shogi-king-white', displayName: 'King', owner: 'white' }],
  [
    { pieceId: 'shogi-pawn-white', displayName: 'Pawn', owner: 'white' },
    { pieceId: 'shogi-rook-white', displayName: 'Rook', owner: 'white' },
  ],
);

beforeEach(() => {
  _clearPieceRegistry();
  _resetPieceFamilyRegistration();
  registerShogiPieces();
});

describe('<HandReserve>', () => {
  it('renders own and opponent columns', () => {
    render(
      <HandReserve
        vocabulary={TEST_VOCAB}
        ownHandCounts={{ 'shogi-pawn-white': 2 }}
        opponentHandCounts={{ 'shogi-rook-white': 1 }}
        theme={crazyTheme}
      />,
    );
    expect(screen.getByText('Your hand')).toBeInTheDocument();
    expect(screen.getByText('Opponent hand')).toBeInTheDocument();
  });

  it('emits onDropRequest when a hand piece is clicked', () => {
    const onDropRequest = vi.fn();
    const { container } = render(
      <HandReserve
        vocabulary={TEST_VOCAB}
        ownHandCounts={{ 'shogi-pawn-white': 3 }}
        opponentHandCounts={{}}
        theme={crazyTheme}
        onDropRequest={onDropRequest}
      />,
    );
    const pawn = container.querySelector<HTMLButtonElement>(
      'button[data-piece-id="shogi-pawn-white"][data-count="3"]',
    );
    if (!pawn) throw new Error('no pawn with count=3');
    fireEvent.click(pawn);
    expect(onDropRequest).toHaveBeenCalledWith('shogi-pawn-white');
  });

  it('disables a zero-count group', () => {
    const { container } = render(
      <HandReserve
        vocabulary={TEST_VOCAB}
        ownHandCounts={{ 'shogi-pawn-white': 0 }}
        opponentHandCounts={{}}
        theme={crazyTheme}
        onDropRequest={vi.fn()}
      />,
    );
    const pawn = container.querySelector<HTMLButtonElement>(
      'button[data-piece-id="shogi-pawn-white"]',
    );
    expect(pawn).toBeDisabled();
  });

  it('throws on negative count', () => {
    expect(() =>
      render(
        <HandReserve
          vocabulary={TEST_VOCAB}
          ownHandCounts={{ 'shogi-pawn-white': -1 }}
          opponentHandCounts={{}}
          theme={crazyTheme}
        />,
      ),
    ).toThrow(/negative count/);
  });

  it('throws on unknown pieceId', () => {
    expect(() =>
      render(
        <HandReserve
          vocabulary={TEST_VOCAB}
          ownHandCounts={{ 'not-a-piece': 1 }}
          opponentHandCounts={{}}
          theme={crazyTheme}
        />,
      ),
    ).toThrow(/unknown pieceId/);
  });
});
