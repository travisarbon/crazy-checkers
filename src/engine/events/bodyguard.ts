/**
 * Bodyguard — production event decorator (Event 12).
 *
 * Kings cannot be captured while diagonally adjacent to a friendly pawn
 * for 2 rounds (4 plies). If a multi-jump chain captures any guarded king,
 * the entire chain is invalid.
 *
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent, PieceType } from '../types';
import { getAllAdjacentSquares, getBoardSquare, getSquaresWithColor } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns the set of king square numbers that are guarded (adjacent to a
 * friendly pawn). Both colors' kings are checked.
 *
 * Pure function — no side effects.
 */
export function getGuardedKings(board: BoardState): Set<number> {
  const guarded = new Set<number>();
  for (let i = 0; i < 32; i++) {
    const piece = board[i];
    if (piece == null || piece.type !== PieceType.King) continue;
    const sq = i + 1;
    const neighbors = getAllAdjacentSquares(sq as import('../types').Square);
    for (const { adjacent } of neighbors) {
      const adj = getBoardSquare(board, adjacent);
      if (adj !== null && adj.color === piece.color && adj.type === PieceType.Pawn) {
        guarded.add(sq);
        break;
      }
    }
  }
  return guarded;
}

/**
 * Filters out jump moves that capture any guarded king.
 * If all jumps are removed, regenerates simple moves as fallback.
 *
 * Pure function — no side effects.
 */
export function filterGuardedKingCaptures(
  board: BoardState,
  moves: Move[],
  activeColor: PieceColor,
): Move[] {
  const guarded = getGuardedKings(board);
  if (guarded.size === 0) return moves;

  const jumps = moves.filter(m => m.captured.length > 0);

  if (jumps.length === 0) return moves;

  const filteredJumps = jumps.filter(m => {
    for (const capturedSq of m.captured) {
      if (guarded.has(capturedSq as number)) return false;
    }
    return true;
  });

  if (filteredJumps.length > 0) {
    return filteredJumps;
  }

  // All jumps captured guarded kings; regenerate simple moves
  const fallbackSimples: Move[] = [];
  const pieces = getSquaresWithColor(board, activeColor);
  for (const sq of pieces) {
    fallbackSimples.push(...getSimpleMovesForPiece(board, sq));
  }
  return fallbackSimples;
}

export class BodyguardDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Bodyguard;
  }

  withInner(inner: RuleSet): BodyguardDecorator {
    return new BodyguardDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);
    return filterGuardedKingCaptures(board, innerMoves, activeColor);
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Bodyguard,
  (base: RuleSet) => new BodyguardDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Bodyguard,
  () => undefined,
);
