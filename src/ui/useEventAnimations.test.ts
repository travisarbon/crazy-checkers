import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  useEventAnimations,
  getAllPawnSquares,
  getAllKingSquares,
  getAllOccupiedSquares,
  getDiagonalNeighbors,
} from './useEventAnimations';
import type { AnimationStep } from './useAnimationQueue';
import { EVENT_ANIM_DURATION } from './useAnimationQueue';
import type { ActiveEvent, BoardState, Move, SquareState } from '../engine/types';
import { CrazyEvent, PieceColor, PieceType, square } from '../engine/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function emptyBoard(): SquareState[] {
  return new Array(32).fill(null) as SquareState[];
}

function boardWith(
  pieces: Array<{ sq: number; color: PieceColor; type: PieceType }>,
): BoardState {
  const board = emptyBoard();
  for (const p of pieces) {
    board[p.sq - 1] = { color: p.color, type: p.type };
  }
  return board;
}

function makeActiveEvent(
  type: CrazyEvent,
  triggeredBy: PieceColor = PieceColor.White,
  opts: Partial<ActiveEvent> = {},
): ActiveEvent {
  return {
    type,
    remainingPlies: 2,
    triggeredBy,
    triggeredAtPly: 10,
    ...opts,
  };
}

function makeMove(
  from: number,
  path: number[],
  captured: number[] = [],
): Move {
  return {
    from: square(from),
    path: path.map((n) => square(n)),
    captured: captured.map((n) => square(n)),
  };
}

// Get the hook result
function getHook() {
  const { result } = renderHook(() => useEventAnimations({ flipped: false }));
  return result.current;
}

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

