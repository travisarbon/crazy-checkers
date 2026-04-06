/**
 * Demotion — production event decorator (Event 25).
 *
 * All kings are instantly demoted to pawns. Pieces already on their
 * promotion row are NOT re-promoted on the same ply — they must leave
 * and re-enter the promotion row.
 *
 * Duration: 0 (instant). Fires in onTurnStart, removed after the ply.
 * Uses metadata to track demoted pieces sitting on their promotion row
 * for one-ply shouldPromote suppression.
 *
 * Stateless: all per-event state lives in ActiveEvent.metadata.
 */

import type { BoardState, Move, Piece, PieceColor, RuleSet, Square, SquareState } from '../types';
import { CrazyEvent, PieceType } from '../types';
import { getBoardSquare, isPromotionSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** Metadata stored in ActiveEvent.metadata for Demotion. */
export interface DemotionMetadata {
  readonly demotedOnPromotionRow: readonly number[];
}

export class DemotionDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Demotion;
  }

  withInner(inner: RuleSet): DemotionDecorator {
    return new DemotionDecorator(inner);
  }

  override onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    const result = super.onTurnStart(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) return result;

    const newBoard = [...result] as SquareState[];
    const demotedOnPromotionRow: number[] = [];

    for (let i = 0; i < newBoard.length; i++) {
      const piece = newBoard[i];
      if (piece != null && piece.type === PieceType.King) {
        const pawn: Piece = { color: piece.color, type: PieceType.Pawn };
        newBoard[i] = pawn;
        const sq = (i + 1) as Square;
        if (isPromotionSquare(sq, piece.color)) {
          demotedOnPromotionRow.push(i + 1);
        }
      }
    }

    // Store suppressed squares in metadata
    this.requestMetadataUpdate(CrazyEvent.Demotion, { demotedOnPromotionRow });

    return newBoard;
  }

  override shouldPromote(piece: Piece, sq: Square): boolean {
    const innerResult = this.inner.shouldPromote(piece, sq);

    if (!this.isActive(this.activeEventsContext)) return innerResult;
    if (!innerResult) return false;

    // Suppress re-promotion for demoted pieces still on their promotion row
    const metadata = this.getDemotionMetadata();
    if (metadata !== undefined && metadata.demotedOnPromotionRow.includes(sq as number)) {
      return false;
    }

    return true;
  }

  override applyMove(board: BoardState, move: Move): BoardState {
    const result = this.inner.applyMove(board, move);

    if (!this.isActive(this.activeEventsContext)) return result;

    // Post-process: if the inner promoted a piece on a suppressed square,
    // demote it back. This handles the case where a demoted pawn on its
    // promotion row is moved by the inner's applyMove which re-promotes it.
    const finalSquare = move.path[move.path.length - 1];
    if (finalSquare === undefined) return result;

    const landingPiece = getBoardSquare(result, finalSquare);
    if (landingPiece === null || landingPiece.type !== PieceType.King) return result;

    const metadata = this.getDemotionMetadata();
    if (metadata !== undefined && metadata.demotedOnPromotionRow.includes(finalSquare as number)) {
      const newBoard = [...result] as SquareState[];
      newBoard[(finalSquare as number) - 1] = { color: landingPiece.color, type: PieceType.Pawn };
      return newBoard;
    }

    return result;
  }

  private getDemotionMetadata(): DemotionMetadata | undefined {
    for (let i = this.activeEventsContext.length - 1; i >= 0; i--) {
      const event = this.activeEventsContext[i];
      if (event?.type === CrazyEvent.Demotion && event.metadata) {
        return event.metadata as unknown as DemotionMetadata;
      }
    }
    return undefined;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Demotion,
  (base: RuleSet) => new DemotionDecorator(base),
);

// No initial metadata needed — metadata set dynamically via onTurnStart
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Demotion,
  () => undefined,
);
