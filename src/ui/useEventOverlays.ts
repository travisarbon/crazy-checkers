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
import { CrazyEvent, PieceColor, PieceType, opponentColor, square } from '../engine/types';
import { getAllAdjacentSquares, getBoardSquare, getSquaresWithColor, squareToGrid, gridToSquare } from '../engine/board';
import type { KingForADayMetadata } from '../engine/events/kingForADay';
import { getGuardedKings } from '../engine/events/bodyguard';
import { getMostAdvancedPieceSquare } from '../engine/events/forcedMarch';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface EventOverlayState {
  /** Squares containing pieces that are temporary kings (King for a Day). */
  readonly temporaryKingSquares: ReadonlySet<number>;

  /** Whether the Live Grenade event is currently active. */
  readonly liveGrenadeActive: boolean;

  /** Squares of pieces that could switch color next (Hot Potato). */
  readonly hotPotatoSquares: ReadonlySet<number>;

  /** Whether Opposite Day is currently active. */
  readonly oppositeDayActive: boolean;

  /** Whether Up in the Air is currently active. */
  readonly upInTheAirActive: boolean;

  /** Whether No Touching! is currently active. */
  readonly noTouchingActive: boolean;

  /** Squares where capture indicators should be dimmed (No Touching!). */
  readonly restrictedCaptureSquares: ReadonlySet<number>;

  // -- Phase 3 Tier 1 overlay state --

  /** Squares of guarded kings (Bodyguard). */
  readonly guardedKingSquares: ReadonlySet<number>;

  /** Whether Quicksand event is active. */
  readonly quicksandActive: boolean;

  /** Whether Frozen Assets event is active. */
  readonly frozenAssetsActive: boolean;

  /** Whether Safe Haven event is active. */
  readonly safeHavenActive: boolean;

  /** Whether Promotion Party event is active. */
  readonly promotionPartyActive: boolean;

  /** Square of the forced piece (Forced March), or null. */
  readonly forcedMarchSquare: number | null;

  /** Whether Royal Decree event is active. */
  readonly royalDecreeActive: boolean;

  /** Lines from kings to pinned pawns (Sentry). */
  readonly sentryPinLines: ReadonlyArray<{ from: number; to: number }>;
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

/**
 * Returns all squares occupied by the triggeredBy player's pieces.
 * Hot Potato affects whichever piece that player moves next, so all
 * of their pieces should show the indicator.
 */
function computeHotPotatoSquares(
  activeEvents: readonly ActiveEvent[],
  board: BoardState,
): ReadonlySet<number> {
  const hotPotatoEvent = activeEvents.find(e => e.type === CrazyEvent.HotPotato);
  if (!hotPotatoEvent) return EMPTY_SET;

  const targetColor = hotPotatoEvent.triggeredBy;
  const squares = getSquaresWithColor(board, targetColor);
  if (squares.length === 0) return EMPTY_SET;
  return new Set(squares.map(s => s as number));
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
  activeColor?: PieceColor,
): EventOverlayState {
  const temporaryKingSquares = useMemo(
    () => computeTemporaryKingSquares(activeEvents, board),
    [activeEvents, board],
  );

  const liveGrenadeActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.LiveGrenade),
    [activeEvents],
  );

  const hotPotatoSquares = useMemo(
    () => computeHotPotatoSquares(activeEvents, board),
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

  // -- Phase 3 Tier 1 overlays --

  const guardedKingSquares = useMemo(() => {
    if (!activeEvents.some(e => e.type === CrazyEvent.Bodyguard)) return EMPTY_SET;
    return getGuardedKings(board);
  }, [activeEvents, board]);

  const quicksandActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.Quicksand),
    [activeEvents],
  );

  const frozenAssetsActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.FrozenAssets),
    [activeEvents],
  );

  const safeHavenActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.SafeHaven),
    [activeEvents],
  );

  const promotionPartyActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.PromotionParty),
    [activeEvents],
  );

  const forcedMarchSquare = useMemo(() => {
    if (!activeEvents.some(e => e.type === CrazyEvent.ForcedMarch)) return null;
    if (activeColor === undefined) return null;
    const sq = getMostAdvancedPieceSquare(board, activeColor);
    return sq !== null ? (sq as number) : null;
  }, [activeEvents, board, activeColor]);

  const royalDecreeActive = useMemo(
    () => activeEvents.some(e => e.type === CrazyEvent.RoyalDecree),
    [activeEvents],
  );

  const sentryPinLines = useMemo(() => {
    if (!activeEvents.some(e => e.type === CrazyEvent.Sentry)) return [];
    if (activeColor === undefined) return [];
    // Compute pin lines: opponent kings → active player's pinned pawns
    const oppColor = opponentColor(activeColor);
    const oppKings = getSquaresWithColor(board, oppColor).filter(sq => {
      const p = getBoardSquare(board, sq);
      return p !== null && p.type === PieceType.King;
    });
    const lines: Array<{ from: number; to: number }> = [];
    for (const kingSq of oppKings) {
      const adjacents = getAllAdjacentSquares(kingSq);
      for (const { adjacent } of adjacents) {
        const p = getBoardSquare(board, adjacent);
        if (p !== null && p.color === activeColor && p.type === PieceType.Pawn) {
          lines.push({ from: kingSq as number, to: adjacent as number });
        }
      }
    }
    return lines;
  }, [activeEvents, board, activeColor]);

  return {
    temporaryKingSquares,
    liveGrenadeActive,
    hotPotatoSquares,
    oppositeDayActive,
    upInTheAirActive,
    noTouchingActive,
    restrictedCaptureSquares,
    guardedKingSquares,
    quicksandActive,
    frozenAssetsActive,
    safeHavenActive,
    promotionPartyActive,
    forcedMarchSquare,
    royalDecreeActive,
    sentryPinLines,
  };
}
