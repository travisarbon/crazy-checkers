/**
 * Royal Decree — production event decorator (Event 33).
 *
 * Only kings may move for 2 rounds (4 plies). If a player has no kings,
 * pawns move normally (safety valve). If Frozen Assets is also active,
 * both cancel out and all pieces move normally.
 *
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent, PieceType } from '../types';
import { getBoardSquare, getSquaresWithColor } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Filters moves to king-only moves. If player has no kings, returns
 * all moves unchanged (safety valve). If all jumps are pawn jumps,
 * regenerates simple moves for kings as fallback.
 *
 * Pure function — no side effects.
 */
export function filterToKingMoves(
  board: BoardState,
  moves: Move[],
  activeColor: PieceColor,
): Move[] {
  // Safety valve: if no kings exist, all pieces move normally
  const pieces = getSquaresWithColor(board, activeColor);
  const hasKing = pieces.some(sq => {
    const p = getBoardSquare(board, sq);
    return p !== null && p.type === PieceType.King;
  });
  if (!hasKing) return moves;

  const jumps = moves.filter(m => m.captured.length > 0);

  if (jumps.length === 0) {
    // No jumps — filter simple moves to kings only
    return moves.filter(m => {
      const piece = getBoardSquare(board, m.from);
      return piece !== null && piece.type === PieceType.King;
    });
  }

  // Filter jumps to king jumps only
  const kingJumps = jumps.filter(m => {
    const piece = getBoardSquare(board, m.from);
    return piece !== null && piece.type === PieceType.King;
  });

  if (kingJumps.length > 0) {
    return kingJumps;
  }

  // All jumps were pawn jumps; regenerate simple moves for kings
  const fallbackSimples: Move[] = [];
  for (const sq of pieces) {
    const piece = getBoardSquare(board, sq);
    if (piece !== null && piece.type === PieceType.King) {
      fallbackSimples.push(...getSimpleMovesForPiece(board, sq));
    }
  }
  return fallbackSimples;
}

export class RoyalDecreeDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.RoyalDecree;
  }

  withInner(inner: RuleSet): RoyalDecreeDecorator {
    return new RoyalDecreeDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    // Cancel out with Frozen Assets — both active = all pieces move normally
    if (this.activeEventsContext.some(ae => ae.type === CrazyEvent.FrozenAssets)) {
      return innerMoves;
    }

    return filterToKingMoves(board, innerMoves, activeColor);
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.RoyalDecree,
  (base: RuleSet) => new RoyalDecreeDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.RoyalDecree,
  () => undefined,
);
