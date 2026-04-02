/**
 * Game control buttons: New Game, Undo, and Resign.
 *
 * Undo availability depends on both the engine (moves exist) and the
 * game-mode policy (unlimited / limited / none). Destructive actions
 * (New Game, Resign) show a confirmation dialog.
 */

import styles from './GameControls.module.css';

interface GameControlsProps {
  canUndo: boolean;
  undoTooltip: string;
  isGameInProgress: boolean;
  onNewGame: () => void;
  onUndo: () => void;
  onResign: () => void;
  onMainMenu?: () => void;
}

export default function GameControls({
  canUndo,
  undoTooltip,
  isGameInProgress,
  onNewGame,
  onUndo,
  onResign,
  onMainMenu,
}: GameControlsProps) {
  function handleNewGame() {
    if (isGameInProgress) {
      if (window.confirm('Start a new game? Current game will be lost.')) {
        onNewGame();
      }
    } else {
      onNewGame();
    }
  }

  function handleResign() {
    if (window.confirm('Are you sure you want to resign?')) {
      onResign();
    }
  }

  return (
    <div className={styles.gameControls} data-testid="game-controls">
      <button
        className={styles.controlButton}
        onClick={handleNewGame}
        aria-label="New Game"
        title="Start a new game"
      >
        New Game
      </button>
      <button
        className={styles.controlButton}
        onClick={onUndo}
        disabled={!canUndo}
        aria-label={undoTooltip}
        title={undoTooltip}
      >
        Undo
      </button>
      <button
        className={styles.controlButton}
        onClick={handleResign}
        disabled={!isGameInProgress}
        aria-label="Resign"
        title={isGameInProgress ? 'Resign the current game' : 'Game is over'}
      >
        Resign
      </button>
      {onMainMenu && (
        <button
          className={styles.controlButton}
          onClick={onMainMenu}
          aria-label="Return to main menu"
          title="Return to main menu"
        >
          Main Menu
        </button>
      )}
    </div>
  );
}
