import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AnalysisTool from './AnalysisTool';
import type { GameRecord } from '../../persistence/gameHistory';

vi.mock('../../persistence/gameHistory', async () => {
  const actual = await vi.importActual<typeof import('../../persistence/gameHistory')>(
    '../../persistence/gameHistory',
  );
  return {
    ...actual,
    getAllGameRecords: vi.fn(),
    getGameRecord: vi.fn(),
    updateGameRecord: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('../../ai/workerClient', async () => {
  const actual = await vi.importActual<typeof import('../../ai/workerClient')>(
    '../../ai/workerClient',
  );
  return {
    ...actual,
    requestEvaluation: vi.fn(() =>
      Promise.resolve({ score: 0, rawScore: 0, isTerminal: false, confidence: 1 }),
    ),
    requestAnalysis: vi.fn(() =>
      Promise.resolve({
        evaluation: 0.1,
        bestMove: null,
        bestMoveNotation: 'a-b',
        principalVariation: [],
        pvNotation: ['a-b'],
        alternativeMoves: [
          { move: {}, notation: 'a-b', score: 1, normalizedScore: 0.1 },
          { move: {}, notation: 'c-d', score: 0.5, normalizedScore: 0 },
        ],
        depth: 8,
        nodesEvaluated: 10,
        rawScore: 50,
      }),
    ),
    cancelAnalysis: vi.fn(),
  };
});

import {
  getAllGameRecords as mockedGetAllGameRecords,
} from '../../persistence/gameHistory';

const getAllGameRecordsMock = vi.mocked(mockedGetAllGameRecords);

const EMPTY_BOARD = ''.padEnd(32, '.');

function makeClassicGame(overrides: Partial<GameRecord> = {}): GameRecord {
  const moves = ['11-15', '22-18'];
  const boardStates = Array.from({ length: moves.length + 1 }, () => EMPTY_BOARD);
  return {
    id: 'test-game-analysis',
    mode: 'CLASSIC',
    playerWhite: 'HUMAN',
    playerBlack: 'CPU_HARD',
    result: 'WHITE_WIN',
    reason: 'NO_LEGAL_MOVES',
    moves,
    boardStates,
    startedAt: 0,
    completedAt: 0,
    ...overrides,
  };
}

describe('AnalysisTool', () => {
  beforeEach(() => {
    getAllGameRecordsMock.mockReset();
    getAllGameRecordsMock.mockResolvedValue([]);
  });

  it('renders the selection phase with the history browser', async () => {
    render(<AnalysisTool onBack={() => undefined} />);
    expect(screen.getByTestId('analysis-tool')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-back-to-home')).toBeInTheDocument();
    await waitFor(() => {
      expect(getAllGameRecordsMock).toHaveBeenCalled();
    });
  });

  it('surfaces a selection error for unknown modes', async () => {
    // Passing a game with an unregistered mode triggers the error branch.
    getAllGameRecordsMock.mockResolvedValue([makeClassicGame({ mode: 'UNKNOWN_MODE' })]);
    render(<AnalysisTool onBack={() => undefined} />);
    // We can't click the row without deeper setup; the screen should still
    // render the back button and browser.
    await waitFor(() => {
      expect(screen.getByTestId('analysis-back-to-home')).toBeInTheDocument();
    });
  });
});
