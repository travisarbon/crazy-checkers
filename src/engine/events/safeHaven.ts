/**
 * Safe Haven — production event decorator (Event 20).
 *
 * Pieces on four fixed near-corner squares (5, 8, 25, 28) cannot be
 * captured for 2 rounds (4 plies). Jump chains that capture any piece
 * on a safe haven square are invalid.
 *
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent } from '../types';
import { getSquaresWithColor } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * The four fixed safe haven squares (near-corner positions):
 * - 5: row 1, col 0 (top-left)
 * - 8: row 1, col 6 (top-right)
 * - 25: row 6, col 1 (bottom-left)
 * - 28: row 6, col 7 (bottom-right)
 */
export const SAFE_HAVEN_SQUARES: ReadonlySet<number> = new Set([5, 8, 25, 28]);

/**
 * Filters out jump moves that capture any piece on a safe haven square.
 * If all jumps are removed, regenerates simple moves as fallback.
 *
 * Pure function — no side effects.
 */
export function filterSafeHavenCaptures(
  board: BoardState,
  moves: Move[],
  activeColor: PieceColor,
): Move[] {
  const jumps = moves.filter(m => m.captured.length > 0);

  if (jumps.length === 0) return moves;

  const filteredJumps = jumps.filter(m => {
    for (const capturedSq of m.captured) {
      if (SAFE_HAVEN_SQUARES.has(capturedSq as number)) return false;
    }
    return true;
  });

  if (filteredJumps.length > 0) {
    return filteredJumps;
  }

  // All jumps captured safe haven pieces; regenerate simple moves
  const fallbackSimples: Move[] = [];
  const pieces = getSquaresWithColor(board, activeColor);
  for (const sq of pieces) {
    fallbackSimples.push(...getSimpleMovesForPiece(board, sq));
  }
  return fallbackSimples;
}

export class SafeHavenDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.SafeHaven;
  }

  withInner(inner: RuleSet): SafeHavenDecorator {
    return new SafeHavenDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);
    return filterSafeHavenCaptures(board, innerMoves, activeColor);
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.SafeHaven,
  (base: RuleSet) => new SafeHavenDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.SafeHaven,
  () => undefined,
);