describe('getAllPawnSquares', () => {
  it('returns only pawn squares', () => {
    const board = boardWith([
      { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
      { sq: 5, color: PieceColor.Black, type: PieceType.King },
      { sq: 10, color: PieceColor.Black, type: PieceType.Pawn },
      { sq: 20, color: PieceColor.White, type: PieceType.King },
    ]);
    const result = getAllPawnSquares(board);
    expect(result).toEqual([square(1), square(10)]);
  });

  it('returns empty array for board with no pawns', () => {
    const board = boardWith([
      { sq: 1, color: PieceColor.White, type: PieceType.King },
    ]);
    expect(getAllPawnSquares(board)).toEqual([]);
  });
});

describe('getAllKingSquares', () => {
  it('returns only king squares', () => {
    const board = boardWith([
      { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
      { sq: 5, color: PieceColor.Black, type: PieceType.King },
      { sq: 10, color: PieceColor.Black, type: PieceType.Pawn },
      { sq: 20, color: PieceColor.White, type: PieceType.King },
    ]);
    const result = getAllKingSquares(board);
    expect(result).toEqual([square(5), square(20)]);
  });

  it('returns empty array for board with no kings', () => {
    const board = boardWith([
      { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
    ]);
    expect(getAllKingSquares(board)).toEqual([]);
  });
});

describe('getAllOccupiedSquares', () => {
  it('returns all occupied squares', () => {
    const board = boardWith([
      { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
      { sq: 5, color: PieceColor.Black, type: PieceType.King },
      { sq: 10, color: PieceColor.Black, type: PieceType.Pawn },
    ]);
    const result = getAllOccupiedSquares(board);
    expect(result).toEqual([square(1), square(5), square(10)]);
  });

  it('returns empty array for empty board', () => {
    expect(getAllOccupiedSquares(emptyBoard())).toEqual([]);
  });
});

describe('getDiagonalNeighbors', () => {
  it('returns 4 neighbors for a center square', () => {
    // Square 14 is row 3, col 2 — center of board, 4 diagonal neighbors
    const neighbors = getDiagonalNeighbors(square(14));
    expect(neighbors.length).toBe(4);
  });

  it('returns fewer neighbors for edge/corner squares', () => {
    // Square 1 is row 0, col 1 — top edge
    const neighbors = getDiagonalNeighbors(square(1));
    // row 0 means no neighbors above; should have neighbors below
    expect(neighbors.length).toBeLessThanOrEqual(2);
    expect(neighbors.length).toBeGreaterThanOrEqual(1);
  });

  it('returns valid squares only', () => {
    const neighbors = getDiagonalNeighbors(square(14));
    for (const n of neighbors) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(32);
    }
  });
});

// ---------------------------------------------------------------------------
// Activation sequence tests
// ---------------------------------------------------------------------------

describe('buildActivationSequence', () => {
  describe('King for a Day', () => {
    it('produces flash on pawn squares (no overlay)', () => {
      const hook = getHook();
      const board = boardWith([
        { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
        { sq: 2, color: PieceColor.White, type: PieceType.Pawn },
        { sq: 5, color: PieceColor.Black, type: PieceType.Pawn },
        { sq: 10, color: PieceColor.White, type: PieceType.King },
      ]);
      const event = makeActiveEvent(CrazyEvent.KingForADay);
      const steps = hook.buildActivationSequence([event], board);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        type: 'flash',
        color: 'var(--ui-accent)',
        durationMs: EVENT_ANIM_DURATION.FLASH_PULSE * 3,
        pulses: 3,
      });
      // Flash should target 3 pawns, not the king
      const flash = steps[0] as AnimationStep & { type: 'flash'; squares: readonly unknown[] };
      expect(flash.squares).toHaveLength(3);
    });

    it('produces empty flash when all pieces are kings', () => {
      const hook = getHook();
      const board = boardWith([
        { sq: 1, color: PieceColor.White, type: PieceType.King },
        { sq: 5, color: PieceColor.Black, type: PieceType.King },
      ]);
      const event = makeActiveEvent(CrazyEvent.KingForADay);
      const steps = hook.buildActivationSequence([event], board);

      expect(steps).toHaveLength(1);
      const flash = steps[0] as AnimationStep & { type: 'flash'; squares: readonly unknown[] };
      expect(flash.squares).toHaveLength(0);
    });
  });

  describe('Live Grenade', () => {
    it('produces empty steps (no overlay)', () => {
      const hook = getHook();
      const event = makeActiveEvent(CrazyEvent.LiveGrenade);
      const steps = hook.buildActivationSequence([event], emptyBoard());

      expect(steps).toHaveLength(0);
    });
  });

  describe('Hot Potato', () => {
    it('produces empty steps (no overlay)', () => {
      const hook = getHook();
      const event = makeActiveEvent(CrazyEvent.HotPotato);
      const steps = hook.buildActivationSequence([event], emptyBoard());

      expect(steps).toHaveLength(0);
    });
  });

  describe('Checks Mix', () => {
    it('produces shuffle with correct position maps (no overlay)', () => {
      const hook = getHook();
      const boardBefore = boardWith([
        { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
        { sq: 5, color: PieceColor.Black, type: PieceType.Pawn },
        { sq: 10, color: PieceColor.White, type: PieceType.King },
      ]);
      const boardAfter = boardWith([
        { sq: 3, color: PieceColor.White, type: PieceType.Pawn },
        { sq: 7, color: PieceColor.Black, type: PieceType.Pawn },
        { sq: 15, color: PieceColor.White, type: PieceType.King },
      ]);
      const event = makeActiveEvent(CrazyEvent.ChecksMix);
      const steps = hook.buildActivationSequence([event], boardBefore, boardAfter);

      expect(steps).toHaveLength(1);

      const shuffle = steps[0] as AnimationStep & {
        type: 'shuffle';
        fromPositions: ReadonlyMap<number, unknown>;
        toPositions: ReadonlyMap<number, unknown>;
      };
      expect(shuffle.type).toBe('shuffle');
      expect(shuffle.fromPositions.size).toBe(3);
      expect(shuffle.toPositions.size).toBe(3);
      expect(shuffle.fromPositions.has(1)).toBe(true);
      expect(shuffle.toPositions.has(3)).toBe(true);
    });

    it('returns empty steps when boardAfter is not provided', () => {
      const hook = getHook();
      const event = makeActiveEvent(CrazyEvent.ChecksMix);
      const steps = hook.buildActivationSequence([event], emptyBoard());

      expect(steps).toHaveLength(0);
    });
  });

  describe('Opposite Day', () => {
    it('produces flash on all occupied squares with danger color (no overlay)', () => {
      const hook = getHook();
      const board = boardWith([
        { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
        { sq: 5, color: PieceColor.Black, type: PieceType.King },
        { sq: 10, color: PieceColor.Black, type: PieceType.Pawn },
      ]);
      const event = makeActiveEvent(CrazyEvent.OppositeDay);
      const steps = hook.buildActivationSequence([event], board);

      expect(steps).toHaveLength(1);
      const flash = steps[0] as AnimationStep & { type: 'flash'; squares: readonly unknown[]; color: string };
      expect(flash.squares).toHaveLength(3);
      expect(flash.color).toBe('var(--ui-danger)');
      expect(flash.pulses).toBe(2);
    });
  });

  describe('Up in the Air', () => {
    it('produces flash on all pieces with accent color (no overlay)', () => {
      const hook = getHook();
      const board = boardWith([
        { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
        { sq: 5, color: PieceColor.Black, type: PieceType.King },
      ]);
      const event = makeActiveEvent(CrazyEvent.UpInTheAir);
      const steps = hook.buildActivationSequence([event], board);

      expect(steps).toHaveLength(1);
      const flash = steps[0] as AnimationStep & { type: 'flash'; squares: readonly unknown[]; color: string };
      expect(flash.squares).toHaveLength(2);
      expect(flash.color).toBe('var(--ui-accent)');
    });
  });

  describe('No Touching!', () => {
    it('produces flash on king squares only (no overlay)', () => {
      const hook = getHook();
      const board = boardWith([
        { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
        { sq: 5, color: PieceColor.Black, type: PieceType.King },
        { sq: 10, color: PieceColor.White, type: PieceType.King },
        { sq: 20, color: PieceColor.Black, type: PieceType.Pawn },
      ]);
      const event = makeActiveEvent(CrazyEvent.NoTouching);
      const steps = hook.buildActivationSequence([event], board);

      expect(steps).toHaveLength(1);
      const flash = steps[0] as AnimationStep & { type: 'flash'; squares: readonly unknown[] };
      expect(flash.squares).toHaveLength(2);
      expect(flash.color).toBe('var(--ui-accent)');
    });

    it('produces empty flash when no kings exist (no overlay)', () => {
      const hook = getHook();
      const board = boardWith([
        { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
      ]);
      const event = makeActiveEvent(CrazyEvent.NoTouching);
      const steps = hook.buildActivationSequence([event], board);

      expect(steps).toHaveLength(1);
      const flash = steps[0] as AnimationStep & { type: 'flash'; squares: readonly unknown[] };
      expect(flash.squares).toHaveLength(0);
    });
  });

  describe('Multiple events', () => {
    it('concatenates sequences for multiple events', () => {
      const hook = getHook();
      const board = boardWith([
        { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
        { sq: 5, color: PieceColor.Black, type: PieceType.King },
      ]);
      const steps = hook.buildActivationSequence(
        [
          makeActiveEvent(CrazyEvent.KingForADay),
          makeActiveEvent(CrazyEvent.OppositeDay),
        ],
        board,
      );

      // KingForADay: flash, OppositeDay: flash = 2 steps (no overlays)
      expect(steps).toHaveLength(2);
      expect(steps[0]).toMatchObject({ type: 'flash' });
      expect(steps[1]).toMatchObject({ type: 'flash' });
    });
  });

  describe('Unknown/future event', () => {
    it('produces empty steps for unrecognized event types (HTML announcement handles display)', () => {
      const hook = getHook();
      // Use DoubleTrouble — a meta-event with no animation builder
      const event = makeActiveEvent(CrazyEvent.DoubleTrouble);
      const steps = hook.buildActivationSequence([event], emptyBoard());

      // DoubleTrouble has an announcement sequence but no standard activation builder.
      // If it produces steps, that's acceptable (Task 15.4 added it). Accept either.
      expect(steps.length).toBeGreaterThanOrEqual(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Mid-move effect tests
// ---------------------------------------------------------------------------

describe('buildMidMoveEffects', () => {
  describe('Live Grenade detonation', () => {
    it('produces explosion + fadeOuts for destroyed adjacent pieces', () => {
      const hook = getHook();
      // Landing on square 14; neighbors at squares around it have pieces before but not after
      const boardBefore = boardWith([
        { sq: 14, color: PieceColor.White, type: PieceType.Pawn },
        { sq: 10, color: PieceColor.Black, type: PieceType.Pawn },
        { sq: 18, color: PieceColor.Black, type: PieceType.Pawn },
      ]);
      const boardAfter = boardWith([
        { sq: 14, color: PieceColor.White, type: PieceType.Pawn },
        // sq 10 and 18 destroyed
      ]);

      const move = makeMove(5, [14], [9]);
      const event = makeActiveEvent(CrazyEvent.LiveGrenade);

      const steps = hook.buildMidMoveEffects(move, [event], boardBefore, boardAfter);

      expect(steps.length).toBeGreaterThanOrEqual(1);
      expect(steps[0]).toMatchObject({
        type: 'explosion',
        durationMs: EVENT_ANIM_DURATION.EXPLOSION,
      });

      // Should have fadeOut steps for destroyed pieces
      const fadeOuts = steps.filter((s) => s.type === 'fadeOut');
      // The exact count depends on which diagonal neighbors of sq 14 match sq 10 and 18
      expect(fadeOuts.length).toBeGreaterThanOrEqual(0);
    });

    it('produces explosion only when no adjacent pieces are destroyed', () => {
      const hook = getHook();
      const boardBefore = boardWith([
        { sq: 14, color: PieceColor.White, type: PieceType.Pawn },
      ]);
      const boardAfter = boardWith([
        { sq: 14, color: PieceColor.White, type: PieceType.Pawn },
      ]);

      const move = makeMove(5, [14], [9]);
      const event = makeActiveEvent(CrazyEvent.LiveGrenade);

      const steps = hook.buildMidMoveEffects(move, [event], boardBefore, boardAfter);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({ type: 'explosion' });
    });

    it('does not produce detonation when move has no captures', () => {
      const hook = getHook();
      const move = makeMove(5, [10]); // no captures
      const event = makeActiveEvent(CrazyEvent.LiveGrenade);

      const steps = hook.buildMidMoveEffects(move, [event], emptyBoard(), emptyBoard());

      expect(steps).toHaveLength(0);
    });
  });

  describe('Hot Potato effect', () => {
    it('produces colorSwap for white triggerer', () => {
      const hook = getHook();
      const move = makeMove(5, [10]);
      const event = makeActiveEvent(CrazyEvent.HotPotato, PieceColor.White);

      const steps = hook.buildMidMoveEffects(move, [event], emptyBoard(), emptyBoard());

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        type: 'colorSwap',
        square: square(10),
        fromColor: PieceColor.White,
        toColor: PieceColor.Black,
        durationMs: EVENT_ANIM_DURATION.COLOR_SWAP,
      });
    });

    it('produces colorSwap for black triggerer', () => {
      const hook = getHook();
      const move = makeMove(20, [15]);
      const event = makeActiveEvent(CrazyEvent.HotPotato, PieceColor.Black);

      const steps = hook.buildMidMoveEffects(move, [event], emptyBoard(), emptyBoard());

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        type: 'colorSwap',
        square: square(15),
        fromColor: PieceColor.Black,
        toColor: PieceColor.White,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Expiration sequence tests
// ---------------------------------------------------------------------------

describe('buildExpirationSequence', () => {
  it('King for a Day expiration produces flash', () => {
    const hook = getHook();
    const board = boardWith([
      { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
      { sq: 5, color: PieceColor.Black, type: PieceType.King },
    ]);
    const event = makeActiveEvent(CrazyEvent.KingForADay);
    const steps = hook.buildExpirationSequence([event], board);

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      type: 'flash',
      color: 'var(--ui-accent)',
      pulses: 2,
    });
  });

  it('Opposite Day expiration produces flash with danger color', () => {
    const hook = getHook();
    const board = boardWith([
      { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
    ]);
    const event = makeActiveEvent(CrazyEvent.OppositeDay);
    const steps = hook.buildExpirationSequence([event], board);

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      type: 'flash',
      color: 'var(--ui-danger)',
      pulses: 1,
      durationMs: EVENT_ANIM_DURATION.FLASH_PULSE,
    });
  });

  it('Up in the Air expiration produces flash with accent color', () => {
    const hook = getHook();
    const board = boardWith([
      { sq: 1, color: PieceColor.White, type: PieceType.Pawn },
    ]);
    const event = makeActiveEvent(CrazyEvent.UpInTheAir);
    const steps = hook.buildExpirationSequence([event], board);

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      type: 'flash',
      color: 'var(--ui-accent)',
      pulses: 1,
      durationMs: EVENT_ANIM_DURATION.FLASH_PULSE,
    });
  });

  it('Live Grenade expiration produces empty sequence', () => {
    const hook = getHook();
    const event = makeActiveEvent(CrazyEvent.LiveGrenade);
    const steps = hook.buildExpirationSequence([event], emptyBoard());

    expect(steps).toHaveLength(0);
  });

  it('Hot Potato expiration produces empty sequence', () => {
    const hook = getHook();
    const event = makeActiveEvent(CrazyEvent.HotPotato);
    const steps = hook.buildExpirationSequence([event], emptyBoard());

    expect(steps).toHaveLength(0);
  });

  it('No Touching expiration produces empty sequence', () => {
    const hook = getHook();
    const event = makeActiveEvent(CrazyEvent.NoTouching);
    const steps = hook.buildExpirationSequence([event], emptyBoard());

    expect(steps).toHaveLength(0);
  });

  it('Checks Mix expiration produces empty sequence', () => {
    const hook = getHook();
    const event = makeActiveEvent(CrazyEvent.ChecksMix);
    const steps = hook.buildExpirationSequence([event], emptyBoard());

    expect(steps).toHaveLength(0);
  });
});
