import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PuzzleSelector from './PuzzleSelector';
import type { PuzzleSummary } from '../persistence/challengeRecords';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSummary(
  puzzleId: number,
  solved: boolean,
  bestTimeMs: number | null = null,
  bestRating = 0,
  attemptCount = 1,
): PuzzleSummary {
  return { puzzleId, solved, bestTimeMs, bestRating, attemptCount };
}

function buildPerPuzzle(entries: PuzzleSummary[]): ReadonlyMap<number, PuzzleSummary> {
  const map = new Map<number, PuzzleSummary>();
  for (const e of entries) map.set(e.puzzleId, e);
  return map;
}

function renderSelector(overrides?: Partial<{
  perPuzzle: ReadonlyMap<number, PuzzleSummary>;
  nextPuzzleId: number;
  onSelectPuzzle: (id: number) => void;
}>) {
  const onSelectPuzzle = overrides?.onSelectPuzzle ?? vi.fn();
  return {
    onSelectPuzzle,
    ...render(
      <PuzzleSelector
        perPuzzle={overrides?.perPuzzle ?? new Map()}
        nextPuzzleId={overrides?.nextPuzzleId ?? 1}
        onSelectPuzzle={onSelectPuzzle}
      />,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PuzzleSelector', () => {
  it('renders 100 cells', () => {
    renderSelector();
    for (let id = 1; id <= 100; id++) {
      expect(screen.getByTestId('puzzle-cell-' + String(id))).toBeInTheDocument();
    }
  });

  it('solved cell has solved class and shows stars', () => {
    const perPuzzle = buildPerPuzzle([makeSummary(1, true, 5000, 3)]);
    renderSelector({ perPuzzle, nextPuzzleId: 2 });
    const cell = screen.getByTestId('puzzle-cell-1');
    expect(cell.className).toContain('cell_solved');
    expect(cell.textContent).toContain('\u2605\u2605\u2605');
  });

  it('available cell has available class', () => {
    renderSelector({ nextPuzzleId: 3 });
    // Puzzle 2 should be available (id <= nextPuzzleId and not solved)
    const cell = screen.getByTestId('puzzle-cell-2');
    expect(cell.className).toContain('cell_available');
  });

  it('locked cell is disabled', () => {
    renderSelector({ nextPuzzleId: 1 });
    // Puzzle 2 is locked (id > nextPuzzleId)
    const cell = screen.getByTestId('puzzle-cell-2');
    expect(cell).toBeDisabled();
    expect(cell.className).toContain('cell_locked');
  });

  it('current cell has current class', () => {
    renderSelector({ nextPuzzleId: 5 });
    const cell = screen.getByTestId('puzzle-cell-5');
    expect(cell.className).toContain('cell_current');
  });

  it('clicking solved cell calls onSelectPuzzle', () => {
    const onSelectPuzzle = vi.fn();
    const perPuzzle = buildPerPuzzle([makeSummary(1, true, 5000, 2)]);
    renderSelector({ perPuzzle, nextPuzzleId: 2, onSelectPuzzle });
    fireEvent.click(screen.getByTestId('puzzle-cell-1'));
    expect(onSelectPuzzle).toHaveBeenCalledWith(1);
  });

  it('clicking available cell calls onSelectPuzzle', () => {
    const onSelectPuzzle = vi.fn();
    renderSelector({ nextPuzzleId: 3, onSelectPuzzle });
    fireEvent.click(screen.getByTestId('puzzle-cell-2'));
    expect(onSelectPuzzle).toHaveBeenCalledWith(2);
  });

  it('clicking locked cell does NOT call onSelectPuzzle', () => {
    const onSelectPuzzle = vi.fn();
    renderSelector({ nextPuzzleId: 1, onSelectPuzzle });
    fireEvent.click(screen.getByTestId('puzzle-cell-5'));
    expect(onSelectPuzzle).not.toHaveBeenCalled();
  });

  it('star ratings shown on solved cells', () => {
    const perPuzzle = buildPerPuzzle([
      makeSummary(1, true, 3000, 1),
      makeSummary(2, true, 2000, 2),
      makeSummary(3, true, 1000, 3),
    ]);
    renderSelector({ perPuzzle, nextPuzzleId: 4 });

    expect(screen.getByTestId('puzzle-cell-1').textContent).toContain('\u2605');
    expect(screen.getByTestId('puzzle-cell-2').textContent).toContain('\u2605\u2605');
    expect(screen.getByTestId('puzzle-cell-3').textContent).toContain('\u2605\u2605\u2605');
  });

  it('aria labels are correct for solved puzzle', () => {
    const perPuzzle = buildPerPuzzle([makeSummary(1, true, 12500, 3)]);
    renderSelector({ perPuzzle, nextPuzzleId: 2 });
    const cell = screen.getByTestId('puzzle-cell-1');
    expect(cell.getAttribute('aria-label')).toBe(
      'Puzzle 1 \u2014 solved, 3 stars, 0:12.5',
    );
  });

  it('aria labels are correct for locked puzzle', () => {
    renderSelector({ nextPuzzleId: 1 });
    const cell = screen.getByTestId('puzzle-cell-50');
    expect(cell.getAttribute('aria-label')).toBe('Puzzle 50 \u2014 locked');
  });

  it('aria labels are correct for current puzzle', () => {
    renderSelector({ nextPuzzleId: 5 });
    const cell = screen.getByTestId('puzzle-cell-5');
    expect(cell.getAttribute('aria-label')).toBe('Puzzle 5 \u2014 current');
  });

  it('all-complete state: all solved, nextPuzzleId=101', () => {
    const entries: PuzzleSummary[] = [];
    for (let id = 1; id <= 100; id++) {
      entries.push(makeSummary(id, true, 5000, 3));
    }
    const perPuzzle = buildPerPuzzle(entries);
    renderSelector({ perPuzzle, nextPuzzleId: 101 });

    // All cells should be solved
    for (let id = 1; id <= 100; id++) {
      expect(screen.getByTestId('puzzle-cell-' + String(id)).className).toContain('cell_solved');
    }
    // None should be locked
    for (let id = 1; id <= 100; id++) {
      expect(screen.getByTestId('puzzle-cell-' + String(id))).not.toBeDisabled();
    }
  });

  it('puzzle-selector data-testid is present', () => {
    renderSelector();
    expect(screen.getByTestId('puzzle-selector')).toBeInTheDocument();
  });
});
