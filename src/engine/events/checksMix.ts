/**
 * Checks Mix — production event decorator.
 *
 * Randomly redistributes every piece on the board to new valid dark squares.
 * Piece colors and types (pawn/king) are preserved. Two constraints:
 * 1. No pawns on their own promotion row.
 * 2. No mandatory captures for the active player after shuffle.
 *
 * Instant event (remainingPlies: 0) — fires once on onTurnStart, then removed.
 *
 * Stateless: all per-event state lives in ActiveEvent.metadata, not instance fields.
 */

import type { BoardState, Move, PieceColor, RuleSet, SquareState } from '../types';
import { CrazyEvent, PieceType, square } from '../types';
import { BOARD_SIZE, isPromotionSquare } from '../board';
import { getLegalMoves } from '../moves';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

// ---------------------------------------------------------------------------
// Metadata type
// ---------------------------------------------------------------------------

export interface ChecksMixMetadata {
  readonly seed: number;
  readonly placement: Readonly<Record<number, { color: PieceColor; type: PieceType }>>;
}

// ---------------------------------------------------------------------------
// Seeded PRNG — Mulberry32
// ---------------------------------------------------------------------------

/**
 * Mulberry32: a simple, fast 32-bit seeded PRNG.
 * Returns a function that produces the next random number in [0, 1) on each call.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed | 0;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Shuffle algorithm internals
// ---------------------------------------------------------------------------

const MAX_SHUFFLE_RETRIES = 100;

/**
 * Generates a random placement of pieces across all 32 squares.
 * Uses a Fisher-Yates shuffle on the square indices.
 */
function generateCandidate(
  pieces: ReadonlyArray<{ color: PieceColor; type: PieceType }>,
  rng: () => number,
): Map<number, { color: PieceColor; type: PieceType }> {
  // Create array of all 32 square indices (1-based)
  const squares = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);

  // Fisher-Yates shuffle
  for (let i = squares.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const si = squares[i] as number;
    const sj = squares[j] as number;
    squares[i] = sj;
    squares[j] = si;
  }

  // Assign pieces to the first N shuffled squares
  const placement = new Map<number, { color: PieceColor; type: PieceType }>();
  for (let i = 0; i < pieces.length; i++) {
    const sq = squares[i] as number;
    const piece = pieces[i] as { color: PieceColor; type: PieceType };
    placement.set(sq, piece);
  }

  return placement;
}

/**
 * Checks if any pawn is on its own promotion row.
 */
function satisfiesPromotionConstraint(
  placement: Map<number, { color: PieceColor; type: PieceType }>,
): boolean {
  for (const [sq, piece] of placement) {
    if (piece.type === PieceType.Pawn && isPromotionSquare(square(sq), piece.color)) {
      return false;
    }
  }
  return true;
}

/**
 * Repairs promotion-row violations by swapping offending pawns
 * with pieces on non-promotion squares or empty squares.
 */
function repairPromotionViolations(
  placement: Map<number, { color: PieceColor; type: PieceType }>,
  rng: () => number,
): void {
  const violators: number[] = [];
  const safeOccupied: number[] = [];

  for (const [sq, piece] of placement) {
    if (piece.type === PieceType.Pawn && isPromotionSquare(square(sq), piece.color)) {
      violators.push(sq);
    } else {
      safeOccupied.push(sq);
    }
  }

  // Empty squares are also valid swap targets
  const emptySquares: number[] = [];
  for (let sq = 1; sq <= BOARD_SIZE; sq++) {
    if (!placement.has(sq)) {
      emptySquares.push(sq);
    }
  }

  const swapTargets = [...safeOccupied, ...emptySquares];

  for (const violatorSq of violators) {
    const violatorPiece = placement.get(violatorSq);
    if (violatorPiece === undefined) continue;

    // Try random swap targets until we find one that doesn't create a new violation
    for (let attempt = 0; attempt < swapTargets.length; attempt++) {
      const idx = Math.floor(rng() * swapTargets.length);
      const targetSq = swapTargets[idx] as number;
      const targetPiece = placement.get(targetSq) ?? null;

      // Check that moving the violator to targetSq doesn't violate promotion constraint
      const violatorSafe = !isPromotionSquare(square(targetSq), violatorPiece.color);
      // Check that moving targetPiece (if any) to violatorSq doesn't violate promotion constraint
      const targetSafe =
        targetPiece === null ||
        targetPiece.type === PieceType.King ||
        !isPromotionSquare(square(violatorSq), targetPiece.color);

      if (violatorSafe && targetSafe) {
        // Perform swap
        placement.delete(violatorSq);
        if (targetPiece !== null) {
          placement.delete(targetSq);
          placement.set(violatorSq, targetPiece);
        }
        placement.set(targetSq, violatorPiece);
        break;
      }
    }
  }
}

