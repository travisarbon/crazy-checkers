/**
 * Chain Reaction — production event decorator (Event 21).
 *
 * Condition-based event (remainingPlies: -1). The next time any piece is
 * captured, all pieces of the same color as the captured piece that are
 * diagonally adjacent are also removed. The chain propagates recursively
 * through diagonal adjacency within the captured color.
 *
 * Stateless: no metadata needed. Consumed after one detonation.
 */

import type { BoardState, RuleSet, Square, SquareState } from '../types';
import { CrazyEvent, PieceColor, opponentColor } from '../types';
import { getAllAdjacentSquares, getBoardSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * BFS cascade: starting from seed squares, recursively removes all
 * diagonally adjacent pieces of the target color.
 *
 * Pure function — returns a new board.
 */
export function cascadeCapture(
  board: BoardState,
  seedSquares: readonly Square[],
  targetColor: PieceColor,
): BoardState {
  const newBoard = [...board] as SquareState[];
  const visited = new Set<number>(seedSquares.map(s => s as number));
  const queue: Square[] = [...seedSquares];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const { adjacent } of getAllAdjacentSquares(current)) {
      const adjNum = adjacent as number;
      if (visited.has(adjNum)) continue;
      visited.add(adjNum);
      const piece = newBoard[adjNum - 1];
      if (piece !== null && piece !== undefined && piece.color === targetColor) {
        newBoard[adjNum - 1] = null; // remove cascaded piece
        queue.push(adjacent);
      }
    }
  }

  return newBoard;
}

export class ChainReactionDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.ChainReaction;
  }

  withInner(inner: RuleSet): ChainReactionDecorator {
    return new ChainReactionDecorator(inner);
  }

  override onCapture(board: BoardState, landingSquare: Square, captured: Square[]): BoardState {
    // Delegate to inner first (chain order)
    let result = super.onCapture(board, landingSquare, captured);

    if (!this.isActive(this.activeEventsContext)) {
      return result;
    }

    // Determine the captured color from the landing piece (the capturer)
    const landingPiece = getBoardSquare(result, landingSquare);
    if (landingPiece === null) return result;
    const capturedColor = opponentColor(landingPiece.color);

    // BFS cascade from all captured squares
    result = cascadeCapture(result, captured, capturedColor);

    // Signal that this event should be removed (condition met) — unless
    // permanent (Choice mode), in which case chain reactions fire on every
    // capture for the full game.
    const entry = this.activeEventsContext.find(
      (e) => e.type === CrazyEvent.ChainReaction,
    );
    if (entry?.permanent !== true) {
      this.requestEventRemoval(CrazyEvent.ChainReaction);
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.ChainReaction,
  (base: RuleSet) => new ChainReactionDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.ChainReaction,
  () => undefined,
);
