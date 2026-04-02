/**
 * Phase 2 Rule Interface Stress Test — prototype event decorators.
 *
 * STRESS TEST ONLY — not shipped. Validates that the RuleSet interface
 * supports Phase 2 event decorators without modifying game.ts or moves.ts.
 *
 * Two prototype events:
 * - King for a Day: all pawns temporarily become kings for 1 round
 * - Live Grenade: next capture destroys all pieces adjacent to landing square
 */

import type {
  BoardState,
  GameResult,
  Move,
  Piece,
  PieceColor,
  RuleSet,
  Square,
  SquareState,
} from './types';
import { PieceType, square } from './types';
import { getAllAdjacentSquares, isPromotionSquare } from './board';

// ---------------------------------------------------------------------------
// Abstract base decorator
// ---------------------------------------------------------------------------

/**
 * Abstract base decorator for event-based RuleSet wrappers.
 *
 * Delegates all RuleSet methods to the inner rule set.
 * Subclasses override specific optional hooks to inject event behavior.
 *
 * STRESS TEST ONLY — validates that the RuleSet interface supports
 * Phase 2 event decorators without modifying game.ts or moves.ts.
 */
export abstract class EventRuleSetDecorator implements RuleSet {
  protected readonly inner: RuleSet;
  constructor(inner: RuleSet) {
    this.inner = inner;
  }

  getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    return this.inner.getLegalMoves(board, activeColor);
  }

  applyMove(board: BoardState, move: Move): BoardState {
    return this.inner.applyMove(board, move);
  }

  checkGameOver(board: BoardState, activeColor: PieceColor): GameResult | null {
    return this.inner.checkGameOver(board, activeColor);
  }

  shouldPromote(piece: Piece, sq: Square): boolean {
    return this.inner.shouldPromote(piece, sq);
  }

  // Optional hooks: always delegate to inner so hooks propagate through
  // the decorator chain. Subclasses override to inject event behavior.
  onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    return this.inner.onTurnStart ? this.inner.onTurnStart(board, activeColor) : board;
  }

  onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    return this.inner.onTurnEnd ? this.inner.onTurnEnd(board, activeColor, move) : board;
  }

  onCapture(board: BoardState, landingSquare: Square, captured: Square[]): BoardState {
    return this.inner.onCapture
      ? this.inner.onCapture(board, landingSquare, captured)
      : board;
  }

  onCheckGameOver(
    board: BoardState,
    activeColor: PieceColor,
    baseResult: GameResult | null,
  ): GameResult | null {
    return this.inner.onCheckGameOver
      ? this.inner.onCheckGameOver(board, activeColor, baseResult)
      : baseResult;
  }
}

// ---------------------------------------------------------------------------
// King for a Day
// ---------------------------------------------------------------------------

/**
 * King for a Day — all pawns temporarily become kings for 1 round.
 *
 * Hooks used:
 * - getLegalMoves (override): transforms board before move generation so
 *   validation in makeMove sees king-style moves for all pieces
 * - onTurnStart: upgrades all pawns to kings before applyMove
 * - onTurnEnd: reverts temporary kings back to pawns (unless legitimately promoted)
 *
 * STRESS TEST ONLY — validates that onTurnStart/onTurnEnd can
 * non-destructively transform board state for the duration of a turn.
 */
export class KingForADayDecorator extends EventRuleSetDecorator {
  private turnsRemaining = 0;
  /** Set of board indices (0-based) that were already kings before transformation. */
  private originalKingIndices = new Set<number>();

  /** Activate the event for 1 round (2 half-turns). */
  activate(): void {
    this.turnsRemaining = 2;
  }

  get isActive(): boolean {
    return this.turnsRemaining > 0;
  }

