import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PiecePalette } from './PiecePalette';
import { _clearPieceRegistry } from './PieceRegistry';
import { registerDraughtsPieces } from './assets/draughts';
import { _resetPieceFamilyRegistration } from './assets';
import { DRAUGHTS_PIECE_VOCABULARY } from '../../engine/classified/pieceVocabulary';
import { crazyTheme } from '../../themes/crazy';

beforeEach(() => {
  _clearPieceRegistry();
  _resetPieceFamilyRegistration();
  registerDraughtsPieces();
});

describe('<PiecePalette>', () => {
  it('renders every vocabulary entry as an option', () => {
    const onSelect = vi.fn();
    render(
      <PiecePalette
        entries={DRAUGHTS_PIECE_VOCABULARY.onBoard}
        theme={crazyTheme}
        onSelect={onSelect}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(4);
  });

  it('filters by owner when requested', () => {
    const onSelect = vi.fn();
    render(
      <PiecePalette
        entries={DRAUGHTS_PIECE_VOCABULARY.onBoard}
        theme={crazyTheme}
        onSelect={onSelect}
        owner="white"
      />,
    );
    expect(screen.getAllByRole('option').length).toBe(2);
  });

  it('fires onSelect when an option is clicked', () => {
    const onSelect = vi.fn();
    render(
      <PiecePalette
        entries={DRAUGHTS_PIECE_VOCABULARY.onBoard}
        theme={crazyTheme}
        onSelect={onSelect}
      />,
    );
    const pawn = screen.getAllByRole('option')[0];
    if (!pawn) throw new Error('no options rendered');
    fireEvent.click(pawn);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('pawn-white');
  });

  it('supports keyboard activation with Enter', () => {
    const onSelect = vi.fn();
    render(
      <PiecePalette
        entries={DRAUGHTS_PIECE_VOCABULARY.onBoard}
        theme={crazyTheme}
        onSelect={onSelect}
      />,
    );
    const listbox = screen.getByTestId('piece-palette');
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalled();
  });
});
