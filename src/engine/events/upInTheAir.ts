/**
 * Up in the Air — production event decorator.
 *
 * Grants all pieces flying movement for one full round (2 plies).
 * During Up in the Air:
 * - Pawns can move any number of squares diagonally forward.
 * - Kings can move any number of squares diagonally in all four directions.
 * - Captures follow flying rules: jump over an opponent and land on any empty beyond.
 * - Multi-jumps use flying logic at each hop.
 * - Mandatory capture still applies.
 *
 * Stateless: no metadata required. The decorator reads its presence from
 * activeEventsContext via isActive().
 *
 * Cross-decorator awareness: when Up in the Air replaces move generation,
 * it checks for No Touching and applies the pawn-captures-king filter if needed.
 */

import type { BoardState, Move, PieceColor, RuleSet } from '../types';
import { CrazyEvent } from '../types';
import { getSquaresWithColor } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';
import { getFlyingLegalMoves, getFlyingJumps, getFlyingSimpleMoves } from '../flyingMoves';
import { filterPawnCapturesKing } from './noTouching';

// ---------------------------------------------------------------------------
// Decorator
// ---------------------------------------------------------------------------

export class UpInTheAirDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.UpInTheAir;
  }

  withInner(inner: RuleSet): UpInTheAirDecorator {
    return new UpInTheAirDecorator(inner);
  }

  /**
   * Replaces standard move generation with flying move generation
   * when Up in the Air is active.
   *
   * Cross-decorator awareness: if No Touching is also active,
   * the pawn-captures-king filter is applied to the flying moves.
   * This is necessary because Up in the Air bypasses the inner chain's
   * getLegalMoves entirely, which would skip No Touching's filter.
   */
  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    // If not active, delegate to inner chain
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.getLegalMoves(board, activeColor);
    }

    const noTouchingActive = this.activeEventsContext.some(
      (e) => e.type === CrazyEvent.NoTouching,
    );

    if (!noTouchingActive) {
      return getFlyingLegalMoves(board, activeColor);
    }

    // With No Touching active: generate flying moves, filter, then handle fallback
    const pieces = getSquaresWithColor(board, activeColor);
    const allJumps: Move[] = [];
    for (const sq of pieces) {
      allJumps.push(...getFlyingJumps(board, sq));
    }

    if (allJumps.length > 0) {
      const filteredJumps = filterPawnCapturesKing(board, allJumps, activeColor);
      if (filteredJumps.length > 0) {
        return filteredJumps; // Mandatory capture (after filtering)
      }
      // All jumps were pawn-captures-king — fall through to simple moves
    }

    // Simple flying moves (no filtering needed — simple moves are non-capturing)
    const allSimple: Move[] = [];
    for (const sq of pieces) {
      allSimple.push(...getFlyingSimpleMoves(board, sq));
    }
    return allSimple;
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.UpInTheAir,
  (base: RuleSet) => new UpInTheAirDecorator(base),
);

// No metadata needed — register undefined-returning factory for consistency
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.UpInTheAir,
  () => undefined,
);
