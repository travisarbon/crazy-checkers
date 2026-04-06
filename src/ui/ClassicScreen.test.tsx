import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClassicScreen from './ClassicScreen';
import { GameMode } from '../engine/types';

function renderClassic(overrides?: Partial<{
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
      <ClassicScreen
        onBack={onBack}
        onStartGame={onStartGame}
        defaultTimeControl={null}
        savedGameExists={overrides?.savedGameExists ?? false}
        onResumeSavedGame={overrides?.onResumeSavedGame}
      />,
    ),
  };
}

describe('ClassicScreen', () => {
  it('renders with ModeScreenShell', () => {
    renderClassic();
    expect(screen.getByRole('heading', { name: 'Classic' })).toBeInTheDocument();
  });

  it('board preview rendered', () => {
    const { container } = renderClassic();
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toBeInTheDocument();
  });

  it('how-to-play text', () => {
    renderClassic();
    expect(screen.getAllByText(/Captures are mandatory/i).length).toBeGreaterThanOrEqual(1);
  });

  it('GameSetupSection rendered', () => {
    renderClassic();
    expect(screen.getByText('Game Type')).toBeInTheDocument();
  });

  it('Start Game button present', () => {
    renderClassic();
    expect(screen.getByTestId('start-game-button')).toBeInTheDocument();
  });

  it('Start Game triggers onStartGame with Classic mode', () => {
    const onStartGame = vi.fn();
    renderClassic({ onStartGame });
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      GameMode.Classic,
      null,
    );
  });

  it('expanded detail panel exists', () => {
    renderClassic();
    expect(screen.getByRole('button', { name: /Learn More About Classic Checkers/i })).toBeInTheDocument();
  });

  it('detail panel expands', () => {
    renderClassic();
    fireEvent.click(screen.getByRole('button', { name: /Learn More About Classic Checkers/i }));
    expect(screen.getByText(/Arthur Samuel/i)).toBeInTheDocument();
  });

  it('resume button shown when savedGameExists', () => {
    renderClassic({ savedGameExists: true, onResumeSavedGame: vi.fn() });
    expect(screen.getByTestId('resume-game-button')).toBeInTheDocument();
  });

  it('resume button hidden when no saved game', () => {
    renderClassic();
    expect(screen.queryByTestId('resume-game-button')).not.toBeInTheDocument();
  });

  it('resume callback fires', () => {
    const onResumeSavedGame = vi.fn();
    renderClassic({ savedGameExists: true, onResumeSavedGame });
    fireEvent.click(screen.getByTestId('resume-game-button'));
    expect(onResumeSavedGame).toHaveBeenCalledOnce();
  });

  it('piece diagrams in expanded panel', () => {
    const { container } = renderClassic();
    fireEvent.click(screen.getByRole('button', { name: /Learn More About Classic Checkers/i }));
    const diagramSvgs = container.querySelectorAll('svg[role="img"]');
    // 1 main board + 4 diagrams = 5 total
    expect(diagramSvgs.length).toBeGreaterThanOrEqual(5);
  });

  it('back button navigates', () => {
    const onBack = vi.fn();
    renderClassic({ onBack });
    fireEvent.click(screen.getByRole('button', { name: /back to previous screen/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
