/**
 * Game control buttons: New Game, Undo, and Resign.
 *
 * Undo availability depends on both the engine (moves exist) and the
 * game-mode policy (unlimited / limited / none). Destructive actions
 * (New Game, Resign) show an in-game confirmation dialog.
 */

import { useState } from 'react';
import ConfirmDialog from './dialogs/ConfirmDialog';
import Icon from './Icon';
import styles from './GameControls.module.css';

interface GameControlsProps {
  canUndo: boolean;
  undoTooltip: string;
  /** Optional short label showing remaining undo count, e.g. "(1)". */
  undoCountLabel?: string;
  isGameInProgress: boolean;
  onNewGame: () => void;
  onUndo: () => void;
  onResign: () => void;
  onMainMenu?: () => void;
}

type PendingAction = 'resign' | 'newGame' | 'mainMenu' | null;

export default function GameControls({
  canUndo,
  undoTooltip,
  undoCountLabel,
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

  function handleMainMenu() {
    if (isGameInProgress && onMainMenu) {
      setPendingAction('mainMenu');
    } else if (onMainMenu) {
      onMainMenu();
    }
  }

  function handleConfirm() {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'resign') {
      onResign();
    } else if (action === 'newGame') {
      onNewGame();
    } else if (action === 'mainMenu' && onMainMenu) {
      onMainMenu();
    }
  }

  function handleCancel() {
    setPendingAction(null);
  }

  const dialogTitle =
    pendingAction === 'resign'
      ? 'Resign Game?'
      : pendingAction === 'mainMenu'
        ? 'Return to Menu?'
        : 'New Game?';
  const dialogMessage =
    pendingAction === 'resign'
      ? 'Are you sure you want to resign? This will count as a loss.'
      : pendingAction === 'mainMenu'
        ? 'Your game will be saved and can be resumed.'
        : 'Start a new game? Your current game will be lost.';
  const dialogConfirmLabel =
    pendingAction === 'resign' ? 'Resign' : pendingAction === 'mainMenu' ? 'Main Menu' : 'New Game';

  return (
    <>
      <div className={styles.gameControls} data-testid="game-controls">
        <button
          className={styles.controlButton}
          onClick={handleNewGame}
          aria-label="New Game"
          title="Start a new game"
        >
          <Icon name="play-fresh" size={16} />
          <span>New Game</span>
        </button>
        <button
          className={styles.controlButton}
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={undoTooltip}
          title={undoTooltip}
        >
          <Icon name="undo" size={16} />
          <span>Undo{undoCountLabel ? ` ${undoCountLabel}` : ''}</span>
        </button>
        <button
          className={styles.controlButton}
          onClick={handleResign}
          disabled={!isGameInProgress}
          aria-label="Resign"
          title={isGameInProgress ? 'Resign the current game' : 'Game is over'}
        >
          <Icon name="flag" size={16} />
          <span>Resign</span>
        </button>
        {onMainMenu && (
          <button
            className={styles.controlButton}
            onClick={handleMainMenu}
            aria-label="Return to main menu"
            title="Return to main menu"
          >
            <Icon name="home" size={16} />
            <span>Main Menu</span>
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