  /** Upgrades all pawns to kings on a board copy, returns the transformed board. */
  private upgradeAllPawnsToKings(board: BoardState): BoardState {
    const newBoard = [...board] as SquareState[];
    for (let i = 0; i < newBoard.length; i++) {
      const piece = newBoard[i];
      if (piece != null && piece.type === PieceType.Pawn) {
        newBoard[i] = { color: piece.color, type: PieceType.King };
      }
    }
    return newBoard;
  }

  /** Records which squares already have kings (so we don't revert them). */
  private recordOriginalKings(board: BoardState): void {
    this.originalKingIndices.clear();
    for (let i = 0; i < board.length; i++) {
      const piece = board[i];
      if (piece != null && piece.type === PieceType.King) {
        this.originalKingIndices.add(i);
      }
    }
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    if (!this.isActive) {
      return this.inner.getLegalMoves(board, activeColor);
    }
    // Apply the same transformation so move validation in makeMove
    // sees king-style moves (including backward moves for pawns).
    const transformedBoard = this.upgradeAllPawnsToKings(board);
    return this.inner.getLegalMoves(transformedBoard, activeColor);
  }

  override onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    // Chain to inner hooks via base class delegation
    const result = super.onTurnStart(board, activeColor);

    if (!this.isActive) return result;

    // Record original king positions before transformation
    this.recordOriginalKings(result);

    return this.upgradeAllPawnsToKings(result);
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    // Chain to inner hooks via base class delegation
    const result = super.onTurnEnd(board, activeColor, move);

    if (this.turnsRemaining <= 0) return result;

    // Revert temporary kings back to pawns.
    // A king should stay a king if:
    // 1. It was already a king before the transformation (original king), OR
    // 2. It legitimately promoted by reaching its promotion row during the move.
    const newBoard = [...result] as SquareState[];
    const fromIndex = (move.from as number) - 1;
    const finalSquare = move.path[move.path.length - 1];
    const landingIndex = finalSquare !== undefined ? (finalSquare as number) - 1 : -1;
    const movingPieceWasOriginalKing = this.originalKingIndices.has(fromIndex);

    for (let i = 0; i < newBoard.length; i++) {
      const piece = newBoard[i];
      if (piece == null || piece.type !== PieceType.King) continue;

      if (i === landingIndex) {
        // This is the piece that just moved
        if (movingPieceWasOriginalKing) continue;
        if (isPromotionSquare(square(i + 1), piece.color)) continue;
        newBoard[i] = { color: piece.color, type: PieceType.Pawn };
      } else {
        // Stationary piece
        if (this.originalKingIndices.has(i)) continue;
        newBoard[i] = { color: piece.color, type: PieceType.Pawn };
      }
    }

    this.originalKingIndices.clear();
    this.turnsRemaining--;

    return newBoard;
  }
}

// ---------------------------------------------------------------------------
// Live Grenade
// ---------------------------------------------------------------------------

/**
 * Live Grenade — the next capture causes an explosion that destroys
 * all pieces adjacent to the landing square.
 *
 * Hooks used:
 * - onCapture: when armed, removes all pieces (friendly and enemy)
 *   on squares diagonally adjacent to the landing square
 *
 * STRESS TEST ONLY — validates that onCapture can apply side effects
 * (additional piece removal) triggered by capture events.
 */
export class LiveGrenadeDecorator extends EventRuleSetDecorator {
  private armed = false;

  /** Arm the grenade. It will detonate on the next capture. */
  arm(): void {
    this.armed = true;
  }

  get isArmed(): boolean {
    return this.armed;
  }

  override onCapture(board: BoardState, landingSquare: Square, captured: Square[]): BoardState {
    // Chain to inner hooks via base class delegation
    const result = super.onCapture(board, landingSquare, captured);

    if (!this.armed) return result;

    // BOOM: destroy all pieces adjacent to the landing square
    const newBoard = [...result] as SquareState[];
    const neighbors = getAllAdjacentSquares(landingSquare);

    for (const { adjacent } of neighbors) {
      const index = (adjacent as number) - 1;
      newBoard[index] = null;
    }

    this.armed = false;
    return newBoard;
  }
}
