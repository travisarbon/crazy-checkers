import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GameSetupDialog from './GameSetupDialog';
import { GameMode, PlayerType } from '../../engine/types';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderDialog(
  overrides?: Partial<{
    onConfirm: (...args: unknown[]) => void;
    onCancel: () => void;
    mode: GameMode;
  }>,
) {
  const onConfirm = overrides?.onConfirm ?? vi.fn();
  const onCancel = overrides?.onCancel ?? vi.fn();
  const mode = overrides?.mode ?? GameMode.Classic;
  return {
    onConfirm,
    onCancel,
    ...render(<GameSetupDialog mode={mode} defaultTimeControl={null} onConfirm={onConfirm} onCancel={onCancel} />),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameSetupDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with default selections (Pass Around, White, no difficulty)', () => {
    renderDialog();
    const passAroundRadio = screen.getByLabelText(/pass around/i);
    expect(passAroundRadio).toBeChecked();
    const whiteRadio = screen.getByLabelText(/white/i);
    expect(whiteRadio).toBeChecked();
    expect(screen.queryByTestId('difficulty-fieldset')).not.toBeInTheDocument();
  });

  it('switching to vs. CPU shows difficulty fieldset', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/vs\. cpu/i));
    expect(screen.getByTestId('difficulty-fieldset')).toBeInTheDocument();
  });

  it('switching back to Pass Around hides difficulty', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/vs\. cpu/i));
    expect(screen.getByTestId('difficulty-fieldset')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/pass around/i));
    expect(screen.queryByTestId('difficulty-fieldset')).not.toBeInTheDocument();
  });

  it('changes color legend based on game type', () => {
    renderDialog();
    expect(screen.getByText('Player 1 Color')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/vs\. cpu/i));
    expect(screen.getByText('Your Color')).toBeInTheDocument();
  });

  it('confirm with Pass Around + White', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    fireEvent.click(screen.getByTestId('setup-start'));
    expect(onConfirm).toHaveBeenCalledWith(
      { white: PlayerType.Human, black: PlayerType.Human },
      false,
      GameMode.Classic,
      null,
    );
  });

  it('confirm with Pass Around + Black', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    fireEvent.click(screen.getByLabelText('Black'));
    fireEvent.click(screen.getByTestId('setup-start'));
    expect(onConfirm).toHaveBeenCalledWith(
      { white: PlayerType.Human, black: PlayerType.Human },
      true,
      GameMode.Classic,
      null,
    );
  });

  it('confirm with vs. CPU Easy + White', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    fireEvent.click(screen.getByLabelText(/vs\. cpu/i));
    fireEvent.click(screen.getByTestId('setup-start'));
    expect(onConfirm).toHaveBeenCalledWith(
      { white: PlayerType.Human, black: PlayerType.CpuEasy },
      false,
      GameMode.Classic,
      null,
    );
  });

  it('confirm with vs. CPU Hard + Black', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    fireEvent.click(screen.getByLabelText(/vs\. cpu/i));
    fireEvent.click(screen.getByLabelText('Hard'));
    fireEvent.click(screen.getByLabelText('Black'));
    fireEvent.click(screen.getByTestId('setup-start'));
    expect(onConfirm).toHaveBeenCalledWith(
      { white: PlayerType.CpuHard, black: PlayerType.Human },
      true,
      GameMode.Classic,
      null,
    );
  });

  it('cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    fireEvent.click(screen.getByTestId('setup-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Escape key calls onCancel', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('dialog has correct ARIA attributes', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'setup-title');
  });

  it('locks body overflow when mounted and restores on unmount', () => {
    const { unmount } = renderDialog();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('clicking overlay calls onCancel', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    fireEvent.click(screen.getByTestId('setup-overlay'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('displays "Crazy Mode" header when mode is Crazy', () => {
    renderDialog({ mode: GameMode.Crazy });
    expect(screen.getByText('Crazy Mode')).toBeInTheDocument();
  });

  it('confirm with Crazy mode passes mode in callback', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm, mode: GameMode.Crazy });
    fireEvent.click(screen.getByTestId('setup-start'));
    expect(onConfirm).toHaveBeenCalledWith(
      { white: PlayerType.Human, black: PlayerType.Human },
      false,
      GameMode.Crazy,
      null,
    );
  });
});
