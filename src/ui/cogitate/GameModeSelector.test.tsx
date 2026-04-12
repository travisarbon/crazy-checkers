import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GameModeSelector from './GameModeSelector';
import '../../cogitate/adapters/registerAll';

describe('GameModeSelector', () => {
  it('renders at least the Standard modes', () => {
    const onSelect = vi.fn();
    render(
      <GameModeSelector
        selectedModeId="classic"
        onModeSelect={onSelect}
        availableModeIds={['classic', 'crazy', 'chaos']}
      />,
    );
    const select = screen.getByTestId('game-mode-selector-select');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).toContain('classic');
    expect(options).toContain('crazy');
    expect(options).toContain('chaos');
  });

  it('groups modes into Standard / Choice sections', () => {
    render(
      <GameModeSelector
        selectedModeId="classic"
        onModeSelect={vi.fn()}
        availableModeIds={['classic', 'crazy', 'choice-king-for-a-day']}
      />,
    );
    const select = screen.getByTestId('game-mode-selector-select');
    const labels = Array.from(select.querySelectorAll('optgroup')).map((g) => g.getAttribute('label'));
    expect(labels).toContain('Standard');
    expect(labels).toContain('Choice');
  });

  it('fires onModeSelect with the chosen id', () => {
    const onSelect = vi.fn();
    render(
      <GameModeSelector
        selectedModeId="classic"
        onModeSelect={onSelect}
        availableModeIds={['classic', 'crazy']}
      />,
    );
    const select = screen.getByTestId('game-mode-selector-select');
    fireEvent.change(select, { target: { value: 'crazy' } });
    expect(onSelect).toHaveBeenCalledWith('crazy');
  });

  it('falls back to the registered adapters when no override is given', () => {
    render(
      <GameModeSelector selectedModeId="classic" onModeSelect={vi.fn()} />,
    );
    const select = screen.getByTestId('game-mode-selector-select');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).toContain('classic');
  });
});
