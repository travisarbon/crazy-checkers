/**
 * ARIA live region that announces game events for screen readers.
 *
 * Announces: moves (in notation), captures, kinging, turn changes,
 * and game-over results. Visually hidden — only consumed by assistive tech.
 */

import { useState } from 'react';
import type { BoardState, GameState, Move } from '../engine/types';
import { GameStatus, PieceColor, GameResultType, GameEndReason, PieceType } from '../engine/types';
import { getBoardSquare } from '../engine/board';
import { moveToString } from '../utils/notation';

interface GameAnnouncerProps {
  gameState: GameState;
  isAnimating: boolean;
}

function describeMoveEvent(
  move: Move,
  gameState: GameState,
  previousBoard: BoardState | null,
): string {
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

  // Kinging: fired only when a pawn was promoted during this move.
  // Compare the source-square piece type on the pre-move board against the
  // destination-square piece type on the post-move board. If the source was
  // a pawn and the destination is now a king, a promotion occurred.
  const destination = move.path[move.path.length - 1];
  if (destination !== undefined && previousBoard !== null) {
    const pieceAfter = getBoardSquare(gameState.board, destination);
    const pieceBefore = getBoardSquare(previousBoard, move.from);
    if (
      pieceBefore !== null &&
      pieceAfter !== null &&
      pieceBefore.type === PieceType.Pawn &&
      pieceAfter.type === PieceType.King
    ) {
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
  const [trackedBoard, setTrackedBoard] = useState(gameState.board);

  // Derive announcement from prop changes during render (no effect needed).
  // React's "you can set state during render if the value changed" pattern.
  if (!isAnimating) {
    if (gameState.plyCount !== trackedPly && gameState.plyCount > 0) {
      const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
      if (lastMove) {
        const moveDesc = describeMoveEvent(lastMove, gameState, trackedBoard);

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
      setTrackedBoard(gameState.board);
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
