/**
 * PuzzleSelector — 10x10 grid of 100 puzzle cells.
 * Each cell displays its puzzle number and, if solved, its star rating.
 * Cells are coloured by state: solved, available, current, or locked.
 *
 * Accessibility: implements the WAI-ARIA Grid keyboard pattern. Arrow keys
 * move focus between cells, Home/End jump to row start/end, Ctrl+Home/End
 * jump to grid start/end. Only the active cell has tabIndex={0} (roving
 * tabindex); the others have tabIndex={-1}.
 */

import { useCallback, useRef, useState } from 'react';
import type { PuzzleSummary } from '../persistence/challengeRecords';
import { PUZZLE_DATA } from '../data/puzzleData';
import styles from './PuzzleSelector.module.css';

export interface PuzzleSelectorProps {
  readonly perPuzzle: ReadonlyMap<number, PuzzleSummary>;
  readonly nextPuzzleId: number;
  readonly onSelectPuzzle: (puzzleId: number) => void;
}

const GRID_COLS = 10;
const GRID_ROWS = 10;
const GRID_SIZE = GRID_COLS * GRID_ROWS;

/** Format milliseconds as M:SS.T (tenths). */
function formatTimeShort(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds * 10) % 10);
  return String(minutes) + ':' + String(seconds).padStart(2, '0') + '.' + String(tenths);
}

function buildAriaLabel(
  id: number,
  solved: boolean,
  bestRating: number,
  bestTimeMs: number | null,
  isAvailable: boolean,
  isCurrent: boolean,
): string {
  if (solved) {
    const time = bestTimeMs !== null ? ', ' + formatTimeShort(bestTimeMs) : '';
    return 'Puzzle ' + String(id) + ' \u2014 solved, ' + String(bestRating) + ' stars' + time;
  }
  if (isCurrent) {
    return 'Puzzle ' + String(id) + ' \u2014 current';
  }
  if (isAvailable) {
    return 'Puzzle ' + String(id) + ' \u2014 available';
  }
  return 'Puzzle ' + String(id) + ' \u2014 locked';
}

export default function PuzzleSelector({
  perPuzzle,
  nextPuzzleId,
  onSelectPuzzle,
}: PuzzleSelectorProps) {
  // Roving tabindex state (0-based index, 0..99). Defaults to the next puzzle
  // clamped to the grid so keyboard focus lands on a useful cell first.
  const initialActive = Math.max(0, Math.min(GRID_SIZE - 1, nextPuzzleId - 1));
  const [activeIndex, setActiveIndex] = useState(initialActive);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusIndex = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(GRID_SIZE - 1, idx));
    setActiveIndex(clamped);
    // Focus after state update.
    const target = cellRefs.current[clamped];
    if (target) {
      target.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      let nextIdx: number;
      switch (e.key) {
        case 'ArrowRight':
          nextIdx = idx + 1 < GRID_SIZE ? idx + 1 : idx;
          break;
        case 'ArrowLeft':
          nextIdx = idx - 1 >= 0 ? idx - 1 : idx;
          break;
        case 'ArrowDown':
          nextIdx = idx + GRID_COLS < GRID_SIZE ? idx + GRID_COLS : idx;
          break;
        case 'ArrowUp':
          nextIdx = idx - GRID_COLS >= 0 ? idx - GRID_COLS : idx;
          break;
        case 'Home':
          nextIdx = e.ctrlKey ? 0 : Math.floor(idx / GRID_COLS) * GRID_COLS;
          break;
        case 'End':
          if (e.ctrlKey) {
            nextIdx = GRID_SIZE - 1;
          } else {
            const rowStart = Math.floor(idx / GRID_COLS) * GRID_COLS;
            nextIdx = Math.min(GRID_SIZE - 1, rowStart + GRID_COLS - 1);
          }
          break;
        default:
          return;
      }
      if (nextIdx !== idx) {
        e.preventDefault();
        focusIndex(nextIdx);
      }
    },
    [focusIndex],
  );

  const cells: React.ReactNode[] = [];

  for (let id = 1; id <= GRID_SIZE; id++) {
    const summary = perPuzzle.get(id);
    const solved = summary?.solved === true;
    const isCurrent = id === nextPuzzleId && !solved;
    const isAvailable = id <= nextPuzzleId && !solved;
    const isLocked = !solved && !isAvailable;

    // Difficulty tier from static puzzle data
    const puzzleDef = PUZZLE_DATA[id - 1];
    const tier = puzzleDef?.difficultyTier ?? 'easy';

    const classList = [styles.cell];
    if (solved) classList.push(styles.cell_solved);
    else if (isCurrent) classList.push(styles.cell_current, styles.cell_available);
    else if (isAvailable) classList.push(styles.cell_available);
    else classList.push(styles.cell_locked);

    // Add difficulty tier indicator (visible when not solved)
    if (!solved) {
      const tierClass: Record<string, string | undefined> = {
        easy: styles.tier_easy,
        medium: styles.tier_medium,
        hard: styles.tier_hard,
      };
      const cls = tierClass[tier];
      if (cls) classList.push(cls);
    }

    const ariaLabel = buildAriaLabel(
      id,
      solved,
      summary?.bestRating ?? 0,
      summary?.bestTimeMs ?? null,
      isAvailable,
      isCurrent,
    );

    const idx = id - 1;
    const isActive = idx === activeIndex;

    cells.push(
      <button
        key={id}
        role="gridcell"
        ref={(node) => { cellRefs.current[idx] = node; }}
        className={classList.join(' ')}
        data-testid={'puzzle-cell-' + String(id)}
        aria-label={ariaLabel}
        disabled={isLocked}
        tabIndex={isActive ? 0 : -1}
        onKeyDown={(e) => { handleKeyDown(e, idx); }}
        onFocus={() => { setActiveIndex(idx); }}
        onClick={() => { onSelectPuzzle(id); }}
      >
        <span className={styles.cellNumber}>{id}</span>
        {solved && summary.bestRating > 0 && (
          <span className={styles.cellStars}>
            {'\u2605'.repeat(summary.bestRating)}
          </span>
        )}
      </button>,
    );
  }

  return (
    <div className={styles.puzzleSelector} data-testid="puzzle-selector">
      <div
        className={styles.grid}
        role="grid"
        aria-label="Puzzle selector"
        aria-rowcount={GRID_ROWS}
        aria-colcount={GRID_COLS}
      >
        {cells}
      </div>
    </div>
  );
}
