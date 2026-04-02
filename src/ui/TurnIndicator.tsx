/**
 * Turn indicator — shows whose turn it is (color swatch + text label),
 * or the game result when the game is over.
 */

import type { PieceColor, GameResult } from '../engine/types';
import { PieceColor as PC, GameResultType, GameEndReason } from '../engine/types';

interface TurnIndicatorProps {
  activeColor: PieceColor;
  isGameOver: boolean;
  result: GameResult | null;
  isThinking?: boolean;
}

function formatGameResult(result: GameResult): string {
  const winner =
    result.type === GameResultType.WhiteWin
      ? 'White'
      : result.type === GameResultType.BlackWin
        ? 'Black'
        : null;

  const reasonText: Record<string, string> = {
    [GameEndReason.NoPiecesLeft]: 'all pieces captured',
    [GameEndReason.NoLegalMoves]: 'no legal moves',
    [GameEndReason.Repetition]: 'threefold repetition',
    [GameEndReason.FortyMoveRule]: '40-move rule',
    [GameEndReason.Resignation]: 'resignation',
  };

  const reason = reasonText[result.reason] ?? 'unknown';

  if (winner) {
    return `${winner} wins — ${reason}`;
  }
  return `Draw — ${reason}`;
}

export default function TurnIndicator({
  activeColor,
  isGameOver,
  result,
  isThinking = false,
}: TurnIndicatorProps) {
  const isWhite = activeColor === PC.White;
  const fillVar = isWhite ? 'var(--piece-white)' : 'var(--piece-black)';
  const strokeVar = isWhite
    ? 'var(--piece-white-stroke)'
    : 'var(--piece-black-stroke)';

  let label: string;
  if (isGameOver && result) {
    label = formatGameResult(result);
  } else if (isThinking) {
    label = 'Thinking\u2026';
  } else {
    label = `${isWhite ? 'White' : 'Black'}'s turn`;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0',
      }}
      aria-live="polite"
      role="status"
      data-testid="turn-indicator"
    >
      <svg width={20} height={20} aria-hidden="true">
        <circle cx={10} cy={10} r={8} fill={fillVar} stroke={strokeVar} strokeWidth={2} />
      </svg>
      <span
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--ui-text)',
          ...(isThinking && !isGameOver
            ? { animation: 'pulse 1.2s ease-in-out infinite' }
            : {}),
        }}
      >
        {label}
      </span>
    </div>
  );
}
