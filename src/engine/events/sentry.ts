/**
 * Sentry — production event decorator (Event 35).
 *
 * Kings project a zone of control over diagonally adjacent squares.
 * Enemy pawns adjacent to an opposing king cannot make simple
 * (non-capturing) moves — they are pinned. Pinned pawns CAN still
 * capture. Kings do not pin other kings.
 *
 * Duration: 4 plies (2 rounds).
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent, PieceType, opponentColor } from '../types';
import { getAllAdjacentSquares, getBoardSquare, getSquaresWithColor } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns the set of squares occupied by active-color pawns that are
 * pinned by an opposing king (diagonally adjacent to an enemy king).
 *
 * Pure function — no side effects.
 */
export function getPinnedSquares(board: BoardState, activeColor: PieceColor): Set<number> {
  const oppColor = opponentColor(activeColor);
  const pinnedSquares = new Set<number>();

  // Find all opponent kings
  const oppSquares = getSquaresWithColor(board, oppColor);
  for (const kingSq of oppSquares) {
    const kingPiece = getBoardSquare(board, kingSq);
    if (kingPiece === null || kingPiece.type !== PieceType.King) continue;

    // Check all adjacent squares for active-color pawns
    const adjacents = getAllAdjacentSquares(kingSq);
    for (const { adjacent } of adjacents) {
      const adjPiece = getBoardSquare(board, adjacent);
      if (
        adjPiece !== null &&
        adjPiece.color === activeColor &&
        adjPiece.type === PieceType.Pawn
      ) {
        pinnedSquares.add(adjacent as number);
      }
    }
  }

  return pinnedSquares;
}

export class SentryDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Sentry;
  }

  withInner(inner: RuleSet): SentryDecorator {
    return new SentryDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    const pinned = getPinnedSquares(board, activeColor);
    if (pinned.size === 0) return innerMoves;

    // Filter: remove simple moves from pinned squares (captures retained)
    return innerMoves.filter(m =>
      m.captured.length > 0 || !pinned.has(m.from as number),
    );
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Sentry,
  (base: RuleSet) => new SentryDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Sentry,
  () => undefined,
);
