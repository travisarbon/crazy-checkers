/**
 * Flipped Script — production event decorator (Event 9).
 *
 * Permanently swaps each player's promotion row. White promotes on row 7
 * (own back row) instead of row 0; Black promotes on row 0 instead of row 7.
 * Movement directions are unchanged. Pawns already on their new promotion
 * row when the event triggers are instantly promoted.
 *
 * Duration: -1 (permanent with `applied` guard). Overrides `shouldPromote`.
 */

import type { BoardState, Piece, RuleSet, Square, SquareState } from '../types';
import { CrazyEvent, PieceColor, PieceType, square as mkSquare } from '../types';
import { BOARD_SIZE, setBoardSquare, squareToGrid } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** Metadata stored in ActiveEvent.metadata for Flipped Script. */
export interface FlippedScriptMetadata {
  readonly applied: boolean;
}

export class FlippedScriptDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.FlippedScript;
  }

  withInner(inner: RuleSet): FlippedScriptDecorator {
    return new FlippedScriptDecorator(inner);
  }

  override shouldPromote(piece: Piece, sq: Square): boolean {
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.shouldPromote(piece, sq);
    }
    // Flipped: White promotes on row 7, Black promotes on row 0
    if (piece.type === PieceType.King) return false;
    const { row } = squareToGrid(sq);
    if (piece.color === PieceColor.White) return row === 7;
    return row === 0; // Black
  }

  override onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    let result = super.onTurnStart(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) return result;

    const entry = this.getActiveEntry(this.activeEventsContext);
    if (!entry) return result;

    const metadata = entry.metadata as unknown as FlippedScriptMetadata | undefined;
    if (metadata?.applied) return result; // Already applied, no-op

    // First activation: promote all pawns on their new promotion rows
    for (let i = 0; i < BOARD_SIZE; i++) {
      const piece = (result as SquareState[])[i];
      if (piece == null || piece.type !== PieceType.Pawn) continue;
      const { row } = squareToGrid(mkSquare(i + 1));
      if (
        (piece.color === PieceColor.White && row === 7) ||
        (piece.color === PieceColor.Black && row === 0)
      ) {
        result = setBoardSquare(result, mkSquare(i + 1), {
          color: piece.color,
          type: PieceType.King,
        });
      }
    }

    // Mark as applied
    this.requestMetadataUpdate(CrazyEvent.FlippedScript, { applied: true });
    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.FlippedScript,
  (base: RuleSet) => new FlippedScriptDecorator(base),
);

// Register metadata factory: initial state (not yet applied)
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.FlippedScript,
  () => ({ applied: false }),
);
