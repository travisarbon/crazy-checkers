import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrainingTool from './TrainingTool';

vi.mock('../../persistence/gameHistory', async () => {
  const actual = await vi.importActual<typeof import('../../persistence/gameHistory')>(
    '../../persistence/gameHistory',
  );
  return {
    ...actual,
    getAllGameRecords: vi.fn(() => Promise.resolve([])),
    getGameRecord: vi.fn(() => Promise.resolve(undefined)),
  };
});

vi.mock('../../cogitate/trainingEngine', async () => {
  const actual = await vi.importActual<typeof import('../../cogitate/trainingEngine')>(
    '../../cogitate/trainingEngine',
  );
  return {
    ...actual,
    loadTrainingPositions: vi.fn(() => Promise.resolve([])),
  };
});

const { loadTrainingPositions } = await import('../../cogitate/trainingEngine');

describe('TrainingTool', () => {
  beforeEach(() => {
    vi.mocked(loadTrainingPositions).mockReset();
    vi.mocked(loadTrainingPositions).mockResolvedValue([]);
  });

  it('renders the source selection view by default', () => {
    render(<TrainingTool onBack={() => undefined} />);
    const tool = screen.getByTestId('training-tool');
    expect(tool.dataset.phase).toBe('select');
    expect(screen.getByTestId('training-train-all')).toBeInTheDocument();
    expect(screen.getByTestId('training-select-home-shortcut')).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<TrainingTool onBack={onBack} />);
    fireEvent.click(screen.getByTestId('training-back-to-home'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly error when no training positions are found', async () => {
    render(<TrainingTool onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId('training-train-all'));
    await waitFor(() => {
      expect(screen.getByTestId('training-selection-error')).toBeInTheDocument();
    });
  });

  it('filters game list via the shared game history browser', () => {
    render(<TrainingTool onBack={() => undefined} />);
    // Mode filtering now lives exclusively in GameHistoryBrowser's dropdown.
    expect(screen.getByTestId('game-history-browser')).toBeInTheDocument();
  });
});
