/**
 * Leapfrog — production event decorator (Event 17).
 *
 * Pieces can jump over friendly pieces without capturing them
 * (non-capturing jumps). The friendly piece being jumped is NOT removed.
 * Non-capturing friendly jumps can be chained and mixed with enemy
 * captures in the same turn. Mandatory capture still applies: if an
 * enemy capture is available, at least one capture must be included.
 *
 * Duration: 2 plies (1 round). Stateless: no metadata needed.
 */

import type { BoardState, Move, RuleSet, Square, SquareState } from '../types';
import { CrazyEvent, Direction, PieceColor, PieceType } from '../types';
import {
  getAdjacentSquare,
  getBoardSquare,
  getJumpTarget,
  getSquaresWithColor,
  isPromotionSquare,
} from '../board';
import { getSimpleMovesForPiece } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns the diagonal directions a piece is allowed to move/jump in.
 * Pawns: forward only. Kings: all four.
 */
function getMovementDirections(color: PieceColor, type: PieceType): Direction[] {
  if (type === PieceType.King) {
    return [Direction.ForwardLeft, Direction.ForwardRight, Direction.BackwardLeft, Direction.BackwardRight];
  }
  if (color === PieceColor.White) {
    return [Direction.ForwardLeft, Direction.ForwardRight];
  }
  return [Direction.BackwardLeft, Direction.BackwardRight];
}

/**
 * Generates all possible jump chains for a piece that include both
 * enemy captures (normal) and friendly leapfrogs (non-capturing).
 *
 * Returns completed chains only (chains where no further jumps are possible).
 */
export function getLeapfrogJumpChains(
  board: BoardState,
  sq: Square,
  color: PieceColor,
  type: PieceType,
): Move[] {
  const completedChains: Move[] = [];
  const directions = getMovementDirections(color, type);

  function explore(
    currentSq: Square,
    pathSoFar: Square[],
    capturedSoFar: Square[],
    visitedSet: Set<number>,
    boardState: BoardState,
  ): void {
    // Promotion stop: if this pawn just landed on its king row, terminate
    if (
      type === PieceType.Pawn &&
      pathSoFar.length > 0 &&
      isPromotionSquare(currentSq, color)
    ) {
      completedChains.push({
        from: sq,
        path: [...pathSoFar],
        captured: [...capturedSoFar],
      });
      return;
    }

    let foundContinuation = false;

    for (const dir of directions) {
      const adjacent = getAdjacentSquare(currentSq, dir);
      if (adjacent === null) continue;
      if (visitedSet.has(adjacent as number)) continue; // can't re-jump same piece

      const adjacentPiece = getBoardSquare(boardState, adjacent);
      if (adjacentPiece === null) continue; // empty, no jump

      const landing = getJumpTarget(currentSq, dir);
      if (landing === null) continue;

      // Landing must be empty or the piece's own starting square (vacated)
      const landingContents = getBoardSquare(boardState, landing);
      if (landingContents !== null && (landing as number) !== (sq as number)) continue;

      const newVisited = new Set(visitedSet);
      newVisited.add(adjacent as number);

      if (adjacentPiece.color !== color) {
        // Enemy capture
        const newCaptured = [...capturedSoFar, adjacent];
        // Simulate removal for chain continuation
        const newBoard = [...boardState] as SquareState[];
        newBoard[(adjacent as number) - 1] = null;
        foundContinuation = true;
        explore(landing, [...pathSoFar, landing], newCaptured, newVisited, newBoard);
      } else {
        // Friendly leapfrog (non-capturing) — don't remove the friendly piece
        foundContinuation = true;
        explore(landing, [...pathSoFar, landing], capturedSoFar, newVisited, boardState);
      }
    }

    // Terminal: no continuations found — record if chain has content
    if (!foundContinuation && pathSoFar.length > 0) {
      completedChains.push({
        from: sq,
        path: [...pathSoFar],
        captured: [...capturedSoFar],
      });
    }
  }

  explore(sq, [], [], new Set(), board);
  return completedChains;
}

export class LeapfrogDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Leapfrog;
  }

  withInner(inner: RuleSet): LeapfrogDecorator {
    return new LeapfrogDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) {
      return innerMoves;
    }

    // Generate extended jump chains (enemy captures + friendly leapfrogs)
    const allChains: Move[] = [];
    for (const sq of getSquaresWithColor(board, activeColor)) {
      const piece = getBoardSquare(board, sq);
      if (piece !== null) {
        allChains.push(...getLeapfrogJumpChains(board, sq, activeColor, piece.type));
      }
    }

    // Separate chains with enemy captures from pure leapfrog chains
    const chainsWithCaptures = allChains.filter(m => m.captured.length > 0);
    const pureLeapfrogs = allChains.filter(m => m.captured.length === 0);

    // If any chains include enemy captures, mandatory capture applies
    if (chainsWithCaptures.length > 0) {
      return chainsWithCaptures;
    }

    // No enemy captures available — include both simple moves and pure leapfrogs
    // Get base simple moves (inner already computed these)
    const baseSimples = innerMoves.filter(m => m.captured.length === 0);

    // Deduplicate
    const seen = new Set<string>();
    const result: Move[] = [];
    for (const m of [...baseSimples, ...pureLeapfrogs]) {
      const key = `${String(m.from)}-${m.path.map(String).join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(m);
      }
    }

    // If inner had jumps but leapfrog chains replaced them, ensure we
    // don't lose regular jumps. Check if inner had jumps:
    const innerJumps = innerMoves.filter(m => m.captured.length > 0);
    if (innerJumps.length > 0) {
      // Inner had jumps — mandatory capture. Return inner jumps merged with
      // leapfrog chains that include captures (already handled above).
      // This branch shouldn't be reached since chainsWithCaptures would include them.
      return innerJumps;
    }

    // If all moves were removed, regenerate simple moves
    if (result.length === 0) {
      const fallback: Move[] = [];
      for (const sq of getSquaresWithColor(board, activeColor)) {
        fallback.push(...getSimpleMovesForPiece(board, sq));
      }
      return fallback;
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Leapfrog,
  (base: RuleSet) => new LeapfrogDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Leapfrog,
  () => undefined,
);
