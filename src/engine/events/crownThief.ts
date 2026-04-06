/**
 * Crown Thief — production event decorator (Event 29).
 *
 * When a pawn captures a king, the capturing pawn is immediately promoted
 * to a king, regardless of its board position. Only pawn-captures-king
 * triggers this; other capture combinations are unaffected.
 *
 * Duration: 4 plies (2 rounds). Stateless: no metadata needed.
 * Overrides `applyMove` to snapshot pre-capture piece types.
 */

import type { BoardState, Move, RuleSet } from '../types';
import { CrazyEvent, PieceType } from '../types';
import { getBoardSquare, setBoardSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

export class CrownThiefDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.CrownThief;
  }

  withInner(inner: RuleSet): CrownThiefDecorator {
    return new CrownThiefDecorator(inner);
  }

  override applyMove(board: BoardState, move: Move): BoardState {
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.applyMove(board, move);
    }

    // Snapshot before inner applyMove: was the moving piece a pawn?
    const movingPiece = getBoardSquare(board, move.from);
    const isPawnCapturing = movingPiece !== null && movingPiece.type === PieceType.Pawn;

    // Check if any captured piece is a king
    let capturedKing = false;
    if (isPawnCapturing) {
      for (const sq of move.captured) {
        const piece = getBoardSquare(board, sq);
        if (piece !== null && piece.type === PieceType.King) {
          capturedKing = true;
          break;
        }
      }
    }

    let result = this.inner.applyMove(board, move);

    // Crown Thief: promote pawn that captured a king
    if (isPawnCapturing && capturedKing) {
      const landingSquare = move.path[move.path.length - 1];
      if (landingSquare !== undefined) {
        const landingPiece = getBoardSquare(result, landingSquare);
        if (landingPiece !== null && landingPiece.type === PieceType.Pawn) {
          result = setBoardSquare(result, landingSquare, {
            color: landingPiece.color,
            type: PieceType.King,
          });
        }
      }
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.CrownThief,
  (base: RuleSet) => new CrownThiefDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.CrownThief,
  () => undefined,
);
