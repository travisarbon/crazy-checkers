/**
 * Game-setup dialog for Classic mode.
 *
 * Collects game type (Pass Around / vs. CPU), color choice,
 * and difficulty (if vs. CPU). Maps selections to a PlayerSetup
 * and flipped flag, then calls onConfirm.
 *
 * Accessibility: aria-modal, focus trap, Escape-to-close, scroll lock.
 */

import { useState, useEffect, useRef } from 'react';
import { PlayerType } from '../../engine/types';
import type { PlayerSetup } from '../../engine/types';
import styles from './GameSetupDialog.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GameSetupDialogProps {
  onConfirm: (players: PlayerSetup, flipped: boolean) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GameType = 'pass-around' | 'vs-cpu';
type ColorChoice = 'white' | 'black';
type DifficultyChoice = 'easy' | 'hard';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GameSetupDialog({ onConfirm, onCancel }: GameSetupDialogProps) {
  const [gameType, setGameType] = useState<GameType>('pass-around');
  const [colorChoice, setColorChoice] = useState<ColorChoice>('white');
  const [difficultyChoice, setDifficultyChoice] = useState<DifficultyChoice>('easy');

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the first radio after entry animation
  useEffect(() => {
    const timer = setTimeout(() => {
      firstInputRef.current?.focus();
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Prevent background scrolling
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape key closes dialog
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  // Focus trap
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input, button:not([disabled])',
    );
    if (!focusable || focusable.length === 0) return;

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

  function handleConfirm(): void {
    let players: PlayerSetup;
    let flipped: boolean;

    if (gameType === 'pass-around') {
      players = { white: PlayerType.Human, black: PlayerType.Human };
      flipped = colorChoice === 'black';
    } else {
      const cpuType = difficultyChoice === 'easy' ? PlayerType.CpuEasy : PlayerType.CpuHard;
      if (colorChoice === 'white') {
        players = { white: PlayerType.Human, black: cpuType };
        flipped = false;
      } else {
        players = { white: cpuType, black: PlayerType.Human };
        flipped = true;
      }
    }

    onConfirm(players, flipped);
  }

  return (
    <>
      <div
        className={styles.dialogOverlay}
        aria-hidden="true"
        onClick={onCancel}
        data-testid="setup-overlay"
      />
      <div
        ref={dialogRef}
        className={styles.dialogCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        onKeyDown={handleKeyDown}
        data-testid="game-setup-dialog"
      >
        <h2 id="setup-title" className={styles.dialogTitle}>
          Classic Mode
        </h2>

        {/* Game Type */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Game Type</legend>
          <label className={styles.radioLabel}>
            <input
              ref={firstInputRef}
              type="radio"
              name="gameType"
              value="pass-around"
              checked={gameType === 'pass-around'}
              onChange={() => {
                setGameType('pass-around');
              }}
            />
            Pass Around (two players)
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="gameType"
              value="vs-cpu"
              checked={gameType === 'vs-cpu'}
              onChange={() => {
                setGameType('vs-cpu');
              }}
            />
            vs. CPU
          </label>
        </fieldset>

        {/* Color Selection */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            {gameType === 'pass-around' ? 'Player 1 Color' : 'Your Color'}
          </legend>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="color"
              value="white"
              checked={colorChoice === 'white'}
              onChange={() => {
                setColorChoice('white');
              }}
            />
            White (moves first)
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="color"
              value="black"
              checked={colorChoice === 'black'}
              onChange={() => {
                setColorChoice('black');
              }}
            />
            Black
          </label>
        </fieldset>

        {/* Difficulty (vs. CPU only) */}
        {gameType === 'vs-cpu' && (
          <fieldset className={styles.fieldset} data-testid="difficulty-fieldset">
            <legend className={styles.legend}>Difficulty</legend>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="difficulty"
                value="easy"
                checked={difficultyChoice === 'easy'}
                onChange={() => {
                  setDifficultyChoice('easy');
                }}
              />
              Easy
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="difficulty"
                value="hard"
                checked={difficultyChoice === 'hard'}
                onChange={() => {
                  setDifficultyChoice('hard');
                }}
              />
              Hard
            </label>
          </fieldset>
        )}

        {/* Footer */}
        <div className={styles.dialogFooter}>
          <button className={styles.secondaryButton} onClick={onCancel} data-testid="setup-cancel">
            Cancel
          </button>
          <button
            className={styles.primaryButton}
            onClick={handleConfirm}
            data-testid="setup-start"
          >
            Start Game
          </button>
        </div>
      </div>
    </>
  );
}
