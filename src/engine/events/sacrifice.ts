/**
 * Sacrifice — production event decorator (Event 38).
 *
 * Whenever one of your pieces is captured by the opponent, your most
 * advanced pawn is immediately promoted to a king. Triggers once per
 * captured piece in a multi-jump chain. If no pawns remain, nothing happens.
 *
 * Duration: 4 plies (2 rounds). Stateless: no metadata needed.
 */

import type { BoardState, RuleSet, Square } from '../types';
import { CrazyEvent, PieceColor, PieceType, opponentColor } from '../types';
import { getBoardSquare, getSquaresWithColor, setBoardSquare, squareToGrid } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns the square of the most advanced pawn (not king) for the given color.
 * "Most advanced" = closest to opponent's back row.
 * - White: lowest row number (toward row 0)
 * - Black: highest row number (toward row 7)
 * Tiebreaker: leftmost column (lowest col number).
 *
 * Returns null if no pawns of the given color exist.
 */
export function getMostAdvancedPawnSquare(
  board: BoardState,
  color: PieceColor,
): Square | null {
  let bestSq: Square | null = null;
  let bestRow = -1;
  let bestCol = -1;

  for (const sq of getSquaresWithColor(board, color)) {
    const piece = getBoardSquare(board, sq);
    if (piece === null || piece.type !== PieceType.Pawn) continue; // skip kings

    const grid = squareToGrid(sq);

    let isBetter: boolean;
    if (bestSq === null) {
      isBetter = true;
    } else if (color === PieceColor.White) {
      // White: lower row = more advanced
      isBetter =
        grid.row < bestRow || (grid.row === bestRow && grid.col < bestCol);
    } else {
      // Black: higher row = more advanced
      isBetter =
        grid.row > bestRow || (grid.row === bestRow && grid.col < bestCol);
    }

    if (isBetter) {
      bestSq = sq;
      bestRow = grid.row;
      bestCol = grid.col;
    }
  }

  return bestSq;
}

export class SacrificeDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Sacrifice;
  }

  withInner(inner: RuleSet): SacrificeDecorator {
    return new SacrificeDecorator(inner);
  }

  override onCapture(
    board: BoardState,
    landingSquare: Square,
    captured: Square[],
  ): BoardState {
    let result = super.onCapture(board, landingSquare, captured);

    if (!this.isActive(this.activeEventsContext)) {
      return result;
    }

    // Determine capturing and captured colors
    const capturingPiece = getBoardSquare(result, landingSquare);
    if (capturingPiece === null) return result; // capturing piece gone (e.g., Backfire)

    const capturedColor = opponentColor(capturingPiece.color);

    // Promote one pawn per captured piece
    for (let i = 0; i < captured.length; i++) {
      const pawnSquare = getMostAdvancedPawnSquare(result, capturedColor);
      if (pawnSquare === null) break; // no more pawns to promote

      const pawnPiece = getBoardSquare(result, pawnSquare);
      if (pawnPiece === null) continue; // defensive

      result = setBoardSquare(result, pawnSquare, {
        color: capturedColor,
        type: PieceType.King,
      });
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Sacrifice,
  (base: RuleSet) => new SacrificeDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Sacrifice,
  () => undefined,
);
