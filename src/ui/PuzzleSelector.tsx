/**
 * PuzzleSelector — 10x10 grid of 100 puzzle cells.
 * Each cell displays its puzzle number and, if solved, its star rating.
 * Cells are coloured by state: solved, available, current, or locked.
 */

import type { PuzzleSummary } from '../persistence/challengeRecords';
import { PUZZLE_DATA } from '../data/puzzleData';
import styles from './PuzzleSelector.module.css';

export interface PuzzleSelectorProps {
  readonly perPuzzle: ReadonlyMap<number, PuzzleSummary>;
  readonly nextPuzzleId: number;
  readonly onSelectPuzzle: (puzzleId: number) => void;
}

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
  const cells: React.ReactNode[] = [];

  for (let id = 1; id <= 100; id++) {
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

    cells.push(
      <button
        key={id}
        className={classList.join(' ')}
        data-testid={'puzzle-cell-' + String(id)}
        aria-label={ariaLabel}
        disabled={isLocked}
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
      <div className={styles.grid}>
        {cells}
      </div>
    </div>
  );
}
