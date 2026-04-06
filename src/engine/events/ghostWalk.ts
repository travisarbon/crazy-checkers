/**
 * Ghost Walk — production event decorator (Event 15).
 *
 * Pieces can pass through (but not land on) occupied friendly squares
 * during simple moves. A piece phases through a friendly blocker to
 * reach an empty square beyond it on the same diagonal. Jumping still
 * requires an enemy piece and an empty landing square.
 *
 * Duration: 2 plies (1 round). Stateless: no metadata needed.
 */

import type { BoardState, Move, RuleSet, Square } from '../types';
import { CrazyEvent, Direction, PieceColor, PieceType } from '../types';
import { getAdjacentSquare, getBoardSquare, getSquaresWithColor } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/**
 * Returns the diagonal directions a piece is allowed to move in.
 * Pawns: forward only (White→ForwardLeft/Right, Black→BackwardLeft/Right).
 * Kings: all four directions.
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
 * Generates ghost walk simple moves for a single piece.
 * The piece phases through friendly pieces to land on the first empty
 * square beyond along the same diagonal. Kings can phase through
 * multiple consecutive friendlies.
 */
export function getGhostWalkMoves(
  board: BoardState,
  sq: Square,
  color: PieceColor,
  pieceType: PieceType,
): Move[] {
  const directions = getMovementDirections(color, pieceType);
  const moves: Move[] = [];

  for (const dir of directions) {
    const adjacent = getAdjacentSquare(sq, dir);
    if (adjacent === null) continue;
    const adjacentPiece = getBoardSquare(board, adjacent);
    if (adjacentPiece === null) continue; // empty = normal move (already in base)
    if (adjacentPiece.color !== color) continue; // enemy = no phasing

    // Friendly piece — try to phase through. Max 7 squares on an 8×8 board.
    let current = adjacent;
    for (let depth = 0; depth < 7; depth++) {
      const beyond = getAdjacentSquare(current, dir);
      if (beyond === null) break; // board edge
      const beyondPiece = getBoardSquare(board, beyond);
      if (beyondPiece === null) {
        // Valid ghost walk landing
        moves.push({ from: sq, path: [beyond], captured: [] });
        break;
      }
      if (beyondPiece.color === color && pieceType === PieceType.King) {
        // Another friendly — kings can continue scanning
        current = beyond;
        continue;
      }
      // Enemy or pawn can't continue
      break;
    }
  }

  return moves;
}

export class GhostWalkDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.GhostWalk;
  }

  withInner(inner: RuleSet): GhostWalkDecorator {
    return new GhostWalkDecorator(inner);
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    const innerMoves = this.inner.getLegalMoves(board, activeColor);

    if (!this.isActive(this.activeEventsContext)) {
      return innerMoves;
    }

    // If any jumps exist, mandatory capture applies — ghost walk suppressed
    const jumps = innerMoves.filter(m => m.captured.length > 0);
    if (jumps.length > 0) return innerMoves;

    // Generate ghost walk moves for all pieces of activeColor
    const ghostMoves: Move[] = [];
    for (const sq of getSquaresWithColor(board, activeColor)) {
      const piece = getBoardSquare(board, sq);
      if (piece !== null) {
        ghostMoves.push(...getGhostWalkMoves(board, sq, activeColor, piece.type));
      }
    }

    // Merge with existing simple moves, deduplicating by from+path
    const seen = new Set<string>();
    const allMoves: Move[] = [];
    for (const m of [...innerMoves, ...ghostMoves]) {
      const key = `${String(m.from)}-${m.path.map(String).join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        allMoves.push(m);
      }
    }

    return allMoves;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.GhostWalk,
  (base: RuleSet) => new GhostWalkDecorator(base),
);

// No metadata needed
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.GhostWalk,
  () => undefined,
);
