/**
 * Captured piece counts — derives capture totals from move history
 * and displays them with color swatches. Supports pending capture
 * offsets for real-time sync with capture animations.
 */

import { useEffect, useRef, useState } from 'react';
import type { Move } from '../engine/types';
import capturedStyles from './CapturedPieces.module.css';

interface CapturedPiecesProps {
  moveHistory: readonly Move[];
  /** Additional captures to display that haven't yet been committed to moveHistory. */
  pendingCaptures?: { white: number; black: number };
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

export default function CapturedPieces({ moveHistory, pendingCaptures }: CapturedPiecesProps) {
  const { white: baseWhite, black: baseBlack } = countCaptures(moveHistory);
  const white = baseWhite + (pendingCaptures?.white ?? 0);
  const black = baseBlack + (pendingCaptures?.black ?? 0);

  // Bump animation when counts change
  const [whiteBump, setWhiteBump] = useState(false);
  const [blackBump, setBlackBump] = useState(false);
  const prevWhiteRef = useRef(white);
  const prevBlackRef = useRef(black);

  useEffect(() => {
    if (white > prevWhiteRef.current) {
      // Use microtask to avoid synchronous setState in effect body
      void Promise.resolve().then(() => {
        setWhiteBump(true);
      });
      const timer = setTimeout(() => {
        setWhiteBump(false);
      }, 200);
      prevWhiteRef.current = white;
      return () => {
        clearTimeout(timer);
      };
    }
    prevWhiteRef.current = white;
  }, [white]);

  useEffect(() => {
    if (black > prevBlackRef.current) {
      void Promise.resolve().then(() => {
        setBlackBump(true);
      });
      const timer = setTimeout(() => {
        setBlackBump(false);
      }, 200);
      prevBlackRef.current = black;
      return () => {
        clearTimeout(timer);
      };
    }
    prevBlackRef.current = black;
  }, [black]);

  return (
    <div data-testid="captured-pieces" style={{ fontSize: '0.875rem', color: 'var(--ui-text)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}
        aria-label={`${String(white)} black piece${white !== 1 ? 's' : ''} captured`}
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
        <span
          className={
            [capturedStyles.captureCount, whiteBump ? capturedStyles.captureCountBump : '']
              .filter(Boolean)
              .join(' ') || undefined
          }
          style={{ opacity: white === 0 ? 0.4 : 1 }}
          data-testid="capture-count-white"
        >
          &times;{white}
        </span>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        aria-label={`${String(black)} white piece${black !== 1 ? 's' : ''} captured`}
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
        <span
          className={
            [capturedStyles.captureCount, blackBump ? capturedStyles.captureCountBump : '']
              .filter(Boolean)
              .join(' ') || undefined
          }
          style={{ opacity: black === 0 ? 0.4 : 1 }}
          data-testid="capture-count-black"
        >
          &times;{black}
        </span>
      </div>
    </div>
  );
}
