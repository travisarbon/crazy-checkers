import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromotionPicker } from './PromotionPicker';
import { _clearPieceRegistry } from './PieceRegistry';
import { registerDraughtsPieces } from './assets/draughts';
import { _resetPieceFamilyRegistration } from './assets';
import { crazyTheme } from '../../themes/crazy';

beforeEach(() => {
  _clearPieceRegistry();
  _resetPieceFamilyRegistration();
  registerDraughtsPieces();
});

describe('<PromotionPicker>', () => {
  it('throws when candidates is empty', () => {
    expect(() =>
      render(<PromotionPicker candidates={[]} theme={crazyTheme} onSelect={vi.fn()} />),
    ).toThrow();
  });

  it('renders a dialog with the candidate pieces', () => {
    render(
      <PromotionPicker
        candidates={['king-white', 'pawn-white']}
        theme={crazyTheme}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('option').length).toBe(2);
  });

  it('fires onSelect when a candidate is clicked', () => {
    const onSelect = vi.fn();
    render(
      <PromotionPicker
        candidates={['king-white', 'pawn-white']}
        theme={crazyTheme}
        onSelect={onSelect}
      />,
    );
    const first = screen.getAllByRole('option')[0];
    if (!first) throw new Error('no options rendered');
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith('king-white');
  });

  it('fires onCancel on backdrop click', () => {
    const onCancel = vi.fn();
    render(
      <PromotionPicker
        candidates={['king-white']}
        theme={crazyTheme}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('promotion-backdrop'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('fires onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(
      <PromotionPicker
        candidates={['king-white']}
        theme={crazyTheme}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
