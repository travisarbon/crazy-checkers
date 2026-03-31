import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useAnimationQueue,
  buildAnimationSequence,
  squareCenterCoords,
  ANIM_DURATION,
} from './useAnimationQueue';
import type { AnimationStep } from './useAnimationQueue';
import { createInitialBoard } from '../engine/board';
import type { BoardState, Move, SquareState } from '../engine/types';
import { PieceColor, PieceType, square } from '../engine/types';

// Helper to create an empty board
function emptyBoard(): SquareState[] {
  return new Array(32).fill(null) as SquareState[];
}

// ---------------------------------------------------------------------------
// squareCenterCoords tests
// ---------------------------------------------------------------------------

describe('squareCenterCoords', () => {
  it('returns correct center for square 1 (row 0, col 1)', () => {
    const coords = squareCenterCoords(square(1), false);
    expect(coords.cx).toBe(150);
    expect(coords.cy).toBe(50);
  });

  it('flips the y-coordinate when flipped is true', () => {
    const normal = squareCenterCoords(square(1), false);
    const flipped = squareCenterCoords(square(1), true);
    expect(normal.cy).toBe(50);
    expect(flipped.cy).toBe(750);
    expect(normal.cx).toBe(flipped.cx);
  });
});

// ---------------------------------------------------------------------------
// buildAnimationSequence tests
// ---------------------------------------------------------------------------

describe('buildAnimationSequence', () => {
  it('builds a slide for a simple move', () => {
    const boardBefore = createInitialBoard();
    const boardAfter = [...boardBefore] as SquareState[];
    boardAfter[20] = null; // vacate 21
    boardAfter[16] = { color: PieceColor.White, type: PieceType.Pawn }; // place at 17

    const move: Move = { from: square(21), path: [square(17)], captured: [] };
    const steps = buildAnimationSequence(move, boardBefore, boardAfter);

    expect(steps).toHaveLength(1);
    const step0 = steps[0];
    expect(step0?.type).toBe('slide');
    if (step0?.type === 'slide') {
      expect(step0.fromSquare).toBe(21);
      expect(step0.toSquare).toBe(17);
      expect(step0.durationMs).toBe(ANIM_DURATION.SIMPLE_MOVE);
    }
  });

  it('builds slide + fadeOut for a single jump', () => {
    const board = emptyBoard();
    board[21] = { color: PieceColor.White, type: PieceType.Pawn }; // sq 22
    board[17] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 18 (captured)

    const boardAfter = emptyBoard();
    boardAfter[14] = { color: PieceColor.White, type: PieceType.Pawn }; // sq 15

    const move: Move = { from: square(22), path: [square(15)], captured: [square(18)] };
    const steps = buildAnimationSequence(move, board, boardAfter);

    expect(steps).toHaveLength(2);
    expect(steps[0]?.type).toBe('slide');
    const step1 = steps[1];
    expect(step1?.type).toBe('fadeOut');
    if (step1?.type === 'fadeOut') {
      expect(step1.square).toBe(18);
    }
  });

  it('builds multi-jump sequence with pauses', () => {
    const board = emptyBoard();
    board[8] = { color: PieceColor.White, type: PieceType.Pawn }; // sq 9
    board[13] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 14
    board[21] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 22

    const boardAfter = emptyBoard();
    boardAfter[24] = { color: PieceColor.White, type: PieceType.Pawn }; // sq 25

    const move: Move = {
      from: square(9),
      path: [square(18), square(25)],
      captured: [square(14), square(22)],
    };
    const steps = buildAnimationSequence(move, board, boardAfter);

    // slide, fadeOut, pause, slide, fadeOut = 5 steps
    expect(steps).toHaveLength(5);
    expect(steps[0]?.type).toBe('slide');
    expect(steps[1]?.type).toBe('fadeOut');
    expect(steps[2]?.type).toBe('pause');
    expect(steps[3]?.type).toBe('slide');
    expect(steps[4]?.type).toBe('fadeOut');
  });

  it('appends kingPulse when pawn promotes to king', () => {
    const board = emptyBoard();
    board[4] = { color: PieceColor.White, type: PieceType.Pawn }; // sq 5

    const boardAfter = emptyBoard();
    boardAfter[0] = { color: PieceColor.White, type: PieceType.King }; // sq 1 (promoted)

    const move: Move = { from: square(5), path: [square(1)], captured: [] };
    const steps = buildAnimationSequence(move, board, boardAfter);

    expect(steps).toHaveLength(2);
    expect(steps[0]?.type).toBe('slide');
    const step1 = steps[1];
    expect(step1?.type).toBe('kingPulse');
    if (step1?.type === 'kingPulse') {
      expect(step1.square).toBe(1);
      expect(step1.durationMs).toBe(ANIM_DURATION.KING_PULSE);
    }
  });

  it('does not append kingPulse when piece is already a king', () => {
    const board = emptyBoard();
    board[4] = { color: PieceColor.White, type: PieceType.King }; // sq 5

    const boardAfter = emptyBoard();
    boardAfter[0] = { color: PieceColor.White, type: PieceType.King }; // sq 1

    const move: Move = { from: square(5), path: [square(1)], captured: [] };
    const steps = buildAnimationSequence(move, board, boardAfter);

    expect(steps).toHaveLength(1);
    expect(steps[0]?.type).toBe('slide');
  });
});

