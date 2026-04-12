/**
 * Haunted — production event decorator (Event 37).
 *
 * Condition-based event. The next 3 captured pieces become "ghosts" —
 * immovable obstacles on the squares where they were captured. Ghosts
 * block movement for both players and expire after 6 plies each.
 * The event expires when all 3 ghosts have been created AND all have expired.
 *
 * Ghosts are tracked in metadata, not in BoardState.
 *
 * Implementation note: Ghost creation (onCapture) and timer tick (onTurnEnd)
 * are coordinated via a transient field `_pendingGhosts` to avoid a metadata
 * race condition. Only onTurnEnd issues the metadata update, merging any
 * ghosts created during onCapture.
 */

import type { BoardState, Move, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent } from '../types';
import { getSquaresWithColor } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** Metadata stored in ActiveEvent.metadata for Haunted. */
export interface HauntedMetadata {
  readonly ghosts: ReadonlyArray<{
    readonly square: number;
    readonly remainingPlies: number;
  }>;
  readonly ghostCount: number;
}

export class HauntedDecorator extends EventDecorator {
  /**
   * Transient field: ghosts created during onCapture this turn.
   * Merged into the single metadata update in onTurnEnd.
   */
  private _pendingGhosts: Array<{ square: number; remainingPlies: number }> = [];

  getEventType(): CrazyEvent {
    return CrazyEvent.Haunted;
  }

  withInner(inner: RuleSet): HauntedDecorator {
    return new HauntedDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) return innerMoves;

    const metadata = this.getHauntedMetadata();
    if (!metadata || metadata.ghosts.length === 0) return innerMoves;

    const ghostSet = new Set(metadata.ghosts.map(g => g.square));

    const filtered = innerMoves.filter(move => {
      // No landing square in the path can be a ghost
      for (const sq of move.path) {
        if (ghostSet.has(sq as number)) return false;
      }
      return true;
    });

    // If all jumps were filtered out by ghosts but simple moves exist,
    // return the simple moves. If mandatory capture suppressed them in the
    // inner chain, regenerate them for non-ghost-blocked pieces.
    if (filtered.length === 0 && innerMoves.length > 0) {
      const fallbackSimples: Move[] = [];
      for (const sq of getSquaresWithColor(board, activeColor)) {
        const simples = getSimpleMovesForPiece(board, sq);
        for (const m of simples) {
          const dest = m.path[0];
          if (dest !== undefined && !ghostSet.has(dest as number)) {
            fallbackSimples.push(m);
          }
        }
      }
      return fallbackSimples;
    }

    return filtered;
  }

  override onCapture(
    board: BoardState,
    landingSquare: Square,
    captured: Square[],
  ): BoardState {
    const result = super.onCapture(board, landingSquare, captured);

    if (!this.isActive(this.activeEventsContext)) return result;

    const metadata = this.getHauntedMetadata();
    if (!metadata) return result;

    // Permanent events (Choice mode) keep spawning ghosts indefinitely.
    const isPermanent = this.isEventPermanent();

    if (!isPermanent) {
      const currentCount = metadata.ghostCount + this._pendingGhosts.length;
      if (currentCount >= 3) return result; // no more ghosts
    }

    for (const capSq of captured) {
      if (!isPermanent && metadata.ghostCount + this._pendingGhosts.length >= 3) break;
      this._pendingGhosts.push({ square: capSq as number, remainingPlies: 6 });
    }

    // Don't issue requestMetadataUpdate here — onTurnEnd will merge and issue one update.
    return result;
  }

  override onTurnEnd(
    board: BoardState,
    activeColor: PieceColor,
    move: Move,
  ): BoardState {
    const result = super.onTurnEnd(board, activeColor, move);

    if (!this.isActive(this.activeEventsContext)) {
      this._pendingGhosts = [];
      return result;
    }

    const metadata = this.getHauntedMetadata();
    if (!metadata) {
      this._pendingGhosts = [];
      return result;
    }

    // Merge existing ghosts with any new ghosts from onCapture
    const mergedGhosts = [...metadata.ghosts, ...this._pendingGhosts];
    const mergedCount = metadata.ghostCount + this._pendingGhosts.length;

    // Clear transient state
    this._pendingGhosts = [];

    // Decrement ghost timers and remove expired ghosts
    const updatedGhosts = mergedGhosts
      .map(g => ({ ...g, remainingPlies: g.remainingPlies - 1 }))
      .filter(g => g.remainingPlies > 0);

    this.requestMetadataUpdate(CrazyEvent.Haunted, {
      ghosts: updatedGhosts,
      ghostCount: mergedCount,
    });

    // Remove event when all ghosts expired and cap reached, unless permanent
    // (Choice mode). Permanent events must persist indefinitely so ghosts keep
    // spawning on every capture for the full game.
    const isPermanent = this.isEventPermanent();
    if (!isPermanent && updatedGhosts.length === 0 && mergedCount >= 3) {
      this.requestEventRemoval(CrazyEvent.Haunted);
    }

    return result;
  }

  private isEventPermanent(): boolean {
    const entry = this.activeEventsContext.find(
      (e) => e.type === CrazyEvent.Haunted,
    );
    return entry?.permanent === true;
  }

  private getHauntedMetadata(): HauntedMetadata | undefined {
    for (let i = this.activeEventsContext.length - 1; i >= 0; i--) {
      const event = this.activeEventsContext[i];
      if (event?.type === CrazyEvent.Haunted && event.metadata) {
        return event.metadata as unknown as HauntedMetadata;
      }
    }
    return undefined;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Haunted,
  (base: RuleSet) => new HauntedDecorator(base),
);

// Register metadata factory
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Haunted,
  () => ({ ghosts: [], ghostCount: 0 }),
);
