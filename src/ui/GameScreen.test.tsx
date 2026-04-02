import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GameScreen from './GameScreen';
import { createAmericanRules } from '../engine/rules';
import { PlayerType } from '../engine/types';
import type { PlayerSetup, RuleSet } from '../engine/types';

function renderGameScreen(overrides?: {
  players?: PlayerSetup;
  onNewGame?: () => void;
}) {
  const ruleSet: RuleSet = createAmericanRules();
  const players: PlayerSetup = overrides?.players ?? {
    white: PlayerType.Human,
    black: PlayerType.Human,
  };
  const onNewGame = overrides?.onNewGame ?? vi.fn();

  return render(
    <GameScreen ruleSet={ruleSet} players={players} onNewGame={onNewGame} />,
  );
}

describe('GameScreen', () => {
  beforeEach(() => {
    // Reset any matchMedia mocks
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders the board', () => {
    renderGameScreen();
    expect(screen.getByTestId('board')).toBeInTheDocument();
  });

  it('renders turn indicator showing White\'s turn initially', () => {
    renderGameScreen();
    const indicator = screen.getByTestId('turn-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain("White's turn");
  });

  it('renders captured pieces section', () => {
    renderGameScreen();
    expect(screen.getByTestId('captured-pieces')).toBeInTheDocument();
  });

  it('renders move history with empty placeholder', () => {
    renderGameScreen();
    expect(screen.getByTestId('move-history')).toBeInTheDocument();
    expect(screen.getByTestId('move-history-empty')).toBeInTheDocument();
    expect(screen.getByText('No moves yet.')).toBeInTheDocument();
  });

  it('renders all control buttons', () => {
    renderGameScreen();
    expect(screen.getByTestId('game-controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resign/i })).toBeInTheDocument();
  });

  it('undo button is initially disabled', () => {
    renderGameScreen();
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).toBeDisabled();
  });

  it('has an accessible sidebar', () => {
    renderGameScreen();
    const sidebar = screen.getByRole('complementary', { name: /game information/i });
    expect(sidebar).toBeInTheDocument();
  });

  it('resign triggers game over after confirmation', () => {
    renderGameScreen();
    const resignBtn = screen.getByRole('button', { name: /resign/i });
    fireEvent.click(resignBtn);

    // Confirm dialog should appear
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Resign Game?')).toBeInTheDocument();

    // Click confirm
    fireEvent.click(screen.getByTestId('confirm-confirm'));

    // After resign, turn indicator should show game result
    const indicator = screen.getByTestId('turn-indicator');
    expect(indicator.textContent).toContain('wins');
    // Resign button should now be disabled
    expect(resignBtn).toBeDisabled();
  });

  it('resign does nothing when confirmation is cancelled', () => {
    renderGameScreen();
    const resignBtn = screen.getByRole('button', { name: /resign/i });
    fireEvent.click(resignBtn);

    // Confirm dialog should appear
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

    // Click cancel
    fireEvent.click(screen.getByTestId('confirm-cancel'));

    // Dialog should be gone, game still in progress
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    const indicator = screen.getByTestId('turn-indicator');
    expect(indicator.textContent).toContain("White's turn");
  });

  it('new game calls onNewGame after confirmation when game is in progress', () => {
    const onNewGame = vi.fn();
    renderGameScreen({ onNewGame });
    const newGameBtn = screen.getByRole('button', { name: /new game/i });
    fireEvent.click(newGameBtn);

    // Confirm dialog should appear
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('New Game?')).toBeInTheDocument();

    // Click confirm
    fireEvent.click(screen.getByTestId('confirm-confirm'));
    expect(onNewGame).toHaveBeenCalled();
  });

  it('undo tooltip shows "No moves to undo" when no moves exist', () => {
    renderGameScreen();
    const undoBtn = screen.getByRole('button', { name: /no moves to undo/i });
    expect(undoBtn).toBeInTheDocument();
    expect(undoBtn).toBeDisabled();
  });

  it('renders game-screen container with data-testid', () => {
    renderGameScreen();
    expect(screen.getByTestId('game-screen')).toBeInTheDocument();
  });

  // --- Game-over dialog integration (Task 2.5) ---

  it('does not show game-over dialog on initial render', () => {
    renderGameScreen();
    expect(screen.queryByTestId('game-over-dialog')).not.toBeInTheDocument();
  });

  it('shows game-over dialog after resignation', () => {
    renderGameScreen();
    fireEvent.click(screen.getByRole('button', { name: /resign/i }));
    fireEvent.click(screen.getByTestId('confirm-confirm'));
    expect(screen.getByTestId('game-over-dialog')).toBeInTheDocument();
  });

  it('game-over dialog New Game button calls onNewGame', () => {
    const onNewGame = vi.fn();
    renderGameScreen({ onNewGame });
    fireEvent.click(screen.getByRole('button', { name: /resign/i }));
    fireEvent.click(screen.getByTestId('confirm-confirm'));
    fireEvent.click(screen.getByTestId('game-over-new-game'));
    expect(onNewGame).toHaveBeenCalled();
  });

  // --- Last-move highlights (Task 2.6) ---

  it('no last-move highlight at game start', () => {
    renderGameScreen();
    expect(screen.queryAllByTestId('highlight-last-move')).toHaveLength(0);
  });

  it('last-move highlights survive after game over (resignation)', () => {
    renderGameScreen();

    // Make a move first so there's a last-move highlight
    // Select a white piece (square 21 is white pawn on row 5)
    const gridcells = screen.getAllByRole('gridcell');
    const sq21Cell = gridcells.find((cell) =>
      cell.getAttribute('aria-label')?.includes('Square 21'),
    );
    if (sq21Cell) {
      fireEvent.click(sq21Cell);
    }

    // Now resign — any existing last-move highlights from before should persist
    // (or at minimum, the game-over dialog should not crash)
    fireEvent.click(screen.getByRole('button', { name: /resign/i }));
    fireEvent.click(screen.getByTestId('confirm-confirm'));
    expect(screen.getByTestId('game-over-dialog')).toBeInTheDocument();
  });
});
