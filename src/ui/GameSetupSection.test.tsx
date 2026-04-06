import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GameSetupSection from './GameSetupSection';
import { GameMode, PlayerType } from '../engine/types';

function renderSetup(overrides?: Partial<{
  mode: typeof GameMode[keyof typeof GameMode];
  onStartGame: (...args: unknown[]) => void;
  savedGameExists: boolean;
  onResumeSavedGame: () => void;
}>) {
  const onStartGame = overrides?.onStartGame ?? vi.fn();
  const onResumeSavedGame = overrides?.onResumeSavedGame ?? vi.fn();
  return {
    onStartGame,
    onResumeSavedGame,
    ...render(
      <GameSetupSection
        mode={overrides?.mode ?? GameMode.Classic}
        defaultTimeControl={null}
        onStartGame={onStartGame}
        savedGameExists={overrides?.savedGameExists}
        onResumeSavedGame={overrides?.onResumeSavedGame}
      />,
    ),
  };
}

describe('GameSetupSection', () => {
  it('renders all fieldsets', () => {
    renderSetup();
    expect(screen.getByText('Game Type')).toBeInTheDocument();
    expect(screen.getByText('Player 1 Color')).toBeInTheDocument();
    expect(screen.getByText('Time Control')).toBeInTheDocument();
  });

  it('difficulty hidden by default (pass around)', () => {
    renderSetup();
    expect(screen.queryByTestId('difficulty-fieldset')).not.toBeInTheDocument();
  });

  it('difficulty shown for vs-cpu', () => {
    renderSetup();
    fireEvent.click(screen.getByLabelText('vs. CPU'));
    expect(screen.getByTestId('difficulty-fieldset')).toBeInTheDocument();
  });

  it('Start Game calls onStartGame', () => {
    const onStartGame = vi.fn();
    renderSetup({ onStartGame });
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledOnce();
  });

  it('Pass Around white setup', () => {
    const onStartGame = vi.fn();
    renderSetup({ onStartGame });
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledWith(
      { white: PlayerType.Human, black: PlayerType.Human },
      false,
      GameMode.Classic,
      null,
    );
  });

  it('Pass Around black setup', () => {
    const onStartGame = vi.fn();
    renderSetup({ onStartGame });
    fireEvent.click(screen.getByLabelText('Black'));
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledWith(
      { white: PlayerType.Human, black: PlayerType.Human },
      true,
      GameMode.Classic,
      null,
    );
  });

  it('vs CPU easy white', () => {
    const onStartGame = vi.fn();
    renderSetup({ onStartGame });
    fireEvent.click(screen.getByLabelText('vs. CPU'));
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledWith(
      { white: PlayerType.Human, black: PlayerType.CpuEasy },
      false,
      GameMode.Classic,
      null,
    );
  });

  it('vs CPU hard black', () => {
    const onStartGame = vi.fn();
    renderSetup({ onStartGame });
    fireEvent.click(screen.getByLabelText('vs. CPU'));
    fireEvent.click(screen.getByLabelText('Black'));
    fireEvent.click(screen.getByLabelText('Hard'));
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledWith(
      { white: PlayerType.CpuHard, black: PlayerType.Human },
      true,
      GameMode.Classic,
      null,
    );
  });

  it('resume button visible when savedGameExists', () => {
    renderSetup({ savedGameExists: true, onResumeSavedGame: vi.fn() });
    expect(screen.getByTestId('resume-game-button')).toBeInTheDocument();
  });

  it('resume button hidden when no saved game', () => {
    renderSetup();
    expect(screen.queryByTestId('resume-game-button')).not.toBeInTheDocument();
  });

  it('resume callback fires', () => {
    const onResumeSavedGame = vi.fn();
    renderSetup({ savedGameExists: true, onResumeSavedGame });
    fireEvent.click(screen.getByTestId('resume-game-button'));
    expect(onResumeSavedGame).toHaveBeenCalledOnce();
  });

  it('mode prop passed through', () => {
    const onStartGame = vi.fn();
    renderSetup({ mode: GameMode.Crazy, onStartGame });
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      GameMode.Crazy,
      null,
    );
  });
});
