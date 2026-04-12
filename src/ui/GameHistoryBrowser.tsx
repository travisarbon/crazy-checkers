/**
 * GameHistoryBrowser — selectable list of completed games from IndexedDB.
 *
 * Used by Replay, Analysis, and Training Cogitate tools.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameRecord } from '../persistence/gameHistory';
import { getAllGameRecords } from '../persistence/gameHistory';
import { getMode } from '../persistence/gameModeRegistry';
import styles from './GameHistoryBrowser.module.css';

export interface GameHistoryBrowserProps {
  onSelectGame: (game: GameRecord) => void;
  selectedGameId?: string | null;
  filterMode?: string | null;
  className?: string;
  /** Injection hook for tests — defaults to getAllGameRecords. */
  loadGames?: () => Promise<GameRecord[]>;
}

const INITIAL_PAGE_SIZE = 50;
const PAGE_INCREMENT = 50;

type SortOrder = 'newest' | 'oldest';

function formatRelative(timestamp: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${String(diffMin)} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${String(diffHr)} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${String(diffDay)} days ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

function formatPlayers(record: GameRecord): string {
  return `${record.playerWhite} vs ${record.playerBlack}`;
}

function formatResult(record: GameRecord): string {
  if (record.result === 'WHITE_WIN') return 'White wins';
  if (record.result === 'BLACK_WIN') return 'Black wins';
  if (record.result === 'DRAW') return 'Draw';
  return record.result;
}

export default function GameHistoryBrowser({
  onSelectGame,
  selectedGameId = null,
  filterMode = null,
  className,
  loadGames,
}: GameHistoryBrowserProps) {
  const [games, setGames] = useState([] as GameRecord[]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [activeFilter, setActiveFilter] = useState(filterMode ?? (null as string | null));
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const loader = loadGames ?? getAllGameRecords;
    loader()
      .then((records) => {
        if (cancelled) return;
        setGames(records);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setGames([]);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadGames]);

  useEffect(() => {
    setActiveFilter(filterMode);
  }, [filterMode]);

  const availableModes = useMemo(() => {
    const set = new Set<string>();
    for (const g of games) set.add(g.mode);
    return Array.from(set).sort();
  }, [games]);

  const filtered = useMemo(() => {
    const base = activeFilter ? games.filter((g) => g.mode === activeFilter) : games;
    const sorted = [...base].sort((a, b) =>
      sortOrder === 'newest' ? b.completedAt - a.completedAt : a.completedAt - b.completedAt,
    );
    return sorted;
  }, [games, activeFilter, sortOrder]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((v) => v + PAGE_INCREMENT);
  }, []);

  const visible = filtered.slice(0, visibleCount);

  if (isLoading) {
    return (
      <div
        className={[styles.root, className ?? ''].filter(Boolean).join(' ')}
        data-testid="game-history-browser"
      >
        <div className={styles.loading} data-testid="game-history-loading">
          Loading games...
        </div>
      </div>
    );
  }

  return (
    <div
      className={[styles.root, className ?? ''].filter(Boolean).join(' ')}
      data-testid="game-history-browser"
    >
      <div className={styles.toolbar}>
        <label>
          <span style={{ marginRight: '0.25rem' }}>Mode:</span>
          <select
            className={styles.select}
            value={activeFilter ?? ''}
            onChange={(e) => {
              setActiveFilter(e.target.value === '' ? null : e.target.value);
              setVisibleCount(INITIAL_PAGE_SIZE);
            }}
            data-testid="game-history-filter"
          >
            <option value="">All modes</option>
            {availableModes.map((mode) => (
              <option key={mode} value={mode}>
                {getMode(mode)?.displayName ?? mode}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={{ marginRight: '0.25rem' }}>Sort:</span>
          <select
            className={styles.select}
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as SortOrder);
            }}
            data-testid="game-history-sort"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty} data-testid="game-history-empty">
          No completed games.
        </div>
      ) : (
        <ul
          className={styles.list}
          role="listbox"
          aria-label="Completed games"
          data-testid="game-history-list"
        >
          {visible.map((game) => {
            const selected = selectedGameId === game.id;
            const className = [styles.entry, selected ? styles.entrySelected : '']
              .filter(Boolean)
              .join(' ');
            return (
              <li key={game.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={className}
                  data-testid={`game-history-entry-${game.id}`}
                  onClick={() => {
                    onSelectGame(game);
                  }}
                >
                  <span className={styles.modeBadge}>
                    {getMode(game.mode)?.displayName ?? game.mode}
                  </span>
                  <span className={styles.meta}>
                    <span>{formatPlayers(game)}</span>
                    <span className={styles.metaSecondary}>
                      {formatResult(game)} - {String(game.moves.length)} moves
                    </span>
                  </span>
                  <span className={styles.metaSecondary}>
                    {formatRelative(game.completedAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > visibleCount && (
        <button
          type="button"
          className={styles.loadMore}
          onClick={handleLoadMore}
          data-testid="game-history-load-more"
        >
          Load more ({String(filtered.length - visibleCount)} remaining)
        </button>
      )}
    </div>
  );
}
