/**
 * Completion dialog shown when a Challenge puzzle is solved.
 *
 * Displays star rating with animation, solve time, previous best
 * comparison, and action buttons (Next Puzzle, Retry, Back).
 *
 * Accessibility: role="dialog", aria-modal, focus trap, Escape to close.
 */

import { useEffect, useRef } from 'react';
import type { PuzzleDefinition } from '../data/puzzleData';
import { formatPreciseTime } from './challengeGameUtils';
import styles from './PuzzleCompletionDialog.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PuzzleCompletionDialogProps {
  readonly puzzle: PuzzleDefinition;
  readonly solveTimeMs: number;
  readonly rating: number;
  readonly previousBestTimeMs?: number | null;
  readonly isRetry?: boolean;
  readonly onNextPuzzle: () => void;
  readonly onRetry: () => void;
  readonly onBack: () => void;
}

// ---------------------------------------------------------------------------
// Star display
// ---------------------------------------------------------------------------

function StarRating({ rating }: { readonly rating: number }) {
  return (
    <div
      className={styles.stars}
      role="img"
      aria-label={String(rating) + ' out of 3 stars'}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={[styles.star, i <= rating ? styles.starFilled : styles.starEmpty].join(' ')}
          style={{ animationDelay: String((i - 1) * 150) + 'ms' }}
          aria-hidden="true"
        >
          {i <= rating ? '\u2605' : '\u2606'}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time comparison
// ---------------------------------------------------------------------------

function TimeDisplay({
  solveTimeMs,
  previousBestTimeMs,
  isRetry,
}: {
  readonly solveTimeMs: number;
  readonly previousBestTimeMs?: number | null;
  readonly isRetry?: boolean;
}) {
  const isNewBest = isRetry && previousBestTimeMs != null && solveTimeMs < previousBestTimeMs;

  if (isNewBest) {
    return (
      <p className={styles.time}>
        <span className={styles.newBest}>New best!</span>{' '}
        {formatPreciseTime(solveTimeMs)}{' '}
        <span className={styles.previousTime}>
          (was {formatPreciseTime(previousBestTimeMs)})
        </span>
      </p>
    );
  }

  if (isRetry && previousBestTimeMs != null) {
    return (
      <p className={styles.time}>
        Time: {formatPreciseTime(solveTimeMs)}{' '}
        <span className={styles.previousTime}>
          (Previous best: {formatPreciseTime(previousBestTimeMs)})
        </span>
      </p>
    );
  }

  return (
    <p className={styles.time}>
      Time: {formatPreciseTime(solveTimeMs)}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PuzzleCompletionDialog({
  puzzle,
  solveTimeMs,
  rating,
  previousBestTimeMs,
  isRetry,
  onNextPuzzle,
  onRetry,
  onBack,
}: PuzzleCompletionDialogProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Auto-focus the primary button after star animation
  useEffect(() => {
    const timer = setTimeout(() => {
      primaryRef.current?.focus();
    }, 600);
    return () => { clearTimeout(timer); };
  }, []);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Focus trap
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onBack();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (!focusable || focusable.length === 0) return;

    if (focusable.length === 1) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const isLastPuzzle = puzzle.id >= 100;

  return (
    <>
      <div className={styles.backdrop} aria-hidden="true" />
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="puzzle-complete-heading"
        onKeyDown={handleKeyDown}
        data-testid="puzzle-completion-dialog"
      >
        <StarRating rating={rating} />

        <h2 id="puzzle-complete-heading" className={styles.heading}>
          {isLastPuzzle ? 'All Puzzles Complete!' : 'Puzzle Complete!'}
        </h2>

        <p className={styles.puzzleInfo}>
          Puzzle {String(puzzle.id)} / 100 &mdash; {puzzle.difficultyTier}
        </p>

        <TimeDisplay
          solveTimeMs={solveTimeMs}
          previousBestTimeMs={previousBestTimeMs}
          isRetry={isRetry}
        />

        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            onClick={onBack}
            data-testid="puzzle-complete-back"
          >
            Back to Challenges
          </button>
          <button
            className={styles.secondaryButton}
            onClick={onRetry}
            data-testid="puzzle-complete-retry"
          >
            Retry
          </button>
          {!isLastPuzzle ? (
            <button
              ref={primaryRef}
              className={styles.primaryButton}
              onClick={onNextPuzzle}
              data-testid="puzzle-complete-next"
            >
              Next Puzzle
            </button>
          ) : (
            <button
              ref={primaryRef}
              className={styles.primaryButton}
              onClick={onBack}
              data-testid="puzzle-complete-finish"
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </>
  );
}
