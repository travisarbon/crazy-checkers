/**
 * Game-over modal dialog showing result and offering New Game / Review actions.
 *
 * Displays the result (win/loss/draw), the reason the game ended,
 * and offers "New Game" and "Review" (disabled placeholder) actions.
 *
 * Accessibility: role="dialog", aria-modal, focus trap, scroll lock.
 */

import { useEffect, useRef } from 'react';
import type { GameResult, PieceColor } from '../../engine/types';
import { GameResultType, GameEndReason, PieceColor as PC } from '../../engine/types';
import styles from './GameOverDialog.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GameOverDialogProps {
  result: GameResult;
  lastActiveColor: PieceColor;
  onNewGame: () => void;
  onReview?: () => void;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function getResultHeading(result: GameResult): string {
  switch (result.type) {
    case GameResultType.WhiteWin:
      return 'White Wins!';
    case GameResultType.BlackWin:
      return 'Black Wins!';
    case GameResultType.Draw:
      return 'Draw!';
  }
}

function getReasonDescription(result: GameResult): string {
  switch (result.reason) {
    case GameEndReason.NoPiecesLeft:
      return 'All opponent pieces have been captured.';
    case GameEndReason.NoLegalMoves:
      return 'The opponent has no legal moves remaining.';
    case GameEndReason.Repetition:
      return 'The same position occurred three times — threefold repetition.';
    case GameEndReason.FortyMoveRule:
      return 'Forty consecutive moves without a capture or pawn advance.';
    case GameEndReason.Resignation:
      return 'The opponent resigned the game.';
  }
}

function getWinnerColor(result: GameResult): PieceColor | null {
  switch (result.type) {
    case GameResultType.WhiteWin:
      return PC.White;
    case GameResultType.BlackWin:
      return PC.Black;
    case GameResultType.Draw:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Icon sub-components
// ---------------------------------------------------------------------------

function WinnerIcon({ color }: { color: PieceColor }) {
  const isWhite = color === PC.White;
  const fill = isWhite ? 'var(--piece-white)' : 'var(--piece-black)';
  const stroke = isWhite ? 'var(--piece-white-stroke)' : 'var(--piece-black-stroke)';

  return (
    <svg width={56} height={56} aria-hidden="true" data-testid="winner-icon">
      <circle cx={28} cy={28} r={24} fill={fill} stroke={stroke} strokeWidth={3} />
      <path
        d="M 16,32 L 20,22 L 24,28 L 28,22 L 32,28 L 36,22 L 40,32 Z"
        fill="var(--ui-accent)"
      />
    </svg>
  );
}

function DrawIcon() {
  return (
    <svg width={56} height={56} aria-hidden="true" data-testid="draw-icon">
      <path
        d="M 28,4 A 24,24 0 0,0 28,52 Z"
        fill="var(--piece-white)"
        stroke="var(--piece-white-stroke)"
        strokeWidth={2}
      />
      <path
        d="M 28,4 A 24,24 0 0,1 28,52 Z"
        fill="var(--piece-black)"
        stroke="var(--piece-black-stroke)"
        strokeWidth={2}
      />
      <circle cx={28} cy={28} r={24} fill="none" stroke="var(--ui-accent)" strokeWidth={2} />
    </svg>
  );
}

function ResultIcon({ result }: { result: GameResult }) {
  const winnerColor = getWinnerColor(result);
  if (winnerColor !== null) {
    return <WinnerIcon color={winnerColor} />;
  }
  return <DrawIcon />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GameOverDialog({
  result,
  onNewGame,
}: GameOverDialogProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the "New Game" button after the slide-up animation
  useEffect(() => {
    const timer = setTimeout(() => {
      primaryRef.current?.focus();
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Prevent background scrolling while the modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus trap: keep focus on the single active button
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled])',
      );
      if (focusable && focusable.length === 1) {
        e.preventDefault();
      }
    }
  }

  return (
    <>
      <div className={styles.backdrop} aria-hidden="true" data-testid="game-over-backdrop" />
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-heading"
        aria-describedby="game-over-reason"
        onKeyDown={handleKeyDown}
        data-testid="game-over-dialog"
      >
        <div className={styles.resultIcon}>
          <ResultIcon result={result} />
        </div>
        <h2 id="game-over-heading" className={styles.heading}>
          {getResultHeading(result)}
        </h2>
        <p id="game-over-reason" className={styles.reason}>
          {getReasonDescription(result)}
        </p>
        <div className={styles.actions}>
          <button
            ref={primaryRef}
            className={styles.primaryButton}
            onClick={onNewGame}
            data-testid="game-over-new-game"
          >
            New Game
          </button>
          <button
            className={styles.secondaryButton}
            disabled
            title="Coming in a future update"
            data-testid="game-over-review"
          >
            Review
          </button>
        </div>
      </div>
    </>
  );
}
