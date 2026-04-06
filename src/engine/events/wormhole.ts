/**
 * Wormhole — production event decorator (Event 24).
 *
 * Two pairs of linked squares are designated as wormhole endpoints.
 * Any piece that moves onto a wormhole entry square is immediately
 * teleported to the linked exit square (if the exit is empty).
 * Teleportation is bidirectional within each pair.
 *
 * Duration: 4 plies (2 rounds). Metadata stores wormhole pairs.
 */

import type { BoardState, Move, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent } from '../types';
import { BOARD_SIZE, getBoardSquare, setBoardSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** Metadata stored in ActiveEvent.metadata for Wormhole. */
export interface WormholeMetadata {
  readonly wormholes: ReadonlyArray<{ a: number; b: number }>;
}

/**
 * Returns the wormhole exit square for the given landing square,
 * or null if the landing is not on a wormhole.
 */
export function getWormholeExit(
  landingSquare: number,
  metadata: WormholeMetadata,
): number | null {
  for (const pair of metadata.wormholes) {
    if (landingSquare === pair.a) return pair.b;
    if (landingSquare === pair.b) return pair.a;
  }
  return null;
}

export class WormholeDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Wormhole;
  }

  withInner(inner: RuleSet): WormholeDecorator {
    return new WormholeDecorator(inner);
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    let result = super.onTurnEnd(board, activeColor, move);

    const entry = this.getActiveEntry(this.activeEventsContext);
    if (!entry) return result;

    const metadata = entry.metadata as unknown as WormholeMetadata | undefined;
    if (metadata === undefined) return result;

    const landingSquare = move.path[move.path.length - 1];
    if (landingSquare === undefined) return result;

    const exitSquare = getWormholeExit(landingSquare as number, metadata);
    if (exitSquare === null) return result;

    const piece = getBoardSquare(result, landingSquare);
    if (piece === null) return result; // piece already destroyed (e.g., by Landmine)

    const exitPiece = getBoardSquare(result, exitSquare as Square);
    if (exitPiece !== null) return result; // exit blocked

    // Teleport
    result = setBoardSquare(result, exitSquare as Square, piece);
    result = setBoardSquare(result, landingSquare, null);

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Wormhole,
  (base: RuleSet) => new WormholeDecorator(base),
);

// Register metadata factory: randomly select 4 empty squares to form 2 wormhole pairs
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Wormhole,
  (board: BoardState, _activeColor, randomFn) => {
    const emptySquares: number[] = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (board[i] === null || board[i] === undefined) {
        emptySquares.push(i + 1);
      }
    }

    // Fisher-Yates shuffle using provided RNG
    const rng = randomFn ?? Math.random;
    for (let i = emptySquares.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = emptySquares[i];
      emptySquares[i] = emptySquares[j] ?? 0;
      emptySquares[j] = temp ?? 0;
    }

    // Form pairs from first 4 shuffled squares
    const wormholes: Array<{ a: number; b: number }> = [];
    if (emptySquares.length >= 2) {
      wormholes.push({ a: emptySquares[0] ?? 0, b: emptySquares[1] ?? 0 });
    }
    if (emptySquares.length >= 4) {
      wormholes.push({ a: emptySquares[2] ?? 0, b: emptySquares[3] ?? 0 });
    }

    return { wormholes };
  },
);
