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
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderGameScreen();
    const resignBtn = screen.getByRole('button', { name: /resign/i });
    fireEvent.click(resignBtn);
    // After resign, turn indicator should show game result
    const indicator = screen.getByTestId('turn-indicator');
    expect(indicator.textContent).toContain('wins');
    // Resign button should now be disabled
    expect(resignBtn).toBeDisabled();
  });

  it('resign does nothing when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderGameScreen();
    const resignBtn = screen.getByRole('button', { name: /resign/i });
    fireEvent.click(resignBtn);
    const indicator = screen.getByTestId('turn-indicator');
    expect(indicator.textContent).toContain("White's turn");
  });

  it('new game calls onNewGame after confirmation when game is in progress', () => {
    const onNewGame = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderGameScreen({ onNewGame });
    const newGameBtn = screen.getByRole('button', { name: /new game/i });
    fireEvent.click(newGameBtn);
    expect(window.confirm).toHaveBeenCalled();
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
});
