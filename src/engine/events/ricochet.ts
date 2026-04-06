/**
 * Ricochet — production event decorator (Event 28).
 *
 * After a piece completes a capture, it bounces one additional square
 * in the same diagonal direction. The bounce is automatic. If the bounce
 * square is occupied or off the board, no bounce occurs. The bounce does
 * NOT trigger additional captures.
 *
 * Duration: 2 plies (1 round). Stateless: no metadata needed.
 * Overrides `applyMove` for post-capture positional adjustment.
 */

import type { BoardState, Move, RuleSet, Square } from '../types';
import { CrazyEvent, PieceType } from '../types';
import { getBoardSquare, gridToSquare, isPromotionSquare, setBoardSquare, squareToGrid } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Computes the bounce-landing square given a move path.
 * The bounce continues in the direction of the last leg of the path.
 * Returns null if the bounce is off-board or not on a playable square.
 */
export function computeBounceSquare(from: Square, path: readonly Square[]): Square | null {
  // Need at least 1 position in path; use from + last path entry to derive direction
  if (path.length === 0) return null;

  // Determine the last leg: penultimate → final
  const finalSq = path[path.length - 1];
  if (finalSq === undefined) return null;

  // Penultimate is the second-to-last in path, or `from` if path has only 1 entry
  const penultimateSq = path.length >= 2 ? path[path.length - 2] : from;
  if (penultimateSq === undefined) return null;

  const pGrid = squareToGrid(penultimateSq);
  const fGrid = squareToGrid(finalSq);

  const dRow = Math.sign(fGrid.row - pGrid.row);
  const dCol = Math.sign(fGrid.col - pGrid.col);

  if (dRow === 0 && dCol === 0) return null;

  const bounceRow = fGrid.row + dRow;
  const bounceCol = fGrid.col + dCol;

  return gridToSquare(bounceRow, bounceCol);
}

export class RicochetDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Ricochet;
  }

  withInner(inner: RuleSet): RicochetDecorator {
    return new RicochetDecorator(inner);
  }

  override applyMove(board: BoardState, move: Move): BoardState {
    let result = this.inner.applyMove(board, move);

    if (!this.isActive(this.activeEventsContext)) {
      return result;
    }

    // Only bounce on captures
    if (move.captured.length === 0) return result;

    const landingSquare = move.path[move.path.length - 1];
    if (landingSquare === undefined) return result;

    const bounceSquare = computeBounceSquare(move.from, move.path);
    if (bounceSquare === null) return result;

    // Bounce square must be empty
    if (getBoardSquare(result, bounceSquare) !== null) return result;

    const piece = getBoardSquare(result, landingSquare);
    if (piece === null) return result; // defensive

    // Move piece to bounce position
    result = setBoardSquare(result, bounceSquare, piece);
    result = setBoardSquare(result, landingSquare, null);

    // Check promotion at bounce destination
    if (piece.type === PieceType.Pawn && isPromotionSquare(bounceSquare, piece.color)) {
      result = setBoardSquare(result, bounceSquare, {
        color: piece.color,
        type: PieceType.King,
      });
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Ricochet,
  (base: RuleSet) => new RicochetDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Ricochet,
  () => undefined,
);