/**
 * Converts a placement map to a BoardState array.
 */
export function buildBoardFromPlacement(
  placement: Map<number, { color: PieceColor; type: PieceType }>,
): BoardState {
  const board: SquareState[] = new Array<SquareState>(BOARD_SIZE).fill(null);
  for (const [sq, piece] of placement) {
    board[sq - 1] = { color: piece.color, type: piece.type };
  }
  return board;
}

/**
 * Shuffles all pieces on the board to random dark squares.
 *
 * @param board - The current board state (32-element array).
 * @param activeColor - The color whose turn is next (for no-capture validation).
 * @param seed - Deterministic PRNG seed.
 * @param getLegalMovesFn - Function to check for mandatory captures.
 * @returns The shuffled board state satisfying all constraints, or best-effort after retries.
 */
export function shuffleBoard(
  board: BoardState,
  activeColor: PieceColor,
  seed: number,
  getLegalMovesFn: (board: BoardState, color: PieceColor) => Move[],
): BoardState {
  const rng = createSeededRng(seed);

  // Collect all pieces
  const pieces: Array<{ color: PieceColor; type: PieceType }> = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const piece = board[i];
    if (piece !== null && piece !== undefined) {
      pieces.push({ color: piece.color, type: piece.type });
    }
  }

  if (pieces.length === 0) return board;

  let bestBoard: BoardState = board;
  let bestCaptureCount = Infinity;

  for (let attempt = 0; attempt < MAX_SHUFFLE_RETRIES; attempt++) {
    const candidate = generateCandidate(pieces, rng);

    // Constraint 1: No pawns on own promotion row — try to repair
    if (!satisfiesPromotionConstraint(candidate)) {
      repairPromotionViolations(candidate, rng);
      if (!satisfiesPromotionConstraint(candidate)) continue;
    }

    // Constraint 2: No mandatory captures for the active player
    const candidateBoard = buildBoardFromPlacement(candidate);
    const moves = getLegalMovesFn(candidateBoard, activeColor);
    const jumpCount = moves.filter((m) => m.captured.length > 0).length;

    if (jumpCount === 0) {
      return candidateBoard;
    }

    // Track best-effort for fallback
    if (jumpCount < bestCaptureCount) {
      bestCaptureCount = jumpCount;
      bestBoard = candidateBoard;
    }
  }

  // Fallback: relax no-capture constraint, return best-effort
  return bestBoard;
}

// ---------------------------------------------------------------------------
// Decorator
// ---------------------------------------------------------------------------

export class ChecksMixDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.ChecksMix;
  }

  withInner(inner: RuleSet): ChecksMixDecorator {
    return new ChecksMixDecorator(inner);
  }

  /**
   * Applies all active Checks Mix shuffles to the board.
   * Shared by onTurnStart and getLegalMoves to ensure consistency.
   */
  private applyShuffles(board: BoardState, activeColor: PieceColor): BoardState {
    const checksMixEntries = this.activeEventsContext.filter(
      (e) => e.type === CrazyEvent.ChecksMix,
    );
    if (checksMixEntries.length === 0) return board;

    let result = board;
    for (const entry of checksMixEntries) {
      const metadata = entry.metadata as unknown as ChecksMixMetadata | undefined;
      if (metadata === undefined) continue;

      if (Object.keys(metadata.placement).length > 0) {
        result = buildBoardFromPlacement(
          new Map(
            Object.entries(metadata.placement).map(
              ([sq, piece]) => [Number(sq), piece] as const,
            ),
          ),
        );
      } else {
        result = shuffleBoard(result, activeColor, metadata.seed, (b, c) =>
          this.inner.getLegalMoves(b, c),
        );
      }
    }
    return result;
  }

  override onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    const result = super.onTurnStart(board, activeColor);
    return this.applyShuffles(result, activeColor);
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.ChecksMix,
  (base: RuleSet) => new ChecksMixDecorator(base),
);

EVENT_METADATA_FACTORIES.set(
  CrazyEvent.ChecksMix,
  (board: BoardState, activeColor: PieceColor): Record<string, unknown> => {
    const seed = Math.floor(Math.random() * 0xffffffff);

    // Pre-compute the placement for deterministic replay
    const shuffledBoard = shuffleBoard(board, activeColor, seed, (b, c) => getLegalMoves(b, c));

    const placement: Record<number, { color: PieceColor; type: PieceType }> = {};
    for (let i = 0; i < shuffledBoard.length; i++) {
      const piece = shuffledBoard[i];
      if (piece !== null && piece !== undefined) {
        placement[i + 1] = { color: piece.color, type: piece.type };
      }
    }

    return { seed, placement };
  },
);
