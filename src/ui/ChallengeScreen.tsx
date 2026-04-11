/**
 * Challenge mode sub-menu screen.
 * Displays progress dashboard, board preview, puzzle selector,
 * performance history, and detailed about/rules information.
 */

import { useState, useEffect } from 'react';
import ModeScreenShell from './ModeScreenShell';
import BoardPreviewLarge from './BoardPreviewLarge';
import ExpandableDetailPanel from './ExpandableDetailPanel';
import PuzzleSelector from './PuzzleSelector';
import { getAllChallengeRecords, computeChallengeProgress } from '../persistence/challengeRecords';
import type { ChallengeProgressSnapshot, PuzzleSummary } from '../persistence/challengeRecords';
import { PUZZLE_DATA } from '../data/puzzleData';
import { deserializeBoardState } from '../persistence/serialization';
import styles from './ChallengeScreen.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChallengeScreenProps {
  onBack: () => void;
  onStartPuzzle?: (puzzleId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format milliseconds as M:SS.T (tenths). */
function formatTimeShort(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds * 10) % 10);
  return String(minutes) + ':' + String(seconds).padStart(2, '0') + '.' + String(tenths);
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className={styles.statCard} data-testid={testId}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}

function ProgressGrid({
  perPuzzle,
  nextPuzzleId,
}: {
  perPuzzle: ReadonlyMap<number, PuzzleSummary>;
  nextPuzzleId: number;
}) {
  const cells: React.ReactNode[] = [];
  for (let id = 1; id <= 100; id++) {
    const summary = perPuzzle.get(id);
    const solved = summary?.solved === true;
    const isCurrent = id === nextPuzzleId && !solved;
    const isAvailable = id <= nextPuzzleId && !solved;

    let stateClass: string = styles.progressCell_locked ?? '';
    if (solved) stateClass = styles.progressCell_solved ?? '';
    else if (isCurrent) stateClass = styles.progressCell_current ?? '';
    else if (isAvailable) stateClass = styles.progressCell_available ?? '';

    cells.push(
      <div
        key={id}
        className={(styles.progressCell ?? '') + ' ' + stateClass}
        data-testid={'progress-cell-' + String(id)}
      />,
    );
  }

  return (
    <div className={styles.progressGrid}>
      {cells}
    </div>
  );
}

