/**
 * Task 11.3 — useEventOverlays: Comprehensive unit tests.
 *
 * Tests all six indicator computation functions: temporary king detection,
 * hot piece detection, live grenade/opposite day/up in the air active checks,
 * and restricted capture detection for No Touching!.
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useEventOverlays } from './useEventOverlays';
import { buildBoard, W, B, P, K } from '../engine/test-utils';
import { createActiveEvent } from '../engine/events';
import type { ActiveEvent, BoardState, Square } from '../engine/types';
import { CrazyEvent, square } from '../engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hook(
  activeEvents: readonly ActiveEvent[],
  board: BoardState,
  selectedSquare: Square | null = null,
) {
  const { result } = renderHook(() =>
    useEventOverlays(activeEvents, board, selectedSquare),
  );
  return result.current;
}

function kfadEvent(originalKingSquares: number[] = [], triggeredAtPly = 0): ActiveEvent {
  return createActiveEvent(CrazyEvent.KingForADay, W, triggeredAtPly, { originalKingSquares });
}

function hpEvent(hotSquare?: number, triggeredAtPly = 0): ActiveEvent {
  const metadata = hotSquare !== undefined ? { hotSquare } : undefined;
  return createActiveEvent(CrazyEvent.HotPotato, W, triggeredAtPly, metadata);
}

// ===========================================================================
// Temporary King Detection (King for a Day)
// ===========================================================================

describe('useEventOverlays — temporaryKingSquares', () => {
  it('returns empty set when no KingForADay active', () => {
    const board = buildBoard([{ sq: 5, color: W, type: K }]);
    const state = hook([], board);
    expect(state.temporaryKingSquares.size).toBe(0);
  });

  it('all kings are temporary when originalKingSquares is empty', () => {
    const board = buildBoard([
      { sq: 5, color: W, type: K },
      { sq: 10, color: B, type: K },
    ]);
    const state = hook([kfadEvent([])], board);
    expect(state.temporaryKingSquares.has(5)).toBe(true);
    expect(state.temporaryKingSquares.has(10)).toBe(true);
  });

  it('mix of permanent and temporary kings', () => {
    const board = buildBoard([
      { sq: 5, color: W, type: K },
      { sq: 10, color: B, type: K },
      { sq: 20, color: W, type: K },
    ]);
    const state = hook([kfadEvent([5, 10])], board);
    expect(state.temporaryKingSquares.has(5)).toBe(false);
    expect(state.temporaryKingSquares.has(10)).toBe(false);
    expect(state.temporaryKingSquares.has(20)).toBe(true);
  });

  it('original king captured — not in set (piece gone)', () => {
    // sq 5 was original king but is now empty (captured)
    const board = buildBoard([
      { sq: 10, color: B, type: K },
    ]);
    const state = hook([kfadEvent([5, 10])], board);
    expect(state.temporaryKingSquares.has(5)).toBe(false);
    expect(state.temporaryKingSquares.has(10)).toBe(false);
  });

  it('no metadata — all kings treated as temporary (defensive)', () => {
    const board = buildBoard([
      { sq: 5, color: W, type: K },
    ]);
    const event = createActiveEvent(CrazyEvent.KingForADay, W, 0);
    const state = hook([event], board);
    expect(state.temporaryKingSquares.has(5)).toBe(true);
  });

  it('pawns are not included', () => {
    const board = buildBoard([
      { sq: 5, color: W, type: P },
      { sq: 10, color: W, type: K },
    ]);
    const state = hook([kfadEvent([])], board);
    expect(state.temporaryKingSquares.has(5)).toBe(false);
    expect(state.temporaryKingSquares.has(10)).toBe(true);
  });
});

// ===========================================================================
// Hot Piece Detection (Hot Potato)
// ===========================================================================

describe('useEventOverlays — hotPotatoSquares', () => {
  it('returns empty set when no HotPotato active', () => {
    const board = buildBoard([{ sq: 14, color: W, type: P }]);
    const state = hook([], board);
    expect(state.hotPotatoSquares.size).toBe(0);
  });

  it('returns all triggeredBy player squares when HotPotato active', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const state = hook([hpEvent(14)], board);
    // White triggered — all White pieces highlighted
    expect(state.hotPotatoSquares.has(14)).toBe(true);
    expect(state.hotPotatoSquares.has(22)).toBe(true);
    expect(state.hotPotatoSquares.has(3)).toBe(false);
  });

  it('returns empty set when triggeredBy player has no pieces', () => {
    const board = buildBoard([{ sq: 3, color: B, type: P }]); // only Black pieces
    const state = hook([hpEvent(14)], board); // triggered by White
    expect(state.hotPotatoSquares.size).toBe(0);
  });
});

// ===========================================================================
// Simple Active Checks
// ===========================================================================

describe('useEventOverlays — simple active flags', () => {
  const board = buildBoard([{ sq: 14, color: W, type: P }]);

  it('all false when no events', () => {
    const state = hook([], board);
    expect(state.liveGrenadeActive).toBe(false);
    expect(state.oppositeDayActive).toBe(false);
    expect(state.upInTheAirActive).toBe(false);
    expect(state.noTouchingActive).toBe(false);
  });

  it('liveGrenadeActive true when LiveGrenade active', () => {
    const event = createActiveEvent(CrazyEvent.LiveGrenade, W, 0);
    const state = hook([event], board);
    expect(state.liveGrenadeActive).toBe(true);
  });

  it('oppositeDayActive true when OppositeDay active', () => {
    const event = createActiveEvent(CrazyEvent.OppositeDay, W, 0);
    const state = hook([event], board);
    expect(state.oppositeDayActive).toBe(true);
  });

  it('upInTheAirActive true when UpInTheAir active', () => {
    const event = createActiveEvent(CrazyEvent.UpInTheAir, W, 0);
    const state = hook([event], board);
    expect(state.upInTheAirActive).toBe(true);
  });

  it('noTouchingActive true when NoTouching active', () => {
    const event = createActiveEvent(CrazyEvent.NoTouching, W, 0);
    const state = hook([event], board);
    expect(state.noTouchingActive).toBe(true);
  });

  it('multiple events active simultaneously', () => {
    const events = [
      createActiveEvent(CrazyEvent.LiveGrenade, W, 0),
      createActiveEvent(CrazyEvent.OppositeDay, W, 1),
      createActiveEvent(CrazyEvent.UpInTheAir, W, 2),
    ];
    const state = hook(events, board);
    expect(state.liveGrenadeActive).toBe(true);
    expect(state.oppositeDayActive).toBe(true);
    expect(state.upInTheAirActive).toBe(true);
  });
});

// ===========================================================================
// Restricted Capture Detection (No Touching!)
// ===========================================================================

describe('useEventOverlays — restrictedCaptureSquares', () => {
  it('empty when NoTouching not active', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 10, color: B, type: K },
    ]);
    const state = hook([], board, square(14));
    expect(state.restrictedCaptureSquares.size).toBe(0);
  });

  it('empty when no piece selected', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 10, color: B, type: K },
    ]);
    const event = createActiveEvent(CrazyEvent.NoTouching, W, 0);
    const state = hook([event], board, null);
    expect(state.restrictedCaptureSquares.size).toBe(0);
  });

  it('empty when king selected (only pawns restricted)', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 10, color: B, type: K },
    ]);
    const event = createActiveEvent(CrazyEvent.NoTouching, W, 0);
    const state = hook([event], board, square(14));
    expect(state.restrictedCaptureSquares.size).toBe(0);
  });

  it('detects restricted capture — pawn near opponent king', () => {
    // White pawn on sq 14 (row 3, col 2), Black king on sq 10 (row 2, col 2)
    // Jump landing: row 1, col 2 => sq 6 (row 1, col 2)
    // Actually let me verify: sq 14 is row 3, col 2. sq 10 is row 2, col 2.
    // adj = row 2, col 2 = sq 10 (has black king). land = row 1, col 2 = sq 6.
    // But wait, (row+dr, col+dc) for dr=-1, dc=0 is not diagonal.
    // Diagonal moves: dr=-1,dc=-1 => row 2, col 1 = sq 9; dr=-1,dc=+1 => row 2, col 3 = sq 10.
    // sq 10 is row 2, col 3 (since row 2 is even, cols 1,3,5,7).
    // Actually sq 10: index 9, row = floor(9/4) = 2, posInRow = 1, col = 1*2+1 = 3.
    // sq 14: index 13, row = floor(13/4) = 3, posInRow = 1, col = 1*2 = 2.
    // Diagonal from sq 14 (row 3, col 2): up-left = row 2, col 1 → gridToSquare(2,1) = sq 9
    //                                      up-right = row 2, col 3 → gridToSquare(2,3) = sq 10
    // If Black king at sq 10 (row 2, col 3): land = row 1, col 4 → gridToSquare(1,4) = sq 7
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 10, color: B, type: K },
    ]);
    const event = createActiveEvent(CrazyEvent.NoTouching, W, 0);
    const state = hook([event], board, square(14));
    expect(state.restrictedCaptureSquares.has(7)).toBe(true);
  });

  it('empty when pawn near friendly king', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 10, color: W, type: K },
    ]);
    const event = createActiveEvent(CrazyEvent.NoTouching, W, 0);
    const state = hook([event], board, square(14));
    expect(state.restrictedCaptureSquares.size).toBe(0);
  });

  it('empty when landing square is occupied', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 10, color: B, type: K },
      { sq: 7, color: W, type: P }, // landing square blocked
    ]);
    const event = createActiveEvent(CrazyEvent.NoTouching, W, 0);
    const state = hook([event], board, square(14));
    expect(state.restrictedCaptureSquares.has(7)).toBe(false);
  });

  it('multiple restricted captures — pawn flanked by two opponent kings', () => {
    // White pawn at sq 14 (row 3, col 2)
    // Black king at sq 9 (row 2, col 1) → land row 1, col 0 → sq 5
    // Black king at sq 10 (row 2, col 3) → land row 1, col 4 → sq 7
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 9, color: B, type: K },
      { sq: 10, color: B, type: K },
    ]);
    const event = createActiveEvent(CrazyEvent.NoTouching, W, 0);
    const state = hook([event], board, square(14));
    expect(state.restrictedCaptureSquares.has(5)).toBe(true);
    expect(state.restrictedCaptureSquares.has(7)).toBe(true);
  });

  it('adjacent opponent pawn does not trigger restriction', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 10, color: B, type: P }, // pawn, not king
    ]);
    const event = createActiveEvent(CrazyEvent.NoTouching, W, 0);
    const state = hook([event], board, square(14));
    expect(state.restrictedCaptureSquares.size).toBe(0);
  });
});
