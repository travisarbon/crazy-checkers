import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GameOverDialog from './GameOverDialog';
import { CrazyEvent, GameMode, GameResultType, GameEndReason, PieceColor } from '../../engine/types';
import type { ActiveEvent, GameResult } from '../../engine/types';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderDialog(
  overrides?: Partial<{
    result: GameResult;
    lastActiveColor: PieceColor;
    onNewGame: () => void;
    onReview: () => void;
  }>,
) {
  const result: GameResult = overrides?.result ?? {
    type: GameResultType.WhiteWin,
    reason: GameEndReason.NoPiecesLeft,
  };
  const onNewGame = overrides?.onNewGame ?? vi.fn();

  return {
    onNewGame,
    ...render(
      <GameOverDialog
        result={result}
        lastActiveColor={overrides?.lastActiveColor ?? PieceColor.Black}
        onNewGame={onNewGame}
        onReview={overrides?.onReview}
      />,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameOverDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Result display ---

  it('renders for white win by capture', () => {
    renderDialog({
      result: { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft },
    });
    expect(screen.getByText('White Wins!')).toBeInTheDocument();
    expect(screen.getByText(/captured/i)).toBeInTheDocument();
  });

  it('renders for black win by no legal moves', () => {
    renderDialog({
      result: { type: GameResultType.BlackWin, reason: GameEndReason.NoLegalMoves },
    });
    expect(screen.getByText('Black Wins!')).toBeInTheDocument();
    expect(screen.getByText(/no legal moves/i)).toBeInTheDocument();
  });

  it('renders for draw by repetition', () => {
    renderDialog({
      result: { type: GameResultType.Draw, reason: GameEndReason.Repetition },
    });
    expect(screen.getByText('Draw!')).toBeInTheDocument();
    expect(screen.getByText(/threefold repetition/i)).toBeInTheDocument();
  });

  it('renders for draw by 40-move rule', () => {
    renderDialog({
      result: { type: GameResultType.Draw, reason: GameEndReason.FortyMoveRule },
    });
    expect(screen.getByText('Draw!')).toBeInTheDocument();
    expect(screen.getByText(/forty consecutive/i)).toBeInTheDocument();
  });

  it('renders for resignation', () => {
    renderDialog({
      result: { type: GameResultType.WhiteWin, reason: GameEndReason.Resignation },
    });
    expect(screen.getByText('White Wins!')).toBeInTheDocument();
    expect(screen.getByText(/resigned/i)).toBeInTheDocument();
  });

  // --- Buttons ---

  it('New Game button calls onNewGame', () => {
    const onNewGame = vi.fn();
    renderDialog({ onNewGame });
    fireEvent.click(screen.getByTestId('game-over-new-game'));
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('Review button is disabled', () => {
    renderDialog();
    const reviewBtn = screen.getByTestId('game-over-review');
    expect(reviewBtn).toBeDisabled();
  });

  it('Review button has placeholder title', () => {
    renderDialog();
    const reviewBtn = screen.getByTestId('game-over-review');
    expect(reviewBtn).toHaveAttribute('title', expect.stringContaining('future update'));
  });

  // --- ARIA / accessibility ---

  it('dialog has correct ARIA role and modal attribute', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('heading has correct ARIA id referenced by aria-labelledby', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    const heading = screen.getByText('White Wins!');
    expect(heading).toHaveAttribute('id', 'game-over-heading');
    expect(dialog).toHaveAttribute('aria-labelledby', 'game-over-heading');
  });

  it('reason has correct ARIA id referenced by aria-describedby', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    const reason = screen.getByText(/captured/i);
    expect(reason).toHaveAttribute('id', 'game-over-reason');
    expect(dialog).toHaveAttribute('aria-describedby', 'game-over-reason');
  });

  // --- Icons ---

  it('renders winner icon for win results', () => {
    renderDialog({
      result: { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft },
    });
    expect(screen.getByTestId('winner-icon')).toBeInTheDocument();
  });

  it('renders draw icon for draw results', () => {
    renderDialog({
      result: { type: GameResultType.Draw, reason: GameEndReason.Repetition },
    });
    expect(screen.getByTestId('draw-icon')).toBeInTheDocument();
  });

  // --- Focus management ---

  it('focuses New Game button on mount after delay', () => {
    renderDialog();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(document.activeElement).toBe(screen.getByTestId('game-over-new-game'));
  });

  // --- Backdrop ---

  it('renders backdrop', () => {
    renderDialog();
    const backdrop = screen.getByTestId('game-over-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  });

  // --- Scroll lock ---

  it('locks body overflow when mounted and restores on unmount', () => {
    const { unmount } = renderDialog();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  // --- Crazy mode enhancements ---

  it('Classic mode game over shows no mode label or event list', () => {
    renderDialog();
    expect(screen.queryByTestId('game-over-mode-label')).not.toBeInTheDocument();
    expect(screen.queryByTestId('game-over-active-events')).not.toBeInTheDocument();
  });

  it('Crazy mode game over with no active events shows mode label only', () => {
    const result: GameResult = { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft };
    render(
      <GameOverDialog
        result={result}
        lastActiveColor={PieceColor.Black}
        mode={GameMode.Crazy}
        activeEvents={[]}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByTestId('game-over-mode-label')).toHaveTextContent('Crazy Mode');
    expect(screen.queryByTestId('game-over-active-events')).not.toBeInTheDocument();
  });

  it('Crazy mode game over with active events lists event names', () => {
    const result: GameResult = { type: GameResultType.BlackWin, reason: GameEndReason.NoLegalMoves };
    const events: ActiveEvent[] = [
      { type: CrazyEvent.KingForADay, remainingPlies: 1, triggeredBy: PieceColor.White, triggeredAtPly: 5 },
      { type: CrazyEvent.OppositeDay, remainingPlies: 14, triggeredBy: PieceColor.Black, triggeredAtPly: 8 },
    ];
    render(
      <GameOverDialog
        result={result}
        lastActiveColor={PieceColor.White}
        mode={GameMode.Crazy}
        activeEvents={events}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByTestId('game-over-mode-label')).toBeInTheDocument();
    const eventsNote = screen.getByTestId('game-over-active-events');
    expect(eventsNote).toHaveTextContent('King for a Day');
    expect(eventsNote).toHaveTextContent('Opposite Day');
  });

  // --- Chaos mode (Task 22.2) ---

  it('Chaos mode game over shows "Chaos Mode" label', () => {
    const result: GameResult = { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft };
    render(
      <GameOverDialog
        result={result}
        lastActiveColor={PieceColor.Black}
        mode={GameMode.Chaos}
        activeEvents={[]}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByTestId('game-over-mode-label')).toHaveTextContent('Chaos Mode');
    expect(screen.queryByTestId('game-over-active-events')).not.toBeInTheDocument();
  });

  it('Chaos mode game over lists active events at game end', () => {
    const result: GameResult = { type: GameResultType.BlackWin, reason: GameEndReason.NoPiecesLeft };
    const events: ActiveEvent[] = [
      { type: CrazyEvent.KingForADay, remainingPlies: 3, triggeredBy: PieceColor.White, triggeredAtPly: 12 },
      { type: CrazyEvent.OppositeDay, remainingPlies: 6, triggeredBy: PieceColor.Black, triggeredAtPly: 14 },
    ];
    render(
      <GameOverDialog
        result={result}
        lastActiveColor={PieceColor.White}
        mode={GameMode.Chaos}
        activeEvents={events}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByTestId('game-over-mode-label')).toHaveTextContent('Chaos Mode');
    const eventsNote = screen.getByTestId('game-over-active-events');
    expect(eventsNote).toHaveTextContent('King for a Day');
    expect(eventsNote).toHaveTextContent('Opposite Day');
  });

  it('Chaos mode game over with empty active events omits event list', () => {
    const result: GameResult = { type: GameResultType.Draw, reason: GameEndReason.Repetition };
    render(
      <GameOverDialog
        result={result}
        lastActiveColor={PieceColor.White}
        mode={GameMode.Chaos}
        activeEvents={[]}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByTestId('game-over-mode-label')).toHaveTextContent('Chaos Mode');
    expect(screen.queryByTestId('game-over-active-events')).not.toBeInTheDocument();
  });
});
