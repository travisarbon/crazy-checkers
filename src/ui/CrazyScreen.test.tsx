import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CrazyScreen from './CrazyScreen';
import { GameMode } from '../engine/types';

function renderCrazy(overrides?: Partial<{
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
      <CrazyScreen
        onBack={onBack}
        onStartGame={onStartGame}
        defaultTimeControl={null}
        savedGameExists={overrides?.savedGameExists ?? false}
        onResumeSavedGame={overrides?.onResumeSavedGame}
      />,
    ),
  };
}

describe('CrazyScreen', () => {
  it('renders with ModeScreenShell', () => {
    renderCrazy();
    expect(screen.getByRole('heading', { name: 'Crazy' })).toBeInTheDocument();
  });

  it('board preview with glow', () => {
    const { container } = renderCrazy();
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toBeInTheDocument();
  });

  it('how-to-play text', () => {
    renderCrazy();
    expect(screen.getAllByText(/multi-jump/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/40 possible events/i)).toBeInTheDocument();
  });

  it('active events reminder callout', () => {
    renderCrazy();
    expect(screen.getByText(/Active Events Indicator/i)).toBeInTheDocument();
  });

  it('GameSetupSection rendered', () => {
    renderCrazy();
    expect(screen.getByText('Game Type')).toBeInTheDocument();
  });

  it('Start Game triggers onStartGame with Crazy mode', () => {
    const onStartGame = vi.fn();
    renderCrazy({ onStartGame });
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      GameMode.Crazy,
      null,
    );
  });

  it('event reference panel exists', () => {
    renderCrazy();
    expect(screen.getByRole('button', { name: /Event Reference/i })).toBeInTheDocument();
  });

  it('event table rendered on expand', () => {
    renderCrazy();
    fireEvent.click(screen.getByRole('button', { name: /Event Reference/i }));
    const table = screen.getByTestId('event-table');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(40);
  });

  it('resume button shown when savedGameExists', () => {
    renderCrazy({ savedGameExists: true, onResumeSavedGame: vi.fn() });
    expect(screen.getByTestId('resume-game-button')).toBeInTheDocument();
  });

  it('resume button hidden when no saved game', () => {
    renderCrazy();
    expect(screen.queryByTestId('resume-game-button')).not.toBeInTheDocument();
  });

  it('stacking overview on expand', () => {
    renderCrazy();
    fireEvent.click(screen.getByRole('button', { name: /Event Reference/i }));
    expect(screen.getByText(/Event Stacking/i)).toBeInTheDocument();
  });

  it('back button navigates', () => {
    const onBack = vi.fn();
    renderCrazy({ onBack });
    fireEvent.click(screen.getByRole('button', { name: /back to previous screen/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
