import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MenuScreen from './MenuScreen';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderMenu(
  overrides?: Partial<{
    onStartGame: () => void;
    onConfigure: () => void;
  }>,
) {
  const onStartGame = overrides?.onStartGame ?? vi.fn();
  const onConfigure = overrides?.onConfigure ?? vi.fn();
  return {
    onStartGame,
    onConfigure,
    ...render(<MenuScreen onStartGame={onStartGame} onConfigure={onConfigure} />),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MenuScreen', () => {
  it('renders game title', () => {
    renderMenu();
    expect(screen.getByText('Crazy Checkers')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    renderMenu();
    expect(screen.getByText('A chaotic twist on a timeless classic')).toBeInTheDocument();
  });

  it('renders all 7 visible mode buttons', () => {
    renderMenu();
    const nav = screen.getByRole('navigation', { name: /game modes/i });
    const buttons = nav.querySelectorAll('button');
    expect(buttons).toHaveLength(7);
  });

  it('Classic button is enabled', () => {
    renderMenu();
    const btn = screen.getByRole('button', { name: 'Classic' });
    expect(btn).not.toBeDisabled();
  });

  it('Configure button is enabled', () => {
    renderMenu();
    const btn = screen.getByRole('button', { name: 'Configure' });
    expect(btn).not.toBeDisabled();
  });

  it('Crazy button is enabled', () => {
    renderMenu();
    const btn = screen.getByRole('button', { name: 'Crazy' });
    expect(btn).not.toBeDisabled();
  });

  it('disabled modes show "Coming Soon" badge', () => {
    renderMenu();
    const disabledLabels = ['Challenge', 'Code', 'Cogitate', 'Career'];
    for (const label of disabledLabels) {
      const btn = screen.getByRole('button', { name: `${label} — Coming Soon` });
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent('Coming Soon');
    }
  });

  it('clicking Classic opens game-setup dialog', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(screen.getByTestId('game-setup-dialog')).toBeInTheDocument();
  });

  it('clicking Configure calls onConfigure', () => {
    const onConfigure = vi.fn();
    renderMenu({ onConfigure });
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(onConfigure).toHaveBeenCalledOnce();
  });

  it('clicking Crazy opens game-setup dialog', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Crazy' }));
    expect(screen.getByTestId('game-setup-dialog')).toBeInTheDocument();
  });

  it('disabled buttons do not trigger actions', () => {
    const onStartGame = vi.fn();
    const onConfigure = vi.fn();
    renderMenu({ onStartGame, onConfigure });
    fireEvent.click(screen.getByRole('button', { name: 'Challenge — Coming Soon' }));
    expect(onStartGame).not.toHaveBeenCalled();
    expect(onConfigure).not.toHaveBeenCalled();
    expect(screen.queryByTestId('game-setup-dialog')).not.toBeInTheDocument();
  });
});
