/**
 * useEventOverlays — Hook computing persistent visual indicator state
 * from active events and board state.
 *
 * Task 11.3: Returns a data-only object consumed by Board.tsx (for piece
 * rendering modifications) and EventOverlays.tsx (for SVG overlay rendering).
 *
 * Re-derives on every render when activeEvents, board, or selectedSquare
 * changes. All computations are O(n) in board size (32 squares) and are
 * memoized to avoid unnecessary re-computation.
 */

import { useMemo } from 'react';
import type { ActiveEvent, BoardState, Square } from '../engine/types';
import { CrazyEvent, PieceType, square } from '../engine/types';
import { getBoardSquare, squareToGrid, gridToSquare } from '../engine/board';
import type { KingForADayMetadata } from '../engine/events/kingForADay';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface EventOverlayState {
  /** Squares containing pieces that are temporary kings (King for a Day). */
  readonly temporaryKingSquares: ReadonlySet<number>;

  /** Whether the Live Grenade event is currently active. */
  readonly liveGrenadeActive: boolean;

  /** The square containing the "hot" piece (Hot Potato), or null. */
  readonly hotPieceSquare: Square | null;

  /** Whether Opposite Day is currently active. */
  readonly oppositeDayActive: boolean;

  /** Whether Up in the Air is currently active. */
  readonly upInTheAirActive: boolean;

  /** Whether No Touching! is currently active. */
  readonly noTouchingActive: boolean;

  /** Squares where capture indicators should be dimmed (No Touching!). */
  readonly restrictedCaptureSquares: ReadonlySet<number>;
}

// ---------------------------------------------------------------------------
// Shared empty set (stable reference for memoization)
// ---------------------------------------------------------------------------

const EMPTY_SET: ReadonlySet<number> = new Set<number>();

// ---------------------------------------------------------------------------
// Computation functions
// ---------------------------------------------------------------------------

function computeTemporaryKingSquares(
  activeEvents: readonly ActiveEvent[],
  board: BoardState,
): ReadonlySet<number> {
  const kfadEvent = activeEvents.find(e => e.type === CrazyEvent.KingForADay);
  if (!kfadEvent) return EMPTY_SET;

  const metadata = kfadEvent.metadata as unknown as KingForADayMetadata | undefined;
  const originalKings = new Set(metadata?.originalKingSquares ?? []);
  const tempKings = new Set<number>();

  for (let sq = 1; sq <= 32; sq++) {
    const piece = getBoardSquare(board, square(sq));
    if (piece && piece.type === PieceType.King && !originalKings.has(sq)) {
      tempKings.add(sq);
    }
  }

  return tempKings.size > 0 ? tempKings : EMPTY_SET;
}

function computeHotPieceSquare(
  activeEvents: readonly ActiveEvent[],
  board: BoardState,
): Square | null {
  const hotPotatoEvent = activeEvents.find(e => e.type === CrazyEvent.HotPotato);
  if (!hotPotatoEvent) return null;

  const metadata = hotPotatoEvent.metadata as unknown as { hotSquare?: number } | undefined;
  const hotSquare = metadata?.hotSquare;
  if (hotSquare === undefined) return null;

  // Verify piece still exists on that square
  const piece = getBoardSquare(board, square(hotSquare));
  return piece ? square(hotSquare) : null;
}

function computeRestrictedCaptureSquares(
  activeEvents: readonly ActiveEvent[],
  board: BoardState,
  selectedSquare: Square | null,
): ReadonlySet<number> {
  if (selectedSquare === null) return EMPTY_SET;

  const noTouchingEvent = activeEvents.find(e => e.type === CrazyEvent.NoTouching);
  if (!noTouchingEvent) return EMPTY_SET;

  // Only pawns are restricted from capturing kings
  const selectedPiece = getBoardSquare(board, selectedSquare);
  if (!selectedPiece || selectedPiece.type !== PieceType.Pawn) return EMPTY_SET;

  const restricted = new Set<number>();
  const { row, col } = squareToGrid(selectedSquare);

  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    const adjRow = row + dr;
    const adjCol = col + dc;
    if (adjRow < 0 || adjRow >= 8 || adjCol < 0 || adjCol >= 8) continue;

    const adjSquare = gridToSquare(adjRow, adjCol);
    if (adjSquare === null) continue;

    const adjPiece = getBoardSquare(board, adjSquare);
    if (!adjPiece) continue;
    if (adjPiece.color === selectedPiece.color) continue;
    if (adjPiece.type !== PieceType.King) continue;

    // Opponent king adjacent — check landing square
    const landRow = adjRow + dr;
    const landCol = adjCol + dc;
    if (landRow < 0 || landRow >= 8 || landCol < 0 || landCol >= 8) continue;

    const landSquare = gridToSquare(landRow, landCol);
    if (landSquare === null) continue;

    // Landing square must be empty for the capture to be theoretically possible
    if (getBoardSquare(board, landSquare) !== null) continue;

    restricted.add(landSquare as number);
  }

  return restricted.size > 0 ? restricted : EMPTY_SET;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEventOverlays(
  activeEvents: readonly ActiveEvent[],
  board: BoardState,
  selectedSquare: Square | null,
): EventOverlayState {
  const temporaryKingSquares = useMemo(
    () => computeTemporaryKingSquares(activeEvents, board),
    [activeEvents, board],
  );

  const liveGrenadeActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.LiveGrenade),
    [activeEvents],
  );

  const hotPieceSquare = useMemo(
    () => computeHotPieceSquare(activeEvents, board),
    [activeEvents, board],
  );

  const oppositeDayActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.OppositeDay),
    [activeEvents],
  );

  const upInTheAirActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.UpInTheAir),
    [activeEvents],
  );

  const noTouchingActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.NoTouching),
    [activeEvents],
  );

  const restrictedCaptureSquares = useMemo(
    () => computeRestrictedCaptureSquares(activeEvents, board, selectedSquare),
    [activeEvents, board, selectedSquare],
  );

  return {
    temporaryKingSquares,
    liveGrenadeActive,
    hotPieceSquare,
    oppositeDayActive,
    upInTheAirActive,
    noTouchingActive,
    restrictedCaptureSquares,
  };
}