function PerformanceHistoryTable({
  perPuzzle,
}: {
  perPuzzle: ReadonlyMap<number, PuzzleSummary>;
}) {
  // Collect all puzzles that have been attempted (have any records)
  const attempted: PuzzleSummary[] = [];
  for (let id = 1; id <= 100; id++) {
    const summary = perPuzzle.get(id);
    if (summary && summary.attemptCount > 0) {
      attempted.push(summary);
    }
  }

  if (attempted.length === 0) {
    return (
      <p className={styles.emptyHistory} data-testid="empty-history">
        No puzzles attempted yet. Start your first puzzle to see your performance history.
      </p>
    );
  }

  return (
    <div className={styles.historyTableWrapper}>
      <table className={styles.historyTable} data-testid="history-table">
        <thead>
          <tr>
            <th>Puzzle</th>
            <th>Status</th>
            <th>Best Time</th>
            <th>Rating</th>
            <th>Attempts</th>
          </tr>
        </thead>
        <tbody>
          {attempted.map((summary) => (
            <tr
              key={summary.puzzleId}
              className={summary.solved ? styles.historyRow_solved : styles.historyRow_unsolved}
            >
              <td>{'#' + String(summary.puzzleId)}</td>
              <td>{summary.solved ? 'Solved' : 'Unsolved'}</td>
              <td>{summary.bestTimeMs !== null ? formatTimeShort(summary.bestTimeMs) : '\u2014'}</td>
              <td>{summary.solved ? '\u2605'.repeat(summary.bestRating) : '\u2014'}</td>
              <td>{String(summary.attemptCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChallengeScreen({ onBack, onStartPuzzle }: ChallengeScreenProps) {
  const [progress, setProgress] = useState<ChallengeProgressSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPuzzleSelector, setShowPuzzleSelector] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const records = await getAllChallengeRecords();
      if (!cancelled) {
        setProgress(computeChallengeProgress(records));
        setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Derived values
  const nextPuzzleId = progress?.nextPuzzleId ?? 1;
  const allComplete = nextPuzzleId > 100;
  const puzzlesCompleted = progress?.puzzlesCompleted ?? 0;
  const averageRating = progress?.averageRating ?? 0;
  const bestTimeMs = progress?.bestTimeMs ?? null;
  const currentStreak = progress?.currentStreak ?? 0;
  const perPuzzle = progress?.perPuzzle ?? new Map<number, PuzzleSummary>();

  // Board preview: show the next puzzle position, or puzzle 100 if all complete
  const previewPuzzleId = allComplete ? 100 : nextPuzzleId;
  const previewPuzzle = PUZZLE_DATA[previewPuzzleId - 1];
  const previewBoard = previewPuzzle
    ? deserializeBoardState(previewPuzzle.boardState)
    : undefined;

  function handleSelectPuzzle(puzzleId: number) {
    onStartPuzzle?.(puzzleId);
  }

  if (isLoading) {
    return (
      <ModeScreenShell title="Challenge" onBack={onBack} testId="challenge-screen">
        <p className={styles.loading} data-testid="challenge-loading">Loading challenge data...</p>
      </ModeScreenShell>
    );
  }

  return (
    <ModeScreenShell title="Challenge" onBack={onBack} testId="challenge-screen">
      {/* Section 1: Mode Overview */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Mode Overview</h2>
        <div className={styles.boardPreviewWrapper}>
          <BoardPreviewLarge
            position={previewBoard}
            size={220}
            label={
              allComplete
                ? 'Puzzle 100 board position'
                : 'Puzzle ' + String(previewPuzzleId) + ' board position'
            }
          />
          <p className={styles.boardCaption}>
            {allComplete
              ? 'All puzzles complete!'
              : 'Puzzle ' + String(previewPuzzleId) + ' \u2014 ' + (previewPuzzle?.difficultyTier ?? 'unknown')}
          </p>
        </div>
      </div>

      {/* Section 2: How to Play */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>How to Play</h2>
        <p className={styles.howToPlay}>
          Challenge mode presents 100 hand-crafted checkers puzzles. Each puzzle
          has a specific board position and an optimal solution to find. Solve
          puzzles sequentially to unlock the next one. You are rated 1-3 stars
          based on how quickly you find the solution. Try to earn 3 stars on
          every puzzle!
        </p>
      </div>

      {/* Section 3: Progress Dashboard */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Progress</h2>
        <div className={styles.statsGrid}>
          <StatCard
            label="Completed"
            value={String(puzzlesCompleted) + ' / 100'}
            testId="stat-completed"
          />
          <StatCard
            label="Avg Rating"
            value={puzzlesCompleted > 0 ? averageRating.toFixed(1) + ' \u2605' : '\u2014'}
            testId="stat-avg-rating"
          />
          <StatCard
            label="Best Time"
            value={bestTimeMs !== null ? formatTimeShort(bestTimeMs) : '\u2014'}
            testId="stat-best-time"
          />
          <StatCard
            label="Streak"
            value={String(currentStreak)}
            testId="stat-streak"
          />
        </div>
        <ProgressGrid perPuzzle={perPuzzle} nextPuzzleId={nextPuzzleId} />
      </div>

      {/* Section 4: Puzzle Selection */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Puzzle Selection</h2>
        <div className={styles.actionRow}>
          {allComplete ? (
            <span className={styles.completeMessage} data-testid="challenge-all-complete">
              All 100 puzzles complete! Replay any puzzle below.
            </span>
          ) : (
            onStartPuzzle && (
              <button
                className={styles.continueButton}
                onClick={() => { onStartPuzzle(nextPuzzleId); }}
                data-testid="challenge-continue"
              >
                {'Continue \u2014 Puzzle ' + String(nextPuzzleId)}
              </button>
            )
          )}
          <button
            className={styles.selectButton}
            onClick={() => { setShowPuzzleSelector((prev) => !prev); }}
            data-testid="puzzle-selector-toggle"
          >
            {showPuzzleSelector ? 'Hide Puzzles' : 'Select Puzzle'}
          </button>
        </div>
        {showPuzzleSelector && (
          <PuzzleSelector
            perPuzzle={perPuzzle}
            nextPuzzleId={nextPuzzleId}
            onSelectPuzzle={handleSelectPuzzle}
          />
        )}
      </div>

      {/* Section 5: Performance History */}
      <ExpandableDetailPanel
        title="Performance History"
        summary="View your puzzle attempts, times, and ratings"
      >
        <PerformanceHistoryTable perPuzzle={perPuzzle} />
      </ExpandableDetailPanel>

      {/* Section 6: About Challenge Mode */}
      <ExpandableDetailPanel
        title="About Challenge Mode"
        summary="Learn more about how puzzles are structured and scored"
      >
        <h3 className={styles.subsectionTitle}>Puzzle Structure</h3>
        <p className={styles.contentParagraph}>
          Each puzzle presents a specific board position extracted from real
          checkers games. Your goal is to find the optimal move or sequence of
          moves. Puzzles are ordered by difficulty, starting with simple
          one-move captures and progressing to complex multi-jump combinations.
        </p>

        <h3 className={styles.subsectionTitle}>Star Rating</h3>
        <p className={styles.contentParagraph}>
          You earn 1 to 3 stars based on how quickly you solve each puzzle.
          Each puzzle has unique time thresholds calibrated to its difficulty.
          Solving quickly earns 3 stars, moderate time earns 2, and any solve
          earns at least 1 star. Your best rating for each puzzle is saved.
        </p>

        <h3 className={styles.subsectionTitle}>Streak Tracking</h3>
        <p className={styles.contentParagraph}>
          Your streak counts consecutive puzzles solved on the first attempt,
          starting from Puzzle 1. A first-attempt failure resets the streak
          counter. Challenge yourself to maintain the longest streak possible.
        </p>
      </ExpandableDetailPanel>
    </ModeScreenShell>
  );
}
