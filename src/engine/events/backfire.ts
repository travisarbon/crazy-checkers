/**
 * Backfire — production event decorator (Event 34).
 *
 * Pieces can capture their own pieces (friendly fire). Jumps over friendly
 * pieces remove the jumped friendly piece, just like enemy captures.
 * Mandatory capture applies to ALL available jumps, including friendly ones.
 * Multi-jump chains can mix friendly and enemy captures.
 *
 * Duration: 2 plies (1 round). Stateless: no metadata needed.
 *
 * Overrides `getLegalMoves` to expand jump targets to include friendlies.
 * Standard `applyMove` handles removal correctly (it blindly clears
 * captured squares without checking color).
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
 * Returns the diagonal directions for jump exploration.
 * Kings: all four. Pawns: forward only, unless includeBackward is true
 * (StepBack active).
 */
function getJumpDirections(
  color: PieceColor,
  type: PieceType,
  includeBackward: boolean,
): Direction[] {
  if (type === PieceType.King || includeBackward) {
    return [Direction.ForwardLeft, Direction.ForwardRight, Direction.BackwardLeft, Direction.BackwardRight];
  }
  if (color === PieceColor.White) {
    return [Direction.ForwardLeft, Direction.ForwardRight];
  }
  return [Direction.BackwardLeft, Direction.BackwardRight];
}

/**
 * Generates all possible jump chains for a piece that include both
 * enemy AND friendly pieces as valid jump targets. Jumped pieces are
 * recorded in captured[] regardless of color.
 */
export function getBackfireJumpsForPiece(
  board: BoardState,
  sq: Square,
  color: PieceColor,
  type: PieceType,
  includeBackward: boolean,
): Move[] {
  const completedChains: Move[] = [];
  const directions = getJumpDirections(color, type, includeBackward);

  function explore(
    currentSq: Square,
    pathSoFar: Square[],
    capturedSoFar: Square[],
    capturedSet: Set<number>,
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
      if (capturedSet.has(adjacent as number)) continue;

      const adjacentPiece = getBoardSquare(boardState, adjacent);
      if (adjacentPiece === null) continue; // empty, no jump target

      const landing = getJumpTarget(currentSq, dir);
      if (landing === null) continue;

      // Landing must be empty or the piece's own starting square (vacated)
      const landingContents = getBoardSquare(boardState, landing);
      if (landingContents !== null && (landing as number) !== (sq as number)) continue;

      // Backfire: jump ANY piece (friendly or enemy)
      const newCaptured = [...capturedSoFar, adjacent];
      const newBoard = [...boardState] as SquareState[];
      newBoard[(adjacent as number) - 1] = null; // simulate removal
      const newPath = [...pathSoFar, landing];
      const newCapturedSet = new Set(capturedSet);
      newCapturedSet.add(adjacent as number);

      if (type === PieceType.Pawn && isPromotionSquare(landing, color)) {
        completedChains.push({
          from: sq,
          path: newPath,
          captured: newCaptured,
        });
      } else {
        foundContinuation = true;
        explore(landing, newPath, newCaptured, newCapturedSet, newBoard);
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

export class BackfireDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.Backfire;
  }

  withInner(inner: RuleSet): BackfireDecorator {
    return new BackfireDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) {
      return innerMoves;
    }

    const stepBackActive = this.activeEventsContext.some(
      e => e.type === CrazyEvent.StepBack,
    );

    // Determine which pieces are restricted by other decorators (FrozenAssets,
    // Quicksand, etc.). Only apply this filter when the inner chain is NOT in
    // mandatory-capture mode — otherwise the inner chain only returns pieces
    // with enemy jumps, which is too restrictive for Backfire.
    const innerJumps = innerMoves.filter(m => m.captured.length > 0);
    const innerHasJumps = innerJumps.length > 0;

    let restrictedPieces: Set<number> | null = null;
    if (!innerHasJumps && innerMoves.length > 0) {
      // Inner chain returned only simple moves — pieces NOT in the list
      // are restricted by other decorators
      restrictedPieces = new Set<number>();
      const movablePieces = new Set<number>();
      for (const move of innerMoves) {
        movablePieces.add(move.from as number);
      }
      for (const sq of getSquaresWithColor(board, activeColor)) {
        if (!movablePieces.has(sq as number)) {
          restrictedPieces.add(sq as number);
        }
      }
    }

    // Generate friendly-fire jumps for all pieces of activeColor
    const friendlyJumps: Move[] = [];
    for (const sq of getSquaresWithColor(board, activeColor)) {
      // Skip pieces restricted by other decorators
      if (restrictedPieces !== null && restrictedPieces.has(sq as number)) continue;

      const piece = getBoardSquare(board, sq);
      if (piece === null) continue;

      const jumps = getBackfireJumpsForPiece(
        board,
        sq,
        activeColor,
        piece.type,
        stepBackActive,
      );

      // Keep only jumps that capture at least one friendly piece
      // (pure enemy jumps are already in innerMoves)
      for (const jump of jumps) {
        const hasFriendlyCapture = jump.captured.some(csq => {
          const p = getBoardSquare(board, csq);
          return p !== null && p.color === activeColor;
        });
        if (hasFriendlyCapture) {
          friendlyJumps.push(jump);
        }
      }
    }

    // Merge inner jumps with friendly-fire jumps
    const allJumps = [...innerJumps, ...friendlyJumps];

    if (allJumps.length > 0) {
      return allJumps; // mandatory capture (enemy or friendly)
    }

    // No jumps at all — return inner simple moves
    // If inner had no moves from eligible pieces, fall back to simple move generation
    const innerSimples = innerMoves.filter(m => m.captured.length === 0);
    if (innerSimples.length > 0) return innerSimples;

    // Fallback: regenerate simple moves
    const fallback: Move[] = [];
    for (const sq of getSquaresWithColor(board, activeColor)) {
      fallback.push(...getSimpleMovesForPiece(board, sq));
    }
    return fallback;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.Backfire,
  (base: RuleSet) => new BackfireDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.Backfire,
  () => undefined,
);
