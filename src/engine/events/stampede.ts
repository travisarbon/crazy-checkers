/**
 * Stampede — production event decorator (Event 30).
 *
 * Instant event (duration 0). All pawns simultaneously advance one square
 * forward diagonally. White pawns move toward row 0; Black pawns toward
 * row 7. Kings are unaffected. Pawns reaching the promotion row promote.
 * Pawns do NOT capture during the stampede — they only move to empty squares.
 *
 * Processing order: most-advanced pawns first to avoid collisions.
 */

import type { BoardState, Move, RuleSet, Square } from '../types';
import { CrazyEvent, PieceColor, PieceType } from '../types';
import { BOARD_SIZE, getBoardSquare, gridToSquare, isPromotionSquare, setBoardSquare, squareToGrid } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

export class StampedeDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Stampede;
  }

  withInner(inner: RuleSet): StampedeDecorator {
    return new StampedeDecorator(inner);
  }

  override onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    let result = super.onTurnStart(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) {
      return result;
    }

    // Permanent events (Choice mode): only fire every 3 turns (6 plies)
    const permanentEntry = this.activeEventsContext.find(
      e => e.type === CrazyEvent.Stampede && e.permanent === true,
    );
    if (permanentEntry) {
      const metadata = (permanentEntry.metadata ?? {}) as Record<string, unknown>;
      const counter = typeof metadata.plyCounter === 'number' ? metadata.plyCounter : 0;
      if (counter === 0 || counter % 6 !== 0) return result;
    }

    // Collect all pawns
    const pawns: Array<{ sq: Square; color: PieceColor; row: number; col: number }> = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      const piece = result[i];
      if (piece !== null && piece !== undefined && piece.type === PieceType.Pawn) {
        const sq = (i + 1) as Square;
        const { row, col } = squareToGrid(sq);
        pawns.push({ sq, color: piece.color, row, col });
      }
    }

    // Sort by advancement (most advanced first)
    // White advances toward row 0: lower row = more advanced
    // Black advances toward row 7: higher row = more advanced
    pawns.sort((a, b) => {
      const advA = a.color === PieceColor.White ? a.row : 7 - a.row;
      const advB = b.color === PieceColor.White ? b.row : 7 - b.row;
      return advA - advB; // lower = more advanced, process first
    });

    // Process each pawn
    for (const pawn of pawns) {
      // Verify pawn is still at expected square (may have been displaced by earlier pawn)
      const currentPiece = getBoardSquare(result, pawn.sq);
      if (
        currentPiece === null ||
        currentPiece.type !== PieceType.Pawn ||
        currentPiece.color !== pawn.color
      ) {
        continue;
      }

      const forwardRow = pawn.color === PieceColor.White ? pawn.row - 1 : pawn.row + 1;
      if (forwardRow < 0 || forwardRow > 7) continue;

      // Try forward-left, then forward-right
      const destinations = [
        gridToSquare(forwardRow, pawn.col - 1),
        gridToSquare(forwardRow, pawn.col + 1),
      ];

      for (const destSq of destinations) {
        if (destSq === null) continue;
        if (getBoardSquare(result, destSq) !== null) continue; // occupied
        // Move pawn
        result = setBoardSquare(result, pawn.sq, null);
        const type = isPromotionSquare(destSq, pawn.color) ? PieceType.King : PieceType.Pawn;
        result = setBoardSquare(result, destSq, { color: pawn.color, type });
        break;
      }
    }

    return result;
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    const result = super.onTurnEnd(board, activeColor, move);
    const permanentEntry = this.activeEventsContext.find(
      e => e.type === CrazyEvent.Stampede && e.permanent === true,
    );
    if (permanentEntry) {
      const metadata = (permanentEntry.metadata ?? {}) as Record<string, unknown>;
      const counter = typeof metadata.plyCounter === 'number' ? metadata.plyCounter : 0;
      this.requestMetadataUpdate(CrazyEvent.Stampede, {
        ...metadata,
        plyCounter: counter + 1,
      } as unknown as Readonly<Record<string, unknown>>);
    }
    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Stampede,
  (base: RuleSet) => new StampedeDecorator(base),
);

// Register metadata factory (seed for deterministic tie-breaking)
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Stampede,
  (_board, _activeColor, randomFn) => ({
    seed: Math.floor((randomFn?.() ?? Math.random()) * 0xffffffff),
    plyCounter: 0,
  }),
);
