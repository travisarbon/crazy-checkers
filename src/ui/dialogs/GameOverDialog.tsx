/**
 * Game-over modal dialog showing result and offering New Game / Review actions.
 *
 * Displays the result (win/loss/draw), the reason the game ended,
 * and offers "New Game" and "Review" (disabled placeholder) actions.
 *
 * Accessibility: role="dialog", aria-modal, focus trap, scroll lock.
 */

import { useEffect, useRef } from 'react';
import type { ActiveEvent, GameResult, PieceColor } from '../../engine/types';
import { GameMode, GameResultType, GameEndReason, PieceColor as PC } from '../../engine/types';
import type { ClockState } from '../../engine/clock';
import { getRemainingTime, formatTime } from '../../engine/clock';
import { EVENT_DISPLAY_NAMES } from '../../engine/events';
import { CHOICE_MODE_DATA } from '../../persistence/choiceModeData';
import styles from './GameOverDialog.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GameOverDialogProps {
  result: GameResult;
  lastActiveColor: PieceColor;
  mode?: GameMode;
  activeEvents?: readonly ActiveEvent[];
  /** Final clock state for timed games. */
  clockState?: ClockState | null;
  onNewGame: () => void;
  onReview?: () => void;
  onMainMenu?: () => void;
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

function colorName(color: PieceColor): string {
  return color === PC.White ? 'White' : 'Black';
}

function getReasonDescription(result: GameResult, lastActiveColor: PieceColor): string {
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
      return `${colorName(lastActiveColor)} resigned the game.`;
    case GameEndReason.Time:
      return `${colorName(lastActiveColor)} ran out of time.`;
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
      <path d="M 16,32 L 20,22 L 24,28 L 28,22 L 32,28 L 36,22 L 40,32 Z" fill="var(--ui-accent)" />
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
  lastActiveColor,
  mode,
  activeEvents,
  clockState,
  onNewGame,
  onReview,
  onMainMenu,
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

  // Focus trap: keep Tab cycling within the dialog
  function handleKeyDown(e: React.KeyboardEvent) {
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
        {mode === GameMode.Crazy && (
          <p className={styles.modeLabel} data-testid="game-over-mode-label">Crazy Mode</p>
        )}
        {mode === GameMode.Chaos && (
          <p className={styles.modeLabel} data-testid="game-over-mode-label">Chaos Mode</p>
        )}
        {mode === GameMode.Choice && (() => {
          const permanent = activeEvents?.find((e) => e.permanent === true);
          const def = permanent
            ? CHOICE_MODE_DATA.find((d) => d.event === permanent.type)
            : CHOICE_MODE_DATA.find((d) => d.event === null);
          const label = def?.displayName ?? 'Choice Mode';
          return (
            <p className={styles.modeLabel} data-testid="game-over-mode-label">{label}</p>
          );
        })()}
        <p id="game-over-reason" className={styles.reason}>
          {getReasonDescription(result, lastActiveColor)}
        </p>
        {clockState && result.reason === GameEndReason.Time && (
          <p className={styles.clockTimes} data-testid="game-over-clock-times">
            <span style={{ color: 'var(--ui-text)' }}>
              White: {formatTime(getRemainingTime(clockState, PC.White))}
            </span>
            {' \u2014 '}
            <span style={{ color: 'var(--ui-text)' }}>
              Black: {formatTime(getRemainingTime(clockState, PC.Black))}
            </span>
          </p>
        )}
        {(mode === GameMode.Crazy || mode === GameMode.Chaos || mode === GameMode.Choice)
          && activeEvents
          && activeEvents.length > 0 && (
          <p className={styles.activeEventsNote} data-testid="game-over-active-events">
            Events active at game end: {activeEvents.map((e) => EVENT_DISPLAY_NAMES[e.type]).join(', ')}
          </p>
        )}
        <div className={styles.actions}>
          {onMainMenu && (
            <button
              className={styles.secondaryButton}
              onClick={onMainMenu}
              data-testid="game-over-main-menu"
            >
              Main Menu
            </button>
          )}
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
            onClick={onReview}
            disabled={!onReview}
            title={onReview ? 'Replay this game in Cogitate' : 'Saving game history…'}
            data-testid="game-over-review"
          >
            Review
          </button>
        </div>
      </div>
    </>
  );
}
