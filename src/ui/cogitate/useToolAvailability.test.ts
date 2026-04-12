import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../persistence/gameHistory', () => ({
  getGameRecordCount: vi.fn(),
  hasAnalyzedGamesWithTrainingPositions: vi.fn(),
}));

import {
  getGameRecordCount,
  hasAnalyzedGamesWithTrainingPositions,
} from '../../persistence/gameHistory';
import { useToolAvailability } from './useToolAvailability';

const mockedCount = vi.mocked(getGameRecordCount);
const mockedTraining = vi.mocked(hasAnalyzedGamesWithTrainingPositions);

describe('useToolAvailability', () => {
  beforeEach(() => {
    mockedCount.mockReset();
    mockedTraining.mockReset();
  });

  it('returns loading state initially', () => {
    mockedCount.mockResolvedValue(0);
    mockedTraining.mockResolvedValue(false);
    const { result } = renderHook(() => useToolAvailability());
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.freePlayAvailable).toBe(true);
    expect(result.current.replayAvailable).toBe(false);
  });

  it('disables Replay/Analysis/Training when no games exist', async () => {
    mockedCount.mockResolvedValue(0);
    mockedTraining.mockResolvedValue(false);
    const { result } = renderHook(() => useToolAvailability());
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
    expect(result.current.replayAvailable).toBe(false);
    expect(result.current.analysisAvailable).toBe(false);
    expect(result.current.trainingAvailable).toBe(false);
    expect(result.current.freePlayAvailable).toBe(true);
  });

  it('enables Replay/Analysis when games exist without training positions', async () => {
    mockedCount.mockResolvedValue(3);
    mockedTraining.mockResolvedValue(false);
    const { result } = renderHook(() => useToolAvailability());
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
    expect(result.current.replayAvailable).toBe(true);
    expect(result.current.analysisAvailable).toBe(true);
    expect(result.current.trainingAvailable).toBe(false);
  });

  it('enables all tools when analyzed games with training positions exist', async () => {
    mockedCount.mockResolvedValue(5);
    mockedTraining.mockResolvedValue(true);
    const { result } = renderHook(() => useToolAvailability());
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
    expect(result.current.replayAvailable).toBe(true);
    expect(result.current.analysisAvailable).toBe(true);
    expect(result.current.trainingAvailable).toBe(true);
    expect(result.current.freePlayAvailable).toBe(true);
  });

  it('re-queries when refreshKey changes', async () => {
    mockedCount.mockResolvedValue(0);
    mockedTraining.mockResolvedValue(false);
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) => useToolAvailability(key),
      { initialProps: { key: 0 } },
    );
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
    expect(result.current.replayAvailable).toBe(false);

    mockedCount.mockResolvedValue(1);
    mockedTraining.mockResolvedValue(true);
    rerender({ key: 1 });
    await waitFor(() => {
      expect(result.current.replayAvailable).toBe(true);
    });
    expect(result.current.trainingAvailable).toBe(true);
  });

  it('falls back to disabled availability on query error', async () => {
    mockedCount.mockRejectedValue(new Error('db error'));
    mockedTraining.mockResolvedValue(false);
    const { result } = renderHook(() => useToolAvailability());
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
    expect(result.current.replayAvailable).toBe(false);
    expect(result.current.freePlayAvailable).toBe(true);
  });
});
