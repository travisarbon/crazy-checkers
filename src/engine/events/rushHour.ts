/**
 * Rush Hour — production event decorator (Event 36).
 *
 * Pawns can move two squares diagonally forward in a single move,
 * provided both the intermediate and destination squares are empty.
 * Non-capturing move only. Kings unaffected. If double-step lands on
 * promotion row, pawn promotes normally via shouldPromote.
 *
 * Duration: 2 plies (1 round).
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent, Direction, PieceColor as PC, PieceType } from '../types';
import { getAdjacentSquare, getBoardSquare, getSquaresWithColor } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns the forward diagonal directions for a given color.
 * White moves toward row 0 (ForwardLeft, ForwardRight).
 * Black moves toward row 7 (BackwardLeft, BackwardRight).
 */
function getForwardDirections(color: PieceColor): Direction[] {
  if (color === PC.White) {
    return [Direction.ForwardLeft, Direction.ForwardRight];
  }
  return [Direction.BackwardLeft, Direction.BackwardRight];
}

/**
 * Generates all double-step (two-square diagonal forward) moves for
 * pawns of the active color. Both intermediate and destination squares
 * must be empty.
 *
 * Pure function — no side effects.
 */
export function getDoubleStepMoves(board: BoardState, activeColor: PieceColor): Move[] {
  const moves: Move[] = [];
  const forwardDirs = getForwardDirections(activeColor);
  const pieces = getSquaresWithColor(board, activeColor);

  for (const sq of pieces) {
    const piece = getBoardSquare(board, sq);
    if (piece === null || piece.type !== PieceType.Pawn) continue;

    for (const dir of forwardDirs) {
      const intermediate = getAdjacentSquare(sq, dir);
      if (intermediate === null) continue;
      if (getBoardSquare(board, intermediate) !== null) continue;

      const destination = getAdjacentSquare(intermediate, dir);
      if (destination === null) continue;
      if (getBoardSquare(board, destination) !== null) continue;

      moves.push({ from: sq, path: [destination], captured: [] });
    }
  }

  return moves;
}

export class RushHourDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.RushHour;
  }

  withInner(inner: RuleSet): RushHourDecorator {
    return new RushHourDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    // If jumps exist, mandatory capture — don't add double-steps
    const hasJumps = innerMoves.some(m => m.captured.length > 0);
    if (hasJumps) return innerMoves;

    // Generate and merge double-step moves
    const doubleSteps = getDoubleStepMoves(board, activeColor);
    return [...innerMoves, ...doubleSteps];
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.RushHour,
  (base: RuleSet) => new RushHourDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.RushHour,
  () => undefined,
);
