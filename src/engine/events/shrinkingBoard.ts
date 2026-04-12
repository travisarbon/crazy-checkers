/**
 * Shrinking Board — production event decorator (Event 39).
 *
 * Permanent event. Upon activation, the outermost ring of the board is
 * removed. Every 10 plies (5 rounds), the next ring inward is removed.
 * Pieces on removed squares get one full turn cycle to escape before
 * elimination.
 *
 * Promotion rows dynamically shift inward as rings are removed — the
 * outermost playable rows become the new promotion rows.
 *
 * When no legal moves exist after filtering, the game is forced to a draw.
 *
 * Duration: -1 (permanent). Metadata tracks removed squares and shrink schedule.
 */

import type { BoardState, GameResult, Move, Piece, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent, GameEndReason, GameResultType, PieceColor as PC, PieceType } from '../types';
import { BOARD_SIZE, getBoardSquare, getSquaresWithColor, setBoardSquare, squareToGrid } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** Metadata stored in ActiveEvent.metadata for Shrinking Board. */
export interface ShrinkingBoardMetadata {
  readonly removedSquares: readonly number[];
  readonly pliesSinceActivation: number;
  readonly nextRingLevel: number; // 0–4 (4 = all rings removed)
  readonly lastShrinkPly: number;
}

/**
 * Returns all dark squares (1–32) that belong to the given ring level.
 * Ring 0 = outermost border, Ring 3 = innermost 2×2 center.
 */
export function getSquaresInRing(ring: number): number[] {
  const squares: number[] = [];
  for (let sq = 1; sq <= BOARD_SIZE; sq++) {
    const { row, col } = squareToGrid(sq as Square);
    if (Math.min(row, 7 - row, col, 7 - col) === ring) {
      squares.push(sq);
    }
  }
  return squares;
}

/** Precomputed ring definitions for all 4 rings. */
export const RING_SQUARES: ReadonlyArray<ReadonlyArray<number>> = [0, 1, 2, 3].map(
  getSquaresInRing,
);

/**
 * Computes the dynamic promotion rows based on which rings have been removed.
 * White promotes on the lowest playable row, Black on the highest.
 */
function getPromotionRows(removedSquares: ReadonlySet<number>): { whitePromoRow: number; blackPromoRow: number } {
  // Find the min and max rows that still have playable dark squares
  let minRow = 7;
  let maxRow = 0;
  for (let sq = 1; sq <= BOARD_SIZE; sq++) {
    if (removedSquares.has(sq)) continue;
    const { row } = squareToGrid(sq as Square);
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
  }
  // White advances toward row 0, promotes on the lowest playable row
  // Black advances toward row 7, promotes on the highest playable row
  return { whitePromoRow: minRow, blackPromoRow: maxRow };
}

