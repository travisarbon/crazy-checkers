/**
 * Frozen Assets — production event decorator (Event 18).
 *
 * All kings are frozen (cannot move or capture) for 2 rounds (4 plies).
 * Only pawns can move. If KingForADay is also active, Frozen Assets is
 * nullified (KingForADay takes precedence).
 *
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent, PieceType } from '../types';
import { getBoardSquare, getSquaresWithColor } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Filters out all moves originating from king-occupied squares.
 * If filtering removes all jumps, regenerates simple moves for pawns only.
 *
 * Pure function — no side effects.
 */
export function filterKingMoves(
  board: BoardState,
  moves: Move[],
  activeColor: PieceColor,
): Move[] {
  // Separate jumps from simple moves
  const jumps = moves.filter(m => m.captured.length > 0);
  const simples = moves.filter(m => m.captured.length === 0);

  if (jumps.length === 0) {
    // No jumps — filter simple moves from kings
    return simples.filter(m => {
      const piece = getBoardSquare(board, m.from);
      return piece !== null && piece.type !== PieceType.King;
    });
  }

  // Filter jumps: remove any originating from a king
  const filteredJumps = jumps.filter(m => {
    const piece = getBoardSquare(board, m.from);
    return piece !== null && piece.type !== PieceType.King;
  });

  if (filteredJumps.length > 0) {
    // Some pawn jumps survived — mandatory capture holds
    return filteredJumps;
  }

  // All jumps were king moves; regenerate simple moves for pawns
  const fallbackSimples: Move[] = [];
  const pieces = getSquaresWithColor(board, activeColor);
  for (const sq of pieces) {
    const piece = getBoardSquare(board, sq);
    if (piece !== null && piece.type === PieceType.Pawn) {
      fallbackSimples.push(...getSimpleMovesForPiece(board, sq));
    }
  }
  return fallbackSimples;
}

export class FrozenAssetsDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.FrozenAssets;
  }

  withInner(inner: RuleSet): FrozenAssetsDecorator {
    return new FrozenAssetsDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    // KingForADay takes precedence — skip filtering
    if (this.activeEventsContext.some(ae => ae.type === CrazyEvent.KingForADay)) {
      return innerMoves;
    }

    // Cancel out with Royal Decree — both active = all pieces move normally
    if (this.activeEventsContext.some(ae => ae.type === CrazyEvent.RoyalDecree)) {
      return innerMoves;
    }

    return filterKingMoves(board, innerMoves, activeColor);
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.FrozenAssets,
  (base: RuleSet) => new FrozenAssetsDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.FrozenAssets,
  () => undefined,
);
