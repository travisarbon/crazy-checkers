import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ReplayTool from './ReplayTool';
import type { GameRecord } from '../../persistence/gameHistory';
import { CrazyEvent, PieceColor } from '../../engine/types';

// Mock IndexedDB-backed game history loaders so tests don't hit idb.
vi.mock('../../persistence/gameHistory', async () => {
  const actual = await vi.importActual<typeof import('../../persistence/gameHistory')>(
    '../../persistence/gameHistory',
  );
  return {
    ...actual,
    getAllGameRecords: vi.fn(),
    getGameRecord: vi.fn(),
  };
});

// Mock worker evaluation so we don't spin up a real Web Worker.
vi.mock('../../ai/workerClient', async () => {
  const actual = await vi.importActual<typeof import('../../ai/workerClient')>(
    '../../ai/workerClient',
  );
  return {
    ...actual,
    requestEvaluation: vi.fn(() =>
      Promise.resolve({ score: 0.1, rawScore: 25, isTerminal: false, confidence: 1 }),
    ),
  };
});

import {
  getAllGameRecords as mockedGetAllGameRecords,
  getGameRecord as mockedGetGameRecord,
} from '../../persistence/gameHistory';

const getAllGameRecordsMock = vi.mocked(mockedGetAllGameRecords);
const getGameRecordMock = vi.mocked(mockedGetGameRecord);

// ---------------------------------------------------------------------------

const EMPTY_BOARD = ''.padEnd(32, '.');

function makeClassicGame(overrides: Partial<GameRecord> = {}): GameRecord {
  const moves = ['11-15', '22-18', '8-11', '18-14'];
  const boardStates = Array.from({ length: moves.length + 1 }, () => EMPTY_BOARD);
  return {
    id: 'test-game-1',
    mode: 'CLASSIC',
    playerWhite: 'HUMAN',
    playerBlack: 'CPU_HARD',
    result: 'WHITE_WIN',
    reason: 'NO_LEGAL_MOVES',
    moves,
    boardStates,
    startedAt: Date.now() - 3600_000,
    completedAt: Date.now() - 1800_000,
    ...overrides,
  };
}

function makeCrazyGame(): GameRecord {
  const moves = ['11-15', '22-18'];
  const boardStates = Array.from({ length: moves.length + 1 }, () => EMPTY_BOARD);
  return {
    id: 'test-crazy-1',
    mode: 'CRAZY',
    playerWhite: 'HUMAN',
    playerBlack: 'HUMAN',
    result: 'DRAW',
    reason: 'THREEFOLD',
    moves,
    boardStates,
    startedAt: Date.now() - 1000,
    completedAt: Date.now(),
    activeEventsPerPly: [
      [],
      [
        {
          type: CrazyEvent.KingForADay,
          remainingPlies: 4,
          triggeredBy: PieceColor.White,
          triggeredAtPly: 1,
        },
      ],
      [],
    ],
  };
}

// ---------------------------------------------------------------------------

describe('ReplayTool — selection phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the GameHistoryBrowser on the select phase', async () => {
    getAllGameRecordsMock.mockResolvedValue([]);
    render(<ReplayTool onBack={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByTestId('game-history-browser')).toBeInTheDocument();
    });
    expect(screen.getByText('Select a game to replay')).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', () => {
    getAllGameRecordsMock.mockResolvedValue([]);
    const onBack = vi.fn();
    render(<ReplayTool onBack={onBack} />);
    fireEvent.click(screen.getByTestId('replay-back-to-home'));
    expect(onBack).toHaveBeenCalled();
  });

  it('transitions to replay view on selecting a classic game', async () => {
    const game = makeClassicGame();
    getAllGameRecordsMock.mockResolvedValue([game]);
    render(<ReplayTool onBack={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByTestId(`game-history-entry-${game.id}`)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`game-history-entry-${game.id}`));
    await waitFor(() => {
      expect(screen.getByTestId('replay-tool').getAttribute('data-phase')).toBe('replay');
    });
  });

  it('shows an error when selecting a game with no adapter', async () => {
    const game = makeClassicGame({ id: 'unknown-mode-game', mode: 'does-not-exist' });
    getAllGameRecordsMock.mockResolvedValue([game]);
    render(<ReplayTool onBack={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByTestId(`game-history-entry-${game.id}`)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`game-history-entry-${game.id}`));
    expect(screen.getByTestId('replay-selection-error')).toBeInTheDocument();
  });

  it('auto-loads a game given initialGameId', async () => {
    const game = makeClassicGame({ id: 'auto-load-game' });
    getAllGameRecordsMock.mockResolvedValue([]);
    getGameRecordMock.mockResolvedValue(game);
    render(<ReplayTool onBack={() => undefined} initialGameId="auto-load-game" />);
    await waitFor(() => {
      expect(screen.getByTestId('replay-tool').getAttribute('data-phase')).toBe('replay');
    });
  });
});

