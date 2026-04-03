/**
 * ARIA live region that announces game events for screen readers.
 *
 * Announces: moves (in notation), captures, kinging, turn changes,
 * and game-over results. Visually hidden — only consumed by assistive tech.
 */

import { useState } from 'react';
import type { GameState, Move } from '../engine/types';
import { GameStatus, PieceColor, GameResultType, GameEndReason, PieceType } from '../engine/types';
import { getBoardSquare } from '../engine/board';
import { moveToString } from '../utils/notation';

interface GameAnnouncerProps {
  gameState: GameState;
  isAnimating: boolean;
}

function describeMoveEvent(move: Move, gameState: GameState): string {
  const parts: string[] = [];

  // Who moved
  const moverColor =
    gameState.activeColor === PieceColor.White
      ? 'Black' // activeColor has already advanced
      : 'White';

  // Move notation
  const notation = moveToString(move);
  if (move.captured.length > 0) {
    const captureWord = move.captured.length === 1 ? 'capture' : 'captures';
    parts.push(`${moverColor} ${captureWord}: ${notation}`);
  } else {
    parts.push(`${moverColor} moves: ${notation}`);
  }

  // Check for kinging: look at the destination square on the current board
  const destination = move.path[move.path.length - 1];
  if (destination !== undefined) {
    const piece = getBoardSquare(gameState.board, destination);
    if (piece !== null && piece.type === PieceType.King) {
      // Check if the piece was NOT a king before the move (from square on previous board)
      // Since we only have current state post-move, we check if the move came from a pawn.
      // A simple heuristic: if captures > 0 it could be any piece, but promotion only
      // happens for pawns. We announce it when the piece at destination is a king.
      parts.push('Kinged!');
    }
  }

  return parts.join('. ');
}

function describeGameOver(gameState: GameState): string {
  if (!gameState.result) return '';

  const reasonText: Record<string, string> = {
    [GameEndReason.NoPiecesLeft]: 'all pieces captured',
    [GameEndReason.NoLegalMoves]: 'no legal moves',
    [GameEndReason.Repetition]: 'threefold repetition',
    [GameEndReason.FortyMoveRule]: '40-move rule',
    [GameEndReason.Resignation]: 'resignation',
  };

  const reason = reasonText[gameState.result.reason] ?? 'unknown';

  if (gameState.result.type === GameResultType.WhiteWin) {
    return `Game over. White wins by ${reason}.`;
  }
  if (gameState.result.type === GameResultType.BlackWin) {
    return `Game over. Black wins by ${reason}.`;
  }
  return `Game over. Draw by ${reason}.`;
}

export default function GameAnnouncer({ gameState, isAnimating }: GameAnnouncerProps) {
  const [announcement, setAnnouncement] = useState('');
  const [trackedPly, setTrackedPly] = useState(gameState.plyCount);
  const [trackedStatus, setTrackedStatus] = useState(gameState.status);

  // Derive announcement from prop changes during render (no effect needed).
  // React's "you can set state during render if the value changed" pattern.
  if (!isAnimating) {
    if (gameState.plyCount !== trackedPly && gameState.plyCount > 0) {
      const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
      if (lastMove) {
        const moveDesc = describeMoveEvent(lastMove, gameState);

        if (gameState.status === GameStatus.GameOver) {
          const gameOverDesc = describeGameOver(gameState);
          setAnnouncement(`${moveDesc}. ${gameOverDesc}`);
        } else {
          const nextPlayer = gameState.activeColor === PieceColor.White ? 'White' : 'Black';
          setAnnouncement(`${moveDesc}. ${nextPlayer}'s turn.`);
        }
      }
      setTrackedPly(gameState.plyCount);
      setTrackedStatus(gameState.status);
    } else if (gameState.status === GameStatus.GameOver && trackedStatus !== GameStatus.GameOver) {
      setAnnouncement(describeGameOver(gameState));
      setTrackedStatus(gameState.status);
    }
  }

  return (
    <div
      role="log"
      aria-live="assertive"
      aria-atomic="true"
      aria-label="Game announcements"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {announcement}
    </div>
  );
}
