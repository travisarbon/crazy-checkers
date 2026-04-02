/**
 * Game control buttons: New Game, Undo, and Resign.
 *
 * Undo availability depends on both the engine (moves exist) and the
 * game-mode policy (unlimited / limited / none). Destructive actions
 * (New Game, Resign) show an in-game confirmation dialog.
 */

import { useState } from 'react';
import ConfirmDialog from './dialogs/ConfirmDialog';
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

type PendingAction = 'resign' | 'newGame' | null;

export default function GameControls({
  canUndo,
  undoTooltip,
  isGameInProgress,
  onNewGame,
  onUndo,
  onResign,
  onMainMenu,
}: GameControlsProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  function handleNewGame() {
    if (isGameInProgress) {
      setPendingAction('newGame');
    } else {
      onNewGame();
    }
  }

  function handleResign() {
    setPendingAction('resign');
  }

  function handleConfirm() {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'resign') {
      onResign();
    } else if (action === 'newGame') {
      onNewGame();
    }
  }

  function handleCancel() {
    setPendingAction(null);
  }

  const dialogTitle = pendingAction === 'resign' ? 'Resign Game?' : 'New Game?';
  const dialogMessage = pendingAction === 'resign'
    ? 'Are you sure you want to resign? This will count as a loss.'
    : 'Start a new game? Your current game will be lost.';
  const dialogConfirmLabel = pendingAction === 'resign' ? 'Resign' : 'New Game';

  return (
    <>
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
      {pendingAction !== null && (
        <ConfirmDialog
          title={dialogTitle}
          message={dialogMessage}
          confirmLabel={dialogConfirmLabel}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
