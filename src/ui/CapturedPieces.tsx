/**
 * Captured piece counts — derives capture totals from move history
 * and displays them with color swatches.
 */

import type { Move } from '../engine/types';

interface CapturedPiecesProps {
  moveHistory: readonly Move[];
}

function countCaptures(moveHistory: readonly Move[]): {
  white: number;
  black: number;
} {
  let whiteCaptured = 0; // pieces captured BY white (black pieces removed)
  let blackCaptured = 0; // pieces captured BY black (white pieces removed)

  for (let i = 0; i < moveHistory.length; i++) {
    const move = moveHistory[i];
    if (!move) continue;
    const captureCount = move.captured.length;
    if (captureCount > 0) {
      if (i % 2 === 0) {
        whiteCaptured += captureCount;
      } else {
        blackCaptured += captureCount;
      }
    }
  }

  return { white: whiteCaptured, black: blackCaptured };
}

export default function CapturedPieces({ moveHistory }: CapturedPiecesProps) {
  const { white, black } = countCaptures(moveHistory);

  return (
    <div data-testid="captured-pieces" style={{ fontSize: '0.875rem', color: 'var(--ui-text)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}
        aria-label={`Black pieces captured: ${String(white)}`}
      >
        <svg width={16} height={16} aria-hidden="true">
          <circle
            cx={8}
            cy={8}
            r={6}
            fill="var(--piece-black)"
            stroke="var(--piece-black-stroke)"
            strokeWidth={1.5}
          />
        </svg>
        <span style={{ opacity: white === 0 ? 0.4 : 1 }}>&times;{white}</span>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        aria-label={`White pieces captured: ${String(black)}`}
      >
        <svg width={16} height={16} aria-hidden="true">
          <circle
            cx={8}
            cy={8}
            r={6}
            fill="var(--piece-white)"
            stroke="var(--piece-white-stroke)"
            strokeWidth={1.5}
          />
        </svg>
        <span style={{ opacity: black === 0 ? 0.4 : 1 }}>&times;{black}</span>
      </div>
    </div>
  );
}