describe('ReplayTool — replay view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderReplayFor(game: GameRecord) {
    getAllGameRecordsMock.mockResolvedValue([game]);
    render(<ReplayTool onBack={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByTestId(`game-history-entry-${game.id}`)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`game-history-entry-${game.id}`));
    await waitFor(() => {
      expect(screen.getByTestId('replay-tool').getAttribute('data-phase')).toBe('replay');
    });
  }

  it('renders core replay sub-components', async () => {
    const game = makeClassicGame();
    await renderReplayFor(game);
    expect(screen.getByTestId('cogitate-board')).toBeInTheDocument();
    expect(screen.getAllByTestId('evaluation-bar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('move-timeline').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('replay-transport-bar')).toBeInTheDocument();
    expect(screen.getByTestId('replay-game-metadata')).toBeInTheDocument();
  });

  it('forward button advances ply and back/first/last update accordingly', async () => {
    const game = makeClassicGame();
    await renderReplayFor(game);
    const forward = screen.getByTestId('replay-forward');
    const back = screen.getByTestId('replay-back');
    const first = screen.getByTestId('replay-first');
    const last = screen.getByTestId('replay-last');

    expect(back).toBeDisabled();
    expect(first).toBeDisabled();

    fireEvent.click(forward);
    expect(back).not.toBeDisabled();
    expect(first).not.toBeDisabled();

    fireEvent.click(last);
    expect(forward).toBeDisabled();
    expect(last).toBeDisabled();

    fireEvent.click(first);
    expect(first).toBeDisabled();
  });

  it('clicking a move in the timeline jumps to that ply', async () => {
    const game = makeClassicGame();
    await renderReplayFor(game);
    const cells = screen.getAllByTestId('move-timeline-cell-2');
    fireEvent.click(cells[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByTestId('replay-back')).not.toBeDisabled();
    });
  });

  it('renders no event indicator for classic games', async () => {
    const game = makeClassicGame();
    await renderReplayFor(game);
    expect(screen.queryByTestId('cogitate-active-events')).toBeNull();
  });

  it('renders event indicator for Crazy mode games at matching plies', async () => {
    const game = makeCrazyGame();
    await renderReplayFor(game);
    fireEvent.click(screen.getByTestId('replay-forward'));
    await waitFor(() => {
      expect(screen.getByTestId('cogitate-active-events')).toBeInTheDocument();
    });
  });

  it('arrow keys navigate plies', async () => {
    const game = makeClassicGame();
    await renderReplayFor(game);
    const root = screen.getByTestId('replay-tool');
    act(() => {
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('replay-back')).not.toBeDisabled();
    });
    act(() => {
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('replay-back')).toBeDisabled();
    });
  });

  it('transport bar has toolbar role and aria-label', async () => {
    const game = makeClassicGame();
    await renderReplayFor(game);
    const toolbar = screen.getByTestId('replay-transport-bar');
    expect(toolbar.getAttribute('role')).toBe('toolbar');
    expect(toolbar.getAttribute('aria-label')).toBe('Replay controls');
  });
});
