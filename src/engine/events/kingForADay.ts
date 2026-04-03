/**
 * King for a Day — production event decorator.
 *
 * All pawns temporarily become kings for 1 round (2 plies).
 * Original kings and legitimately promoted pieces are preserved on reversion.
 *
 * Stateless: all per-event state lives in ActiveEvent.metadata, not instance fields.
 */

import type { BoardState, Move, PieceColor, RuleSet, SquareState } from '../types';
import { CrazyEvent, PieceType, square } from '../types';
import { isPromotionSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY } from '../events';

/**
 * Metadata stored in ActiveEvent.metadata for King for a Day.
 *
 * Records which board squares held king-type pieces at the moment the event
 * was activated. Used by onTurnEnd to decide which kings to revert to pawns.
 */
export interface KingForADayMetadata {
  readonly originalKingSquares: readonly number[];
}

/**
 * Returns a new board with all pawns upgraded to kings.
 * Pure function — no side effects.
 */
function upgradeAllPawnsToKings(board: BoardState): BoardState {
  const newBoard = [...board] as SquareState[];
  for (let i = 0; i < newBoard.length; i++) {
    const piece = newBoard[i];
    if (piece != null && piece.type === PieceType.Pawn) {
      newBoard[i] = { color: piece.color, type: PieceType.King };
    }
  }
  return newBoard;
}

export class KingForADayDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.KingForADay;
  }

  withInner(inner: RuleSet): KingForADayDecorator {
    return new KingForADayDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const transformedBoard = upgradeAllPawnsToKings(board);
    return this.inner.getLegalMoves(transformedBoard, activeColor);
  }

  override onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    const result = super.onTurnStart(board, activeColor);
    return upgradeAllPawnsToKings(result);
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    const result = super.onTurnEnd(board, activeColor, move);

    // Read metadata from the active events context (set by CompositeEventRuleSet)
    const metadata = this.getKingForADayMetadata();
    const originalKingSquares = metadata?.originalKingSquares ?? [];

    return this.revertTemporaryKings(result, move, originalKingSquares);
  }

  /**
   * Finds the KingForADay metadata from the active events context.
   * Returns the newest (last) matching entry per the stacking rule.
   */
  private getKingForADayMetadata(): KingForADayMetadata | undefined {
    for (let i = this.activeEventsContext.length - 1; i >= 0; i--) {
      const event = this.activeEventsContext[i];
      if (event?.type === CrazyEvent.KingForADay && event.metadata) {
        return event.metadata as unknown as KingForADayMetadata;
      }
    }
    return undefined;
  }

  /**
   * Reverts temporary kings back to pawns. A king stays a king if:
   * 1. It was an original king before the event activated.
   * 2. It legitimately promoted by reaching its promotion row.
   */
  private revertTemporaryKings(
    board: BoardState,
    move: Move,
    originalKingSquares: readonly number[],
  ): BoardState {
    const newBoard = [...board] as SquareState[];
    const fromSquare = move.from as number;
    const finalSquare = move.path[move.path.length - 1];
    const landingSquare = finalSquare !== undefined ? (finalSquare as number) : -1;
    const movingPieceWasOriginalKing = originalKingSquares.includes(fromSquare);

    for (let i = 0; i < newBoard.length; i++) {
      const piece = newBoard[i];
      if (piece == null || piece.type !== PieceType.King) continue;

      const squareNum = i + 1;

      if (squareNum === landingSquare) {
        // This is the piece that just moved
        if (movingPieceWasOriginalKing) continue;
        if (isPromotionSquare(square(squareNum), piece.color)) continue;
        newBoard[i] = { color: piece.color, type: PieceType.Pawn };
      } else {
        // Stationary piece
        if (originalKingSquares.includes(squareNum)) continue;
        if (isPromotionSquare(square(squareNum), piece.color)) continue;
        newBoard[i] = { color: piece.color, type: PieceType.Pawn };
      }
    }

    return newBoard;
  }
}

// Register in the event decorator registry
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.KingForADay,
  (base: RuleSet) => new KingForADayDecorator(base),
);
