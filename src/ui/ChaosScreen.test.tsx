import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChaosScreen from './ChaosScreen';
import { GameMode } from '../engine/types';

function renderChaos(overrides?: Partial<{
  onBack: ReturnType<typeof vi.fn>;
  onStartGame: ReturnType<typeof vi.fn>;
  savedGameExists: boolean;
  onResumeSavedGame: ReturnType<typeof vi.fn>;
}>) {
  const onBack = overrides?.onBack ?? vi.fn();
  const onStartGame = overrides?.onStartGame ?? vi.fn();
  return {
    onBack,
    onStartGame,
    ...render(
      <ChaosScreen
        onBack={onBack}
        onStartGame={onStartGame}
        defaultTimeControl={null}
        savedGameExists={overrides?.savedGameExists ?? false}
        onResumeSavedGame={overrides?.onResumeSavedGame}
      />,
    ),
  };
}

describe('ChaosScreen', () => {
  it('renders with ModeScreenShell', () => {
    renderChaos();
    expect(screen.getByRole('heading', { name: 'Chaos' })).toBeInTheDocument();
  });

  it('board preview with chaos glow', () => {
    renderChaos();
    expect(screen.getByTestId('chaos-glow')).toBeInTheDocument();
  });

  it('how-to-play text', () => {
    renderChaos();
    expect(screen.getAllByText(/every jump/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/victory lap/i).length).toBeGreaterThanOrEqual(1);
  });

  it('chaos intro in expanded detail', () => {
    renderChaos();
    fireEvent.click(screen.getByRole('button', { name: /Event Reference/i }));
    expect(screen.getByText(/How Chaos Differs from Crazy/i)).toBeInTheDocument();
  });

  it('GameSetupSection with Chaos mode', () => {
    renderChaos();
    expect(screen.getByText('Game Type')).toBeInTheDocument();
  });

  it('Start Game triggers onStartGame with Chaos mode', () => {
    const onStartGame = vi.fn();
    renderChaos({ onStartGame });
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      GameMode.Chaos,
      null,
    );
  });

  it('event reference panel exists', () => {
    renderChaos();
    expect(screen.getByRole('button', { name: /Event Reference/i })).toBeInTheDocument();
  });

  it('resume button conditional', () => {
    renderChaos({ savedGameExists: true, onResumeSavedGame: vi.fn() });
    expect(screen.getByTestId('resume-game-button')).toBeInTheDocument();
  });

  it('back button navigates', () => {
    const onBack = vi.fn();
    renderChaos({ onBack });
    fireEvent.click(screen.getByRole('button', { name: /back to previous screen/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