// ---------------------------------------------------------------------------
// useAnimationQueue hook tests
// ---------------------------------------------------------------------------

describe('useAnimationQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame to fire synchronously
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const board: BoardState = new Array(32).fill(null);

  it('is idle by default', () => {
    const { result } = renderHook(() => useAnimationQueue());
    expect(result.current.isAnimating).toBe(false);
    expect(result.current.animatingPieces.size).toBe(0);
    expect(result.current.fadingSquares.size).toBe(0);
    expect(result.current.animationBoard).toBeNull();
  });

  it('sets isAnimating to true after enqueue', () => {
    const { result } = renderHook(() => useAnimationQueue());
    const steps: AnimationStep[] = [
      { type: 'slide', fromSquare: square(21), toSquare: square(17), durationMs: 280 },
    ];

    act(() => {
      result.current.enqueue(steps, board);
    });

    expect(result.current.isAnimating).toBe(true);
    expect(result.current.animationBoard).not.toBeNull();
  });

  it('completes a simple slide and calls onComplete', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimationQueue({ onComplete }),
    );

    const steps: AnimationStep[] = [
      { type: 'slide', fromSquare: square(21), toSquare: square(17), durationMs: 280 },
    ];

    act(() => {
      result.current.enqueue(steps, board);
    });

    expect(result.current.isAnimating).toBe(true);

    // Advance past slide duration
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isAnimating).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('processes fadeOut step', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimationQueue({ onComplete }),
    );

    const boardWithPiece = [...board] as SquareState[];
    boardWithPiece[17] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 18

    const steps: AnimationStep[] = [
      { type: 'slide', fromSquare: square(22), toSquare: square(15), durationMs: 280 },
      { type: 'fadeOut', square: square(18), durationMs: 200 },
    ];

    act(() => {
      result.current.enqueue(steps, boardWithPiece);
    });

    // After slide completes
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should be processing fadeOut now
    expect(result.current.fadingSquares.has(18)).toBe(true);

    // After fadeOut completes
    act(() => {
      vi.advanceTimersByTime(220);
    });

    expect(result.current.isAnimating).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('processes pause step', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimationQueue({ onComplete }),
    );

    const steps: AnimationStep[] = [
      { type: 'pause', durationMs: 60 },
    ];

    act(() => {
      result.current.enqueue(steps, board);
    });

    expect(result.current.isAnimating).toBe(true);

    act(() => {
      vi.advanceTimersByTime(70);
    });

    expect(result.current.isAnimating).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('processes kingPulse step', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimationQueue({ onComplete }),
    );

    const boardWithPiece = [...board] as SquareState[];
    boardWithPiece[0] = { color: PieceColor.White, type: PieceType.King }; // sq 1

    const steps: AnimationStep[] = [
      { type: 'kingPulse', square: square(1), durationMs: 300 },
    ];

    act(() => {
      result.current.enqueue(steps, boardWithPiece);
    });

    // During pulse, piece should have scale override
    expect(result.current.animatingPieces.has(1)).toBe(true);
    const animPiece = result.current.animatingPieces.get(1);
    expect(animPiece?.scale).toBe(1.15);

    // After half duration, scale should return to 1
    act(() => {
      vi.advanceTimersByTime(160);
    });
    const animPieceAfterHalf = result.current.animatingPieces.get(1);
    expect(animPieceAfterHalf?.scale).toBe(1.0);

    // After full duration
    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(result.current.isAnimating).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('applies speed multiplier to durations', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimationQueue({ speedMultiplier: 2.0, onComplete }),
    );

    const steps: AnimationStep[] = [
      { type: 'slide', fromSquare: square(21), toSquare: square(17), durationMs: 280 },
    ];

    act(() => {
      result.current.enqueue(steps, board);
    });

    // At 2x, duration is 560ms. At 300ms it should still be animating
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.isAnimating).toBe(true);

    // At 600ms it should be done
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.isAnimating).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('skipAnimation completes immediately and calls onComplete', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimationQueue({ onComplete }),
    );

    const steps: AnimationStep[] = [
      { type: 'slide', fromSquare: square(21), toSquare: square(17), durationMs: 280 },
      { type: 'pause', durationMs: 1000 },
      { type: 'slide', fromSquare: square(17), toSquare: square(13), durationMs: 280 },
    ];

    act(() => {
      result.current.enqueue(steps, board);
    });

    expect(result.current.isAnimating).toBe(true);

    act(() => {
      result.current.skipAnimation();
    });

    expect(result.current.isAnimating).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.animationBoard).toBeNull();
  });

  it('enqueue during animation replaces the current sequence', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimationQueue({ onComplete }),
    );

    const steps1: AnimationStep[] = [
      { type: 'slide', fromSquare: square(21), toSquare: square(17), durationMs: 500 },
    ];
    const steps2: AnimationStep[] = [
      { type: 'pause', durationMs: 100 },
    ];

    act(() => {
      result.current.enqueue(steps1, board);
    });

    // Enqueue a new sequence before the first completes
    act(() => {
      result.current.enqueue(steps2, board);
    });

    expect(result.current.isAnimating).toBe(true);

    // Complete the second sequence
    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(result.current.isAnimating).toBe(false);
    // onComplete should be called once (for the second sequence)
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('processes a multi-step sequence in order', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimationQueue({ onComplete }),
    );

    const boardWithPieces = [...board] as SquareState[];
    boardWithPieces[8] = { color: PieceColor.White, type: PieceType.Pawn }; // sq 9
    boardWithPieces[13] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 14
    boardWithPieces[21] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 22

    const steps: AnimationStep[] = [
      { type: 'slide', fromSquare: square(9), toSquare: square(18), durationMs: 180 },
      { type: 'fadeOut', square: square(14), durationMs: 200 },
      { type: 'pause', durationMs: 60 },
      { type: 'slide', fromSquare: square(18), toSquare: square(25), durationMs: 180 },
      { type: 'fadeOut', square: square(22), durationMs: 200 },
    ];

    act(() => {
      result.current.enqueue(steps, boardWithPieces);
    });

    expect(result.current.isAnimating).toBe(true);

    // Advance through all steps with generous timing
    act(() => {
      vi.advanceTimersByTime(200); // slide 1
    });
    act(() => {
      vi.advanceTimersByTime(220); // fadeOut 1
    });
    act(() => {
      vi.advanceTimersByTime(80); // pause
    });
    act(() => {
      vi.advanceTimersByTime(200); // slide 2
    });
    act(() => {
      vi.advanceTimersByTime(220); // fadeOut 2
    });

    expect(result.current.isAnimating).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
