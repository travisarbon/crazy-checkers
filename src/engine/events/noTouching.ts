/**
 * No Touching! — production event decorator.
 *
 * Pawns cannot capture kings for 1 round (2 plies).
 * Kings capture normally. If all jumps are pawn-captures-king,
 * simple moves are regenerated as a fallback.
 *
 * Stateless: no instance variables for event state.
 * No metadata needed — the rule is a pure function of the board and moves.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent, PieceType } from '../types';
import { getBoardSquare, getSquaresWithColor } from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Filters out jump moves where the capturing piece is a pawn and
 * any captured piece is a king. Returns the filtered move list.
 *
 * If filtering removes ALL jumps, regenerates simple moves for
 * the active color as a fallback (since mandatory capture no longer
 * applies when no legal jumps remain).
 *
 * Pure function — no side effects.
 *
 * @param board - The current board state (unmodified — captured pieces are still present).
 * @param moves - The complete legal moves list from the inner rule set.
 * @param activeColor - The color of the player whose moves are being generated.
 * @returns Filtered legal moves with pawn-captures-king jumps removed.
 */
export function filterPawnCapturesKing(
  board: BoardState,
  moves: Move[],
  activeColor: PieceColor,
): Move[] {
  // Separate jumps from simple moves
  const jumps = moves.filter(m => m.captured.length > 0);

  // If no jumps, no filtering needed — return as-is
  if (jumps.length === 0) {
    return moves;
  }

  // Filter jumps: remove any where the capturing piece is a pawn
  // and any captured piece is a king
  const filteredJumps = jumps.filter(move => {
    const capturingPiece = getBoardSquare(board, move.from);
    if (capturingPiece === null) return true; // defensive; shouldn't happen

    // Kings can capture anything — keep the move
    if (capturingPiece.type === PieceType.King) return true;

    // Capturing piece is a pawn — check all captured pieces
    for (const capturedSq of move.captured) {
      const capturedPiece = getBoardSquare(board, capturedSq);
      if (capturedPiece !== null && capturedPiece.type === PieceType.King) {
        return false; // Pawn capturing a king — prohibited
      }
    }

    return true; // Pawn capturing only other pawns — allowed
  });

  if (filteredJumps.length > 0) {
    // Some jumps survived — mandatory capture still holds
    return filteredJumps;
  }

  // All jumps were pawn-captures-king; regenerate simple moves
  // (The inner rule set suppressed simple moves due to mandatory capture,
  // but those jumps are now prohibited, so simple moves become available.)
  const fallbackSimples: Move[] = [];
  const pieces = getSquaresWithColor(board, activeColor);
  for (const sq of pieces) {
    fallbackSimples.push(...getSimpleMovesForPiece(board, sq));
  }
  return fallbackSimples;
}

export class NoTouchingDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.NoTouching;
  }

  withInner(inner: RuleSet): NoTouchingDecorator {
    return new NoTouchingDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    // Get the full move list from the inner rule set (may include pawn-captures-king)
    const innerMoves = this.inner.getLegalMoves(board, activeColor);
    // Apply the No Touching filter
    return filterPawnCapturesKing(board, innerMoves, activeColor);
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.NoTouching,
  (base: RuleSet) => new NoTouchingDecorator(base),
);

// No metadata needed — register undefined-returning factory for consistency
// (pattern established in Task 9.2; see Task_9.2_Opposite_Day_Implementation_Plan.md §2.1)
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.NoTouching,
  () => undefined,
);
