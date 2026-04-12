import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GameHistoryBrowser from './GameHistoryBrowser';
import type { GameRecord } from '../persistence/gameHistory';

function makeRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 'game-' + Math.random().toString(36).slice(2),
    mode: 'classic',
    playerWhite: 'HUMAN',
    playerBlack: 'CPU_HARD',
    result: 'WHITE_WIN',
    reason: 'NO_LEGAL_MOVES',
    moves: ['11-15', '22-18'],
    boardStates: ['' .padEnd(32, '.'), '' .padEnd(32, '.')],
    startedAt: Date.now() - 3_600_000,
    completedAt: Date.now() - 1_800_000,
    ...overrides,
  };
}

describe('GameHistoryBrowser', () => {
  it('shows loading state while games are loading', () => {
    render(
      <GameHistoryBrowser
        onSelectGame={() => undefined}
        loadGames={() => new Promise(() => {
          /* never resolves */
        })}
      />,
    );
    expect(screen.getByTestId('game-history-loading')).toBeInTheDocument();
  });

  it('shows an empty state when no games are stored', async () => {
    render(
      <GameHistoryBrowser
        onSelectGame={() => undefined}
        loadGames={() => Promise.resolve([])}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('game-history-empty')).toBeInTheDocument();
    });
  });

  it('renders loaded game records', async () => {
    const game = makeRecord();
    render(
      <GameHistoryBrowser
        onSelectGame={() => undefined}
        loadGames={() => Promise.resolve([game])}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId(`game-history-entry-${game.id}`)).toBeInTheDocument();
    });
  });

  it('fires onSelectGame when an entry is clicked', async () => {
    const game = makeRecord();
    const handler = vi.fn();
    render(
      <GameHistoryBrowser
        onSelectGame={handler}
        loadGames={() => Promise.resolve([game])}
      />,
    );
    const entry = await screen.findByTestId(`game-history-entry-${game.id}`);
    fireEvent.click(entry);
    expect(handler).toHaveBeenCalledWith(game);
  });

  it('filters by mode when the filter dropdown changes', async () => {
    const classicGame = makeRecord({ id: 'classic-1', mode: 'classic' });
    const crazyGame = makeRecord({ id: 'crazy-1', mode: 'crazy' });
    render(
      <GameHistoryBrowser
        onSelectGame={() => undefined}
        loadGames={() => Promise.resolve([classicGame, crazyGame])}
      />,
    );
    await screen.findByTestId(`game-history-entry-${classicGame.id}`);
    const filter = screen.getByTestId('game-history-filter');
    fireEvent.change(filter, { target: { value: 'crazy' } });
    expect(screen.queryByTestId(`game-history-entry-${classicGame.id}`)).toBeNull();
    expect(screen.getByTestId(`game-history-entry-${crazyGame.id}`)).toBeInTheDocument();
  });

  it('toggles sort order between newest and oldest', async () => {
    const older = makeRecord({ id: 'older', completedAt: 1_000 });
    const newer = makeRecord({ id: 'newer', completedAt: 10_000 });
    render(
      <GameHistoryBrowser
        onSelectGame={() => undefined}
        loadGames={() => Promise.resolve([older, newer])}
      />,
    );
    await screen.findByTestId(`game-history-entry-newer`);
    const list = screen.getByTestId('game-history-list');
    // Newest first by default: first child should be 'newer'.
    const firstNewest = list.querySelector('[data-testid^="game-history-entry-"]');
    expect(firstNewest?.getAttribute('data-testid')).toContain('newer');

    const sort = screen.getByTestId('game-history-sort');
    fireEvent.change(sort, { target: { value: 'oldest' } });
    const firstOldest = list.querySelector('[data-testid^="game-history-entry-"]');
    expect(firstOldest?.getAttribute('data-testid')).toContain('older');
  });

  it('highlights the selected game', async () => {
    const game = makeRecord();
    render(
      <GameHistoryBrowser
        onSelectGame={() => undefined}
        loadGames={() => Promise.resolve([game])}
        selectedGameId={game.id}
      />,
    );
    const entry = await screen.findByTestId(`game-history-entry-${game.id}`);
    expect(entry).toHaveAttribute('aria-selected', 'true');
  });
});
