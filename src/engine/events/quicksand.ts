/**
 * Quicksand — production event decorator (Event 13).
 *
 * Pieces on edge squares cannot move for 2 rounds (4 plies).
 * Pieces that were already on edge squares when the event triggered
 * are exempt — but lose their exemption if they move off their square.
 *
 * Uses metadata to track exempt squares. Requires the metadata update
 * infrastructure (Task 15.1) for onTurnEnd updates.
 *
 * Stateless: all per-event state lives in ActiveEvent.metadata.
 */

import type { BoardState, Move, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent } from '../types';
import { getSquaresWithColor, squareToGrid } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** Metadata stored in ActiveEvent.metadata for Quicksand. */
export interface QuicksandMetadata {
  readonly exemptSquares: readonly number[];
}

/**
 * Returns true if a square is on the edge of the board.
 * Edge squares have row === 0, row === 7, col === 0, or col === 7.
 *
 * Complete edge squares: 1,2,3,4 (row 0), 5 (col 0), 12 (col 7),
 * 13 (col 0), 20 (col 7), 21 (col 0), 28 (col 7), 29,30,31,32 (row 7)
 */
export function isEdgeSquare(sq: number): boolean {
  const { row, col } = squareToGrid(sq as Square);
  return row === 0 || row === 7 || col === 0 || col === 7;
}

/** All 14 unique edge squares on the board. */
export const EDGE_SQUARES: ReadonlySet<number> = new Set(
  Array.from({ length: 32 }, (_, i) => i + 1).filter(isEdgeSquare),
);

/**
 * Filters out moves originating from non-exempt edge squares.
 * If all jumps are removed, regenerates moves from non-edge and exempt squares.
 *
 * Pure function — no side effects.
 */
export function filterQuicksandMoves(
  board: BoardState,
  moves: Move[],
  activeColor: PieceColor,
  exemptSquares: ReadonlySet<number>,
): Move[] {
  const isStuck = (from: number): boolean =>
    EDGE_SQUARES.has(from) && !exemptSquares.has(from);

  const jumps = moves.filter(m => m.captured.length > 0);

  if (jumps.length === 0) {
    // No jumps — filter simple moves from stuck squares
    return moves.filter(m => !isStuck(m.from as number));
  }

  // Filter jumps: remove those from stuck squares
  const filteredJumps = jumps.filter(m => !isStuck(m.from as number));

  if (filteredJumps.length > 0) {
    return filteredJumps;
  }

  // All jumps were from stuck squares; regenerate simple moves for non-stuck pieces
  const fallbackSimples: Move[] = [];
  const pieces = getSquaresWithColor(board, activeColor);
  for (const sq of pieces) {
    if (!isStuck(sq as number)) {
      fallbackSimples.push(...getSimpleMovesForPiece(board, sq));
    }
  }
  return fallbackSimples;
}

export class QuicksandDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Quicksand;
  }

  withInner(inner: RuleSet): QuicksandDecorator {
    return new QuicksandDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);
    const metadata = this.getQuicksandMetadata();
    const exemptSet = new Set(metadata?.exemptSquares ?? []);
    return filterQuicksandMoves(board, innerMoves, activeColor, exemptSet);
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    const result = super.onTurnEnd(board, activeColor, move);

    const metadata = this.getQuicksandMetadata();
    if (metadata === undefined) return result;

    const fromSq = move.from as number;
    if (metadata.exemptSquares.includes(fromSq)) {
      // Piece moved off its exempt square — remove exemption
      const updatedExempt = metadata.exemptSquares.filter(s => s !== fromSq);
      this.requestMetadataUpdate(CrazyEvent.Quicksand, {
        exemptSquares: updatedExempt,
      });
    }

    return result;
  }

  private getQuicksandMetadata(): QuicksandMetadata | undefined {
    for (let i = this.activeEventsContext.length - 1; i >= 0; i--) {
      const event = this.activeEventsContext[i];
      if (event?.type === CrazyEvent.Quicksand && event.metadata) {
        return event.metadata as unknown as QuicksandMetadata;
      }
    }
    return undefined;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Quicksand,
  (base: RuleSet) => new QuicksandDecorator(base),
);

// Register metadata factory: store occupied edge squares at activation
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Quicksand,
  (board: BoardState): Record<string, unknown> => {
    const exemptSquares: number[] = [];
    for (let i = 0; i < 32; i++) {
      const sq = i + 1;
      if (board[i] != null && isEdgeSquare(sq)) {
        exemptSquares.push(sq);
      }
    }
    return { exemptSquares };
  },
);