export class ShrinkingBoardDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.ShrinkingBoard;
  }

  withInner(inner: RuleSet): ShrinkingBoardDecorator {
    return new ShrinkingBoardDecorator(inner);
  }

  override onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    let result = super.onTurnStart(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) return result;

    const metadata = this.getShrinkingBoardMetadata();
    if (!metadata) return result;

    // Eliminate pieces on removed squares (if enough plies have passed since last shrink)
    if (metadata.pliesSinceActivation > metadata.lastShrinkPly + 1) {
      const removedSet = new Set(metadata.removedSquares);
      for (let sq = 1; sq <= BOARD_SIZE; sq++) {
        if (removedSet.has(sq)) {
          const piece = getBoardSquare(result, sq as Square);
          if (piece !== null) {
            result = setBoardSquare(result, sq as Square, null);
          }
        }
      }
    }

    return result;
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) return innerMoves;

    const metadata = this.getShrinkingBoardMetadata();
    if (!metadata || metadata.removedSquares.length === 0) return innerMoves;

    const removedSet = new Set(metadata.removedSquares);

    const filtered = innerMoves.filter(move => {
      // No landing in path can be on a removed square
      for (const sq of move.path) {
        if (removedSet.has(sq as number)) return false;
      }
      return true;
    });

    // If all jumps were filtered out by removed squares but simple moves
    // to valid squares exist, regenerate them (mandatory capture in the
    // inner chain may have suppressed them).
    if (filtered.length === 0 && innerMoves.length > 0) {
      const fallbackSimples: Move[] = [];
      for (const sq of getSquaresWithColor(board, activeColor)) {
        // Pieces on removed squares CAN still move off
        const simples = getSimpleMovesForPiece(board, sq);
        for (const m of simples) {
          const dest = m.path[0];
          if (dest !== undefined && !removedSet.has(dest as number)) {
            fallbackSimples.push(m);
          }
        }
      }
      return fallbackSimples;
    }

    return filtered;
  }

  override shouldPromote(piece: Piece, sq: Square): boolean {
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.shouldPromote(piece, sq);
    }

    if (piece.type === PieceType.King) return false;

    const metadata = this.getShrinkingBoardMetadata();
    if (!metadata || metadata.removedSquares.length === 0) {
      return this.inner.shouldPromote(piece, sq);
    }

    const removedSet = new Set(metadata.removedSquares);
    const { whitePromoRow, blackPromoRow } = getPromotionRows(removedSet);
    const { row } = squareToGrid(sq);

    if (piece.color === PC.White) return row === whitePromoRow;
    return row === blackPromoRow;
  }

  override checkGameOver(board: BoardState, activeColor: PieceColor): GameResult | null {
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.checkGameOver(board, activeColor);
    }

    // Check if either side has no pieces on playable squares
    const metadata = this.getShrinkingBoardMetadata();
    const removedSet = new Set(metadata?.removedSquares ?? []);

    const whitePieces = getSquaresWithColor(board, PC.White).filter(sq => !removedSet.has(sq as number));
    const blackPieces = getSquaresWithColor(board, PC.Black).filter(sq => !removedSet.has(sq as number));

    if (whitePieces.length === 0 && blackPieces.length === 0) {
      return { type: GameResultType.Draw, reason: GameEndReason.NoLegalMoves };
    }

    if (whitePieces.length === 0) {
      return { type: GameResultType.BlackWin, reason: GameEndReason.NoPiecesLeft };
    }

    if (blackPieces.length === 0) {
      return { type: GameResultType.WhiteWin, reason: GameEndReason.NoPiecesLeft };
    }

    // Check if the active player has no legal moves (using our filtered getLegalMoves)
    const legalMoves = this.getLegalMoves(board, activeColor);
    if (legalMoves.length === 0) {
      // Force a draw instead of a loss — the board shrank away their options
      return { type: GameResultType.Draw, reason: GameEndReason.NoLegalMoves };
    }

    return null;
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    const result = super.onTurnEnd(board, activeColor, move);

    if (!this.isActive(this.activeEventsContext)) return result;

    const metadata = this.getShrinkingBoardMetadata();
    if (!metadata) return result;

    const newPly = metadata.pliesSinceActivation + 1;
    let newRemoved = [...metadata.removedSquares];
    let newRingLevel = metadata.nextRingLevel;
    let newLastShrinkPly = metadata.lastShrinkPly;

    // Shrink every 10 plies (5 rounds)
    if (newRingLevel <= 3 && newPly >= newRingLevel * 10) {
      const ring = RING_SQUARES[newRingLevel];
      if (ring) newRemoved = [...newRemoved, ...ring];
      newLastShrinkPly = newPly;
      newRingLevel++;
    }

    this.requestMetadataUpdate(CrazyEvent.ShrinkingBoard, {
      removedSquares: newRemoved,
      pliesSinceActivation: newPly,
      nextRingLevel: newRingLevel,
      lastShrinkPly: newLastShrinkPly,
    });

    return result;
  }

  private getShrinkingBoardMetadata(): ShrinkingBoardMetadata | undefined {
    for (let i = this.activeEventsContext.length - 1; i >= 0; i--) {
      const event = this.activeEventsContext[i];
      if (event?.type === CrazyEvent.ShrinkingBoard && event.metadata) {
        return event.metadata as unknown as ShrinkingBoardMetadata;
      }
    }
    return undefined;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.ShrinkingBoard,
  (base: RuleSet) => new ShrinkingBoardDecorator(base),
);

// Register metadata factory: Ring 0 removed at activation
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.ShrinkingBoard,
  () => ({
    removedSquares: RING_SQUARES[0] ?? [],
    pliesSinceActivation: 0,
    nextRingLevel: 1, // Ring 0 already removed
    lastShrinkPly: 0,
  }),
);
