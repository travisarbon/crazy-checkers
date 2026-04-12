/**
 * Swap Meet — production event decorator (Event 32).
 *
 * Instant event (duration 0). Two randomly selected pairs of opposing
 * pieces swap board positions. Piece types are preserved. Swapped pawns
 * do NOT auto-promote even if they land on their promotion row.
 *
 * Uses seeded PRNG for deterministic replay.
 */

import type { BoardState, Move, RuleSet } from '../types';
import { CrazyEvent, PieceColor } from '../types';
import { getBoardSquare, getSquaresWithColor, setBoardSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';
import { createSeededRng } from './checksMix';

export class SwapMeetDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.SwapMeet;
  }

  withInner(inner: RuleSet): SwapMeetDecorator {
    return new SwapMeetDecorator(inner);
  }

  override onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    let result = super.onTurnStart(board, activeColor);

    const entry = this.getActiveEntry(this.activeEventsContext);
    if (!entry) return result;

    // Permanent events (Choice mode): only fire every 4 turns (8 plies)
    if (entry.permanent === true) {
      const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
      const counter = typeof metadata.plyCounter === 'number' ? metadata.plyCounter : 0;
      if (counter === 0 || counter % 8 !== 0) return result;
    }

    const metadata = entry.metadata as { seed: number } | undefined;
    if (metadata === undefined) return result;

    const rng = createSeededRng(metadata.seed);

    // Collect pieces by color with their squares
    const whiteEntries = getSquaresWithColor(result, PieceColor.White).map(sq => ({
      sq,
      piece: getBoardSquare(result, sq),
    }));
    const blackEntries = getSquaresWithColor(result, PieceColor.Black).map(sq => ({
      sq,
      piece: getBoardSquare(result, sq),
    }));

    const numSwaps = Math.min(2, whiteEntries.length, blackEntries.length);

    for (let i = 0; i < numSwaps; i++) {
      const wIdx = Math.floor(rng() * whiteEntries.length);
      const bIdx = Math.floor(rng() * blackEntries.length);

      const wEntry = whiteEntries[wIdx];
      const bEntry = blackEntries[bIdx];

      if (wEntry === undefined || bEntry === undefined) break;
      if (wEntry.piece === null || bEntry.piece === null) break;

      // Swap positions (preserve piece type and color)
      result = setBoardSquare(result, wEntry.sq, bEntry.piece);
      result = setBoardSquare(result, bEntry.sq, wEntry.piece);

      // Remove from lists to prevent re-selection
      whiteEntries.splice(wIdx, 1);
      blackEntries.splice(bIdx, 1);
    }

    return result;
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    const result = super.onTurnEnd(board, activeColor, move);
    const permanentEntry = this.activeEventsContext.find(
      e => e.type === CrazyEvent.SwapMeet && e.permanent === true,
    );
    if (permanentEntry) {
      const metadata = (permanentEntry.metadata ?? {}) as Record<string, unknown>;
      const counter = typeof metadata.plyCounter === 'number' ? metadata.plyCounter : 0;
      this.requestMetadataUpdate(CrazyEvent.SwapMeet, {
        ...metadata,
        plyCounter: counter + 1,
      } as unknown as Readonly<Record<string, unknown>>);
    }
    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.SwapMeet,
  (base: RuleSet) => new SwapMeetDecorator(base),
);

// Register metadata factory (seeded for determinism)
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.SwapMeet,
  (_board, _activeColor, randomFn) => ({
    seed: Math.floor((randomFn?.() ?? Math.random()) * 0xffffffff),
    plyCounter: 0,
  }),
);
