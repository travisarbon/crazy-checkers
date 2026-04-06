/**
 * Step-Back — production event decorator (Event 8).
 *
 * Pawns can capture backwards (but not move backwards) for 2 rounds (4 plies).
 * Forward and backward captures can be mixed in a single multi-jump chain.
 * Promotion-stop rule still applies: if a pawn reaches its king row during
 * a chain, the chain terminates (pawn promotes).
 *
 * Stateless: no instance variables for event state. No metadata needed.
 */

import type { BoardState, Move, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent, Direction, PieceType } from '../types';
import { getAdjacentSquare, getBoardSquare, getJumpTarget, getSquaresWithColor, isPromotionSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** All four diagonal directions for backward jump generation. */
const ALL_DIRECTIONS: Direction[] = [
  Direction.ForwardLeft,
  Direction.ForwardRight,
  Direction.BackwardLeft,
  Direction.BackwardRight,
];

/**
 * Generates all possible jump chains for a pawn using all four diagonal
 * directions (forward + backward). Respects the promotion-stop rule.
 *
 * Returns completed chains only (no partial chains).
 */
export function getAllDirectionJumpsForPawn(
  board: BoardState,
  sq: Square,
  pieceColor: PieceColor,
): Move[] {
  const piece = getBoardSquare(board, sq);
  if (piece === null || piece.type !== PieceType.Pawn) return [];

  const completedChains: Move[] = [];

  function explore(
    currentSq: Square,
    pathSoFar: Square[],
    capturedSoFar: Square[],
    capturedSet: Set<number>,
  ): void {
    // Promotion stop: if this pawn just landed on its king row, terminate
    if (
      pathSoFar.length > 0 &&
      isPromotionSquare(currentSq, pieceColor)
    ) {
      completedChains.push({
        from: sq,
        path: [...pathSoFar],
        captured: [...capturedSoFar],
      });
      return;
    }

    let foundContinuation = false;

    for (const direction of ALL_DIRECTIONS) {
      const adjacent = getAdjacentSquare(currentSq, direction);
      if (adjacent === null) continue;

      // Already captured this piece in the chain — skip
      if (capturedSet.has(adjacent as number)) continue;

      const adjacentPiece = getBoardSquare(board, adjacent);
      if (adjacentPiece === null || adjacentPiece.color === pieceColor) continue;

      const landing = getJumpTarget(currentSq, direction);
      if (landing === null) continue;

      // Landing must be empty, or it's the piece's own starting square (vacated)
      const landingContents = getBoardSquare(board, landing);
      if (landingContents !== null && (landing as number) !== (sq as number)) continue;

      foundContinuation = true;
      const newCapturedSet = new Set(capturedSet);
      newCapturedSet.add(adjacent as number);

      explore(landing, [...pathSoFar, landing], [...capturedSoFar, adjacent], newCapturedSet);
    }

    // No continuation found — record this chain if it has at least one jump
    if (!foundContinuation && pathSoFar.length > 0) {
      completedChains.push({
        from: sq,
        path: [...pathSoFar],
        captured: [...capturedSoFar],
      });
    }
  }

  explore(sq, [], [], new Set());
  return completedChains;
}

export class StepBackDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.StepBack;
  }

  withInner(inner: RuleSet): StepBackDecorator {
    return new StepBackDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    // Generate all-direction jumps for all pawns of the active color
    const pieces = getSquaresWithColor(board, activeColor);
    const allDirJumps: Move[] = [];
    for (const sq of pieces) {
      const piece = getBoardSquare(board, sq);
      if (piece !== null && piece.type === PieceType.Pawn) {
        allDirJumps.push(...getAllDirectionJumpsForPawn(board, sq, activeColor));
      }
    }

    // Collect king jumps from inner (pass through unchanged)
    const innerKingJumps = innerMoves.filter(m => {
      if (m.captured.length === 0) return false;
      const piece = getBoardSquare(board, m.from);
      return piece !== null && piece.type === PieceType.King;
    });

    // Merge: all-direction pawn jumps + inner king jumps
    const allJumps = [...allDirJumps, ...innerKingJumps];

    // Deduplicate pawn jumps (forward-only chains appear in both sets)
    const seen = new Set<string>();
    const uniqueJumps: Move[] = [];
    for (const jump of allJumps) {
      const key = `${String(jump.from as number)}:${jump.path.map(s => String(s as number)).join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueJumps.push(jump);
      }
    }

    if (uniqueJumps.length > 0) {
      // Mandatory capture: return only jumps
      return uniqueJumps;
    }

    // No jumps at all — return inner simple moves (forward-only for pawns)
    return innerMoves.filter(m => m.captured.length === 0);
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.StepBack,
  (base: RuleSet) => new StepBackDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.StepBack,
  () => undefined,
);
