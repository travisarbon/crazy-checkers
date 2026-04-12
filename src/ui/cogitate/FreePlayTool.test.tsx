import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FreePlayTool from './FreePlayTool';

// Mock worker client — fast-return evaluation and AI moves.
vi.mock('../../ai/workerClient', () => ({
  requestEvaluation: vi.fn(() =>
    Promise.resolve({
      score: 0,
      rawScore: 0,
      isTerminal: false,
      confidence: 1,
    }),
  ),
  requestAIMove: vi.fn(() =>
    Promise.reject(new Error('AI disabled in tests')),
  ),
}));

// Mock game history so the modal renders without IndexedDB.
vi.mock('../../persistence/gameHistory', () => ({
  getAllGameRecords: vi.fn(() => Promise.resolve([])),
  recordGame: vi.fn(() => Promise.resolve('test-id')),
}));

describe('FreePlayTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the editing phase by default', () => {
    render(<FreePlayTool onBack={vi.fn()} />);
    expect(screen.getByTestId('free-play-tool')).toHaveAttribute('data-phase', 'editing');
  });

  it('renders the mode selector and palette', () => {
    render(<FreePlayTool onBack={vi.fn()} />);
    expect(screen.getByTestId('game-mode-selector')).toBeInTheDocument();
    expect(screen.getByTestId('position-editor')).toBeInTheDocument();
    expect(screen.getByTestId('diagram-toolbar')).toBeInTheDocument();
  });

  it('does not render the event editor for classic mode', () => {
    render(<FreePlayTool onBack={vi.fn()} />);
    expect(screen.queryByTestId('event-editor')).toBeNull();
  });

  it('shows the event editor for crazy mode', () => {
    render(<FreePlayTool onBack={vi.fn()} />);
    fireEvent.change(screen.getByTestId('game-mode-selector-select'), {
      target: { value: 'crazy' },
    });
    expect(screen.getByTestId('event-editor')).toBeInTheDocument();
  });

  it('triggers back callback', () => {
    const onBack = vi.fn();
    render(<FreePlayTool onBack={onBack} />);
    fireEvent.click(screen.getByTestId('freeplay-back-to-home'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens and closes the Load Position modal', () => {
    render(<FreePlayTool onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('editor-load-position'));
    expect(screen.getByTestId('freeplay-load-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('freeplay-load-close'));
    expect(screen.queryByTestId('freeplay-load-modal')).toBeNull();
  });

  it('transitions to playing phase when Start Game pressed (pass-and-play)', async () => {
    render(<FreePlayTool onBack={vi.fn()} />);
    // Select Pass & Play so no AI attempt.
    const humanRadios = screen.getAllByDisplayValue('human');
    fireEvent.click(humanRadios[0] as HTMLElement);
    fireEvent.click(screen.getByTestId('freeplay-start-game'));
    await waitFor(() => {
      expect(screen.getByTestId('free-play-tool')).toHaveAttribute(
        'data-phase',
        'playing',
      );
    });
  });

  it('renders Back to Editor in playing phase', async () => {
    render(<FreePlayTool onBack={vi.fn()} />);
    const humanRadios = screen.getAllByDisplayValue('human');
    fireEvent.click(humanRadios[0] as HTMLElement);
    fireEvent.click(screen.getByTestId('freeplay-start-game'));
    await waitFor(() => {
      expect(screen.getByTestId('freeplay-back-to-editor')).toBeInTheDocument();
    });
  });
});
