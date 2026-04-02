/**
 * Resume-game dialog shown when the app loads with a saved game in localStorage.
 *
 * Displays saved game metadata and offers Resume / Discard actions.
 * Accessibility: role="dialog", aria-modal, focus trap, scroll lock.
 */

import { useEffect, useRef } from 'react';
import type { SavedGame } from '../../persistence/settings';
import styles from './ResumeGameDialog.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResumeGameDialogProps {
  savedGame: SavedGame;
  onResume: () => void;
  onDiscard: () => void;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatPlayer(playerType: string): string {
  switch (playerType) {
    case 'HUMAN': return 'Human';
    case 'CPU_EASY': return 'CPU Easy';
    case 'CPU_HARD': return 'CPU Hard';
    default: return playerType;
  }
}

function formatPlayerSetup(setup: { white: string; black: string }): string {
  return `${formatPlayer(setup.white)} (White) vs. ${formatPlayer(setup.black)} (Black)`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ResumeGameDialog({
  savedGame,
  onResume,
  onDiscard,
}: ResumeGameDialogProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Auto-focus the Resume button after the slide-up animation
  useEffect(() => {
    const timer = setTimeout(() => {
      primaryRef.current?.focus();
    }, 300);
    return () => { clearTimeout(timer); };
  }, []);

  // Prevent background scrolling
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Focus trap + Escape to discard
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onDiscard();
      return;
    }

    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled])',
    );
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
      <div className={styles.backdrop} aria-hidden="true" data-testid="resume-backdrop" />
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-title"
        onKeyDown={handleKeyDown}
        data-testid="resume-dialog"
      >
        <h2 id="resume-title" className={styles.heading}>
          Resume Game?
        </h2>
        <p className={styles.description}>
          You have an unfinished {savedGame.mode} game from{' '}
          {formatTimestamp(savedGame.timestamp)}.
        </p>
        <div className={styles.details}>
          <dt className={styles.detailLabel}>Players</dt>
          <dd className={styles.detailValue}>
            {formatPlayerSetup(savedGame.playerSetup)}
          </dd>
          <dt className={styles.detailLabel}>Moves played</dt>
          <dd className={styles.detailValue}>
            {String(savedGame.state.plyCount)}
          </dd>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            onClick={onDiscard}
            data-testid="resume-discard"
          >
            Discard
          </button>
          <button
            ref={primaryRef}
            className={styles.primaryButton}
            onClick={onResume}
            data-testid="resume-resume"
          >
            Resume
          </button>
        </div>
      </div>
    </>
  );
}
