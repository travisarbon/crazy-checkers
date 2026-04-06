/**
 * Landmine — production event decorator (Event 16).
 *
 * The four center squares (14, 15, 18, 19) are mined. Any piece that
 * moves onto a mined square is destroyed (removed from the board).
 * Pieces already on center squares when the event triggers are
 * grandfathered and safe until they move off their square.
 *
 * Duration: 4 plies (2 rounds). Uses metadata for safe-piece tracking.
 */

import type { BoardState, Move, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent } from '../types';
import { getBoardSquare, setBoardSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** The four center squares that are mined. */
export const LANDMINE_SQUARES: ReadonlySet<number> = new Set([14, 15, 18, 19]);

/** Metadata stored in ActiveEvent.metadata for Landmine. */
export interface LandmineMetadata {
  readonly safePieces: ReadonlyArray<{ square: number; color: string; type: string }>;
}

export class LandmineDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Landmine;
  }

  withInner(inner: RuleSet): LandmineDecorator {
    return new LandmineDecorator(inner);
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    let result = super.onTurnEnd(board, activeColor, move);

    const entry = this.getActiveEntry(this.activeEventsContext);
    if (!entry) return result;

    const metadata = entry.metadata as unknown as LandmineMetadata | undefined;
    if (metadata === undefined) return result;

    const originSquare = move.from as number;
    const landingSquare = move.path[move.path.length - 1] as number;

    // Remove origin from safe list if it was a safe piece that moved
    const updatedSafePieces = metadata.safePieces.filter(sp => sp.square !== originSquare);

    // Check if landing square is mined
    if (LANDMINE_SQUARES.has(landingSquare)) {
      // Check if this piece is safe (still in safe list at landing position)
      const isSafe = updatedSafePieces.some(sp => sp.square === landingSquare);
      if (!isSafe) {
        result = setBoardSquare(result, landingSquare as Square, null); // BOOM
      }
    }

    // Update metadata if safe list changed
    if (updatedSafePieces.length !== metadata.safePieces.length) {
      this.requestMetadataUpdate(CrazyEvent.Landmine, {
        safePieces: updatedSafePieces,
      });
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Landmine,
  (base: RuleSet) => new LandmineDecorator(base),
);

// Register metadata factory: record pieces on center squares at activation
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Landmine,
  (board: BoardState): Record<string, unknown> => {
    const safePieces: Array<{ square: number; color: string; type: string }> = [];
    for (const sq of LANDMINE_SQUARES) {
      const piece = getBoardSquare(board, sq as Square);
      if (piece !== null) {
        safePieces.push({ square: sq, color: piece.color, type: piece.type });
      }
    }
    return { safePieces };
  },
);
