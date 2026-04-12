import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../ai/workerClient', () => ({
  requestEvaluation: vi.fn(() =>
    Promise.resolve({ score: 0, rawScore: 0, isTerminal: false, confidence: 1 }),
  ),
  requestAIMove: vi.fn(() => Promise.reject(new Error('AI disabled in tests'))),
}));

vi.mock('../persistence/gameHistory', () => ({
  getAllGameRecords: vi.fn(() => Promise.resolve([])),
  recordGame: vi.fn(() => Promise.resolve('test')),
  getGameRecordCount: vi.fn(),
  hasAnalyzedGamesWithTrainingPositions: vi.fn(),
  updateGameRecord: vi.fn(() => Promise.resolve()),
}));

import {
  getGameRecordCount,
  hasAnalyzedGamesWithTrainingPositions,
} from '../persistence/gameHistory';
import CogitateScreen from './CogitateScreen';

const mockedCount = vi.mocked(getGameRecordCount);
const mockedTraining = vi.mocked(hasAnalyzedGamesWithTrainingPositions);

describe('CogitateScreen', () => {
  beforeEach(() => {
    mockedCount.mockReset();
    mockedTraining.mockReset();
    mockedCount.mockResolvedValue(0);
    mockedTraining.mockResolvedValue(false);
  });

  it('renders all four tool cards', async () => {
    render(<CogitateScreen onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('cogitate-tool-freeplay-launch')).not.toBeDisabled(),
    );
    expect(screen.getByTestId('cogitate-tool-replay')).toBeInTheDocument();
    expect(screen.getByTestId('cogitate-tool-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('cogitate-tool-training')).toBeInTheDocument();
    expect(screen.getByTestId('cogitate-tool-freeplay')).toBeInTheDocument();
  });

  it('disables Replay/Analysis/Training with no games', async () => {
    render(<CogitateScreen onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('cogitate-tool-replay-launch')).toBeDisabled();
    });
    expect(screen.getByTestId('cogitate-tool-replay-launch').textContent).toBe('Unavailable');
    expect(screen.getByTestId('cogitate-tool-analysis-launch')).toBeDisabled();
    expect(screen.getByTestId('cogitate-tool-training-launch')).toBeDisabled();
    expect(screen.getByTestId('cogitate-tool-freeplay-launch')).not.toBeDisabled();
  });

  it('shows actionable unavailable messages linked via aria-describedby', async () => {
    render(<CogitateScreen onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('cogitate-tool-replay-launch')).toBeDisabled();
    });
    const replayBtn = screen.getByTestId('cogitate-tool-replay-launch');
    const describedBy = replayBtn.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toBeTruthy();
    const msgEl = document.getElementById(describedBy);
    expect(msgEl?.textContent).toMatch(/play some games first/i);

    const trainingBtn = screen.getByTestId('cogitate-tool-training-launch');
    const trainingDesc = trainingBtn.getAttribute('aria-describedby') ?? '';
    const trainingMsg = document.getElementById(trainingDesc);
    expect(trainingMsg?.textContent).toMatch(/analyze a completed game/i);
  });

  it('enables Replay and Analysis when games exist', async () => {
    mockedCount.mockResolvedValue(2);
    mockedTraining.mockResolvedValue(false);
    render(<CogitateScreen onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('cogitate-tool-replay-launch')).not.toBeDisabled();
    });
    expect(screen.getByTestId('cogitate-tool-analysis-launch')).not.toBeDisabled();
    expect(screen.getByTestId('cogitate-tool-training-launch')).toBeDisabled();
    expect(screen.getByTestId('cogitate-tool-replay-launch').textContent).toBe('Launch');
  });

  it('enables Training when analyzed games with training positions exist', async () => {
    mockedCount.mockResolvedValue(3);
    mockedTraining.mockResolvedValue(true);
    render(<CogitateScreen onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('cogitate-tool-training-launch')).not.toBeDisabled();
    });
  });

  it('navigates into Free Play and back to home', async () => {
    render(<CogitateScreen onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('cogitate-tool-freeplay-launch')).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByTestId('cogitate-tool-freeplay-launch'));
    expect(screen.getByTestId('free-play-tool')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('freeplay-back-to-home'));
    await waitFor(() =>
      expect(screen.getByTestId('cogitate-tool-freeplay')).toBeInTheDocument(),
    );
  });

  it('pushes a browser history entry when launching a tool', async () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    render(<CogitateScreen onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('cogitate-tool-freeplay-launch')).not.toBeDisabled(),
    );
    pushSpy.mockClear();
    fireEvent.click(screen.getByTestId('cogitate-tool-freeplay-launch'));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const firstCall = pushSpy.mock.calls[0];
    if (!firstCall) throw new Error('pushState not called');
    const entry = firstCall[0] as { screenKind: string; cogitateView: string };
    expect(entry.screenKind).toBe('cogitate');
    expect(entry.cogitateView).toBe('cogitate-freeplay');
    pushSpy.mockRestore();
  });

  it('returns to home on popstate for cogitate home entry while in a tool', async () => {
    render(<CogitateScreen onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('cogitate-tool-freeplay-launch')).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByTestId('cogitate-tool-freeplay-launch'));
    expect(screen.getByTestId('free-play-tool')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new PopStateEvent('popstate', {
          state: { screenKind: 'cogitate', parentKind: 'menu' },
        }),
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId('cogitate-tool-freeplay')).toBeInTheDocument(),
    );
  });

  it('renders an aria-live announcement region', async () => {
    render(<CogitateScreen onBack={vi.fn()} />);
    const region = await screen.findByTestId('cogitate-announcements');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('re-queries availability when returning to home', async () => {
    render(<CogitateScreen onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('cogitate-tool-freeplay-launch')).not.toBeDisabled(),
    );
    expect(screen.getByTestId('cogitate-tool-replay-launch')).toBeDisabled();

    fireEvent.click(screen.getByTestId('cogitate-tool-freeplay-launch'));
    expect(screen.getByTestId('free-play-tool')).toBeInTheDocument();

    mockedCount.mockResolvedValue(1);
    fireEvent.click(screen.getByTestId('freeplay-back-to-home'));
    await waitFor(() =>
      expect(screen.getByTestId('cogitate-tool-replay-launch')).not.toBeDisabled(),
    );
  });
});
