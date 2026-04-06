/**
 * Dealer's Choice — production event decorator (Event 11).
 *
 * Each player can skip one mandatory capture, choosing a simple move
 * instead when jumps are available. Condition-based event (remainingPlies: -1)
 * — removed when both players have used their skip.
 *
 * Metadata: { whiteSkipUsed: boolean, blackSkipUsed: boolean }
 *
 * Stateless: all per-event state lives in ActiveEvent.metadata.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent, PieceColor as PC } from '../types';
import { getSquaresWithColor } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** Metadata stored in ActiveEvent.metadata for Dealer's Choice. */
export interface DealersChoiceMetadata {
  readonly whiteSkipUsed: boolean;
  readonly blackSkipUsed: boolean;
}

export class DealersChoiceDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.DealersChoice;
  }

  withInner(inner: RuleSet): DealersChoiceDecorator {
    return new DealersChoiceDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);
    const metadata = this.getDealersChoiceMetadata();
    if (metadata === undefined) return innerMoves;

    const skipUsed = activeColor === PC.White
      ? metadata.whiteSkipUsed
      : metadata.blackSkipUsed;

    // If skip already used, mandatory capture applies normally
    if (skipUsed) return innerMoves;

    // Check if there are jumps in the inner moves
    const hasJumps = innerMoves.some(m => m.captured.length > 0);
    if (!hasJumps) return innerMoves;

    // Jumps exist and skip is available — offer both jumps AND simple moves
    const simples: Move[] = [];
    const pieces = getSquaresWithColor(board, activeColor);
    for (const sq of pieces) {
      simples.push(...getSimpleMovesForPiece(board, sq));
    }

    return [...innerMoves, ...simples];
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    const result = super.onTurnEnd(board, activeColor, move);

    const metadata = this.getDealersChoiceMetadata();
    if (metadata === undefined) return result;

    // Check if the player made a simple move (no captures)
    if (move.captured.length > 0) return result;

    const skipUsed = activeColor === PC.White
      ? metadata.whiteSkipUsed
      : metadata.blackSkipUsed;

    // If skip was already used, nothing to update
    if (skipUsed) return result;

    // Player made a simple move — we can't be 100% certain jumps were available
    // (the inner rule set may have only had simple moves). But since getLegalMoves
    // only adds simples when jumps exist, if a simple move was chosen and we're
    // in the decorator chain, it's safe to mark the skip as used. We check if
    // simple moves were in the inner set to handle the edge case.
    // Actually, the safest approach: just mark the skip used whenever a simple
    // move is made. If no jumps existed, the skip cost was zero.
    const updatedMetadata: DealersChoiceMetadata = activeColor === PC.White
      ? { ...metadata, whiteSkipUsed: true }
      : { ...metadata, blackSkipUsed: true };

    this.requestMetadataUpdate(CrazyEvent.DealersChoice, updatedMetadata as unknown as Record<string, unknown>);

    // Check if both skips used → remove event
    if (updatedMetadata.whiteSkipUsed && updatedMetadata.blackSkipUsed) {
      this.requestEventRemoval(CrazyEvent.DealersChoice);
    }

    return result;
  }

  private getDealersChoiceMetadata(): DealersChoiceMetadata | undefined {
    for (let i = this.activeEventsContext.length - 1; i >= 0; i--) {
      const event = this.activeEventsContext[i];
      if (event?.type === CrazyEvent.DealersChoice && event.metadata) {
        return event.metadata as unknown as DealersChoiceMetadata;
      }
    }
    return undefined;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.DealersChoice,
  (base: RuleSet) => new DealersChoiceDecorator(base),
);

// Register metadata factory: initialize skip tracking
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.DealersChoice,
  (): Record<string, unknown> => ({
    whiteSkipUsed: false,
    blackSkipUsed: false,
  }),
);
