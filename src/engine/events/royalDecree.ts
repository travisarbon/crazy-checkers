/**
 * Royal Decree — production event decorator (Event 33).
 *
 * Only kings may move for 2 rounds (4 plies). If a player has no kings,
 * pawns move normally (safety valve). If Frozen Assets is also active,
 * both cancel out and all pieces move normally.
 *
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { ActiveEvent, BoardState, Move, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent, PieceType } from '../types';
import { getBoardSquare, getSquaresWithColor } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';
import type { MarchingOrdersMetadata } from './marchingOrders';
import { extSquareToGrid } from './marchingOrders';

/**
 * Looks up the piece type at an extended square, honouring Marching Orders
 * light-square pieces (33–64) which live only in the MO grid metadata.
 */
function lookupPieceType(
  board: BoardState,
  sq: Square,
  moGrid: readonly ({ color: PieceColor; type: PieceType } | null)[] | undefined,
): PieceType | null {
  const sqNum = sq as number;
  if (sqNum <= 32) {
    const p = getBoardSquare(board, sq);
    return p ? p.type : null;
  }
  if (!moGrid) return null;
  const { row, col } = extSquareToGrid(sqNum);
  const gridPiece = moGrid[row * 8 + col];
  return gridPiece ? gridPiece.type : null;
}

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
  activeEvents: readonly ActiveEvent[] = [],
): Move[] {
  // When Marching Orders is active, pieces may occupy light squares (33–64)
  // that are not represented on the 32-square BoardState. Consult the MO
  // grid metadata so king detection remains correct in that mode.
  const moEntry = activeEvents.find(e => e.type === CrazyEvent.MarchingOrders);
  const moGrid = moEntry?.metadata
    ? (moEntry.metadata as unknown as MarchingOrdersMetadata).orthogonalGrid
    : undefined;

  // Safety valve: if no kings exist, all pieces move normally
  let hasKing = false;
  if (moGrid) {
    for (const cell of moGrid) {
      if (cell && cell.color === activeColor && cell.type === PieceType.King) {
        hasKing = true;
        break;
      }
    }
  } else {
    const pieces = getSquaresWithColor(board, activeColor);
    hasKing = pieces.some(sq => {
      const p = getBoardSquare(board, sq);
      return p !== null && p.type === PieceType.King;
    });
  }
  if (!hasKing) return moves;

  const jumps = moves.filter(m => m.captured.length > 0);

  if (jumps.length === 0) {
    // No jumps — filter simple moves to kings only
    return moves.filter(m => lookupPieceType(board, m.from, moGrid) === PieceType.King);
  }

  // Filter jumps to king jumps only
  const kingJumps = jumps.filter(
    m => lookupPieceType(board, m.from, moGrid) === PieceType.King,
  );

  if (kingJumps.length > 0) {
    return kingJumps;
  }

  // All jumps were pawn jumps; return any simple king moves already present
  // in the inner moves. Otherwise fall back to regenerating diagonal simple
  // moves (Marching Orders provides its own simple moves inside `moves`, so
  // this fallback only runs in the non-MO case).
  const simpleKingMoves = moves.filter(
    m => m.captured.length === 0 && lookupPieceType(board, m.from, moGrid) === PieceType.King,
  );
  if (simpleKingMoves.length > 0 || moGrid) {
    return simpleKingMoves;
  }
  const fallbackSimples: Move[] = [];
  for (const sq of getSquaresWithColor(board, activeColor)) {
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

    return filterToKingMoves(board, innerMoves, activeColor, this.activeEventsContext);
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
