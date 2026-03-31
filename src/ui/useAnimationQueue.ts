/**
 * Animation queue hook — manages sequenced move animations for the board.
 *
 * Processes an ordered list of animation steps (slide, fade, king pulse, pause)
 * and exposes state that Board/Piece components use to render CSS transitions.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { BoardState, Move, Square } from '../engine/types';
import { PieceType } from '../engine/types';
import { getBoardSquare, squareToGrid } from '../engine/board';

// ---------------------------------------------------------------------------
// Animation step types
// ---------------------------------------------------------------------------

/** Slide a piece from one SVG position to another. */
export interface SlideStep {
  readonly type: 'slide';
  readonly fromSquare: Square;
  readonly toSquare: Square;
  readonly durationMs: number;
}

/** Fade out a captured piece (opacity 1 → 0). */
export interface FadeOutStep {
  readonly type: 'fadeOut';
  readonly square: Square;
  readonly durationMs: number;
}

/** Scale-up pulse + crown appearance for a newly kinged piece. */
export interface KingPulseStep {
  readonly type: 'kingPulse';
  readonly square: Square;
  readonly durationMs: number;
}

/** A brief pause between sequential animation steps. */
export interface PauseStep {
  readonly type: 'pause';
  readonly durationMs: number;
}

export type AnimationStep = SlideStep | FadeOutStep | KingPulseStep | PauseStep;

// ---------------------------------------------------------------------------
// Duration constants
// ---------------------------------------------------------------------------

/** Base animation durations (ms). Scaled by the speed multiplier at runtime. */
export const ANIM_DURATION = {
  SIMPLE_MOVE: 280,
  MULTI_JUMP_HOP: 180,
  MULTI_JUMP_PAUSE: 60,
  CAPTURE_FADE: 200,
  KING_PULSE: 300,
  CAPTURE_FADE_OVERLAP: 80,
} as const;

// ---------------------------------------------------------------------------
// SVG coordinate helper
// ---------------------------------------------------------------------------

const SQUARE_SIZE = 100;

/**
 * Converts an engine Square to SVG viewBox center coordinates.
 */
export function squareCenterCoords(
  sq: Square,
  flipped: boolean,
): { cx: number; cy: number } {
  const { row, col } = squareToGrid(sq);
  const renderRow = flipped ? 7 - row : row;
  return {
    cx: col * SQUARE_SIZE + SQUARE_SIZE / 2,
    cy: renderRow * SQUARE_SIZE + SQUARE_SIZE / 2,
  };
}

// ---------------------------------------------------------------------------
// Sequence builder
// ---------------------------------------------------------------------------

/**
 * Builds the animation sequence for a given move.
 */
export function buildAnimationSequence(
  move: Move,
  boardBefore: BoardState,
  boardAfter: BoardState,
): AnimationStep[] {
  const steps: AnimationStep[] = [];
  const isCapture = move.captured.length > 0;
  const isMultiJump = move.path.length > 1;
  const firstDest = move.path[0];
  const firstCaptured = move.captured[0];

  if (!firstDest) return steps;

  if (!isCapture) {
    // Simple move (no capture)
    steps.push({
      type: 'slide',
      fromSquare: move.from,
      toSquare: firstDest,
      durationMs: ANIM_DURATION.SIMPLE_MOVE,
    });
  } else if (!isMultiJump) {
    // Single jump
    steps.push({
      type: 'slide',
      fromSquare: move.from,
      toSquare: firstDest,
      durationMs: ANIM_DURATION.SIMPLE_MOVE,
    });
    if (firstCaptured) {
      steps.push({
        type: 'fadeOut',
        square: firstCaptured,
        durationMs: ANIM_DURATION.CAPTURE_FADE,
      });
    }
  } else {
    // Multi-jump chain
    let currentFrom = move.from;
    for (let i = 0; i < move.path.length; i++) {
      const dest = move.path[i];
      const captured = move.captured[i];
      if (!dest) continue;
      steps.push({
        type: 'slide',
        fromSquare: currentFrom,
        toSquare: dest,
        durationMs: ANIM_DURATION.MULTI_JUMP_HOP,
      });
      if (captured) {
        steps.push({
          type: 'fadeOut',
          square: captured,
          durationMs: ANIM_DURATION.CAPTURE_FADE,
        });
      }
      if (i < move.path.length - 1) {
        steps.push({
          type: 'pause',
          durationMs: ANIM_DURATION.MULTI_JUMP_PAUSE,
        });
      }
      currentFrom = dest;
    }
  }

  // Kinging check
  const finalSquare = move.path[move.path.length - 1];
  if (!finalSquare) return steps;
  const pieceBefore = getBoardSquare(boardBefore, move.from);
  const pieceAfter = getBoardSquare(boardAfter, finalSquare);
  if (
    pieceBefore &&
    pieceAfter &&
    pieceBefore.type === PieceType.Pawn &&
    pieceAfter.type === PieceType.King
  ) {
    steps.push({
      type: 'kingPulse',
      square: finalSquare,
      durationMs: ANIM_DURATION.KING_PULSE,
    });
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Animating piece state (exposed to Board/Piece)
// ---------------------------------------------------------------------------

export interface AnimatingPiece {
  /** Override SVG x/y position (for slide). Null = use default grid position. */
  overridePosition: { cx: number; cy: number } | null;
  /** Opacity override (for fade-out). Null = default (1). */
  opacity: number | null;
  /** Scale override (for king pulse). Null = default (1). */
  scale: number | null;
}

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseAnimationQueueOptions {
  /** Speed multiplier (0.5–2.0). Default 1.0. */
  speedMultiplier?: number;
  /** Called when the full animation sequence completes. */
  onComplete?: () => void;
  /** Whether the board is flipped (for coordinate calculation). */
  flipped?: boolean;
}

export interface UseAnimationQueueResult {
  /** Whether an animation is currently playing. */
  isAnimating: boolean;

  /** Map of square → animation overrides for pieces currently being animated. */
  animatingPieces: ReadonlyMap<number, AnimatingPiece>;

  /** Set of squares whose pieces should be fading out. */
  fadingSquares: ReadonlySet<number>;

  /**
   * Enqueue an animation sequence. Replaces any currently playing animation.
   * The `boardBeforeMove` is rendered while the animation plays.
   */
  enqueue: (steps: AnimationStep[], boardBeforeMove: BoardState) => void;

  /**
   * The board to display during animation. Null when idle.
   */
  animationBoard: BoardState | null;

  /** Skip the current animation immediately. */
  skipAnimation: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useAnimationQueue({
  speedMultiplier = 1.0,
  onComplete,
  flipped = false,
}: UseAnimationQueueOptions = {}): UseAnimationQueueResult {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingPieces, setAnimatingPieces] = useState<ReadonlyMap<number, AnimatingPiece>>(
    new Map(),
  );
  const [fadingSquares, setFadingSquares] = useState<ReadonlySet<number>>(new Set());
  const [animationBoard, setAnimationBoard] = useState<BoardState | null>(null);

  // Refs for stable access inside timeouts/callbacks
  const stepsRef = useRef<AnimationStep[]>([]);
  const stepIndexRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const speedRef = useRef(speedMultiplier);
  const flippedRef = useRef(flipped);
  const boardRef = useRef<BoardState | null>(null);
  const activeTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const isAnimatingRef = useRef(false);
  const processNextStepRef = useRef<() => void>(() => {});

  // Keep refs in sync via effects (refs must not be written during render)
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { speedRef.current = speedMultiplier; }, [speedMultiplier]);
  useEffect(() => { flippedRef.current = flipped; }, [flipped]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = activeTimersRef.current;
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const finishAnimation = useCallback(() => {
    // Clear all timers
    for (const timer of activeTimersRef.current) {
      clearTimeout(timer);
    }
    activeTimersRef.current.clear();

    stepsRef.current = [];
    stepIndexRef.current = 0;
    boardRef.current = null;
    isAnimatingRef.current = false;

    setIsAnimating(false);
    setAnimatingPieces(new Map());
    setFadingSquares(new Set());
    setAnimationBoard(null);

    onCompleteRef.current?.();
  }, []);

  // Use a ref for processNextStep to break the circular useCallback dependency.
  // Wrapped in useEffect to avoid writing refs during render.
  useEffect(() => {
  processNextStepRef.current = () => {
    const steps = stepsRef.current;
    const idx = stepIndexRef.current;

    if (idx >= steps.length) {
      finishAnimation();
      return;
    }

    const step = steps[idx];
    if (!step) {
      finishAnimation();
      return;
    }
    const multiplier = speedRef.current;
    const fl = flippedRef.current;
    const duration = step.durationMs * multiplier;

    const advance = () => {
      stepIndexRef.current = idx + 1;
      processNextStepRef.current();
    };

    switch (step.type) {
      case 'slide': {
        const fromCoords = squareCenterCoords(step.fromSquare, fl);
        const toCoords = squareCenterCoords(step.toSquare, fl);

        // Set piece at start position with no transition, then animate to target
        setAnimatingPieces(
          new Map([
            [
              step.fromSquare as number,
              { overridePosition: fromCoords, opacity: null, scale: null },
            ],
          ]),
        );

        // Use rAF to ensure the initial position renders before setting target
        requestAnimationFrame(() => {
          if (!isAnimatingRef.current) return;
          setAnimatingPieces(
            new Map([
              [
                step.fromSquare as number,
                { overridePosition: toCoords, opacity: null, scale: null },
              ],
            ]),
          );
        });

        // After slide completes, update the animation board and advance
        const timer = setTimeout(() => {
          activeTimersRef.current.delete(timer);
          if (!isAnimatingRef.current) return;

          // Move piece on the animation board
          if (boardRef.current) {
            const board = [...boardRef.current];
            const piece = board[(step.fromSquare as number) - 1] ?? null;
            board[(step.fromSquare as number) - 1] = null;
            board[(step.toSquare as number) - 1] = piece;
            boardRef.current = board;
            setAnimationBoard(board);
          }

          setAnimatingPieces(new Map());
          advance();
        }, duration);
        activeTimersRef.current.add(timer);
        break;
      }

      case 'fadeOut': {
        setFadingSquares(new Set([step.square as number]));

        const timer = setTimeout(() => {
          activeTimersRef.current.delete(timer);
          if (!isAnimatingRef.current) return;

          // Remove captured piece from animation board
          if (boardRef.current) {
            const board = [...boardRef.current];
            board[(step.square as number) - 1] = null;
            boardRef.current = board;
            setAnimationBoard(board);
          }

          setFadingSquares(new Set());
          advance();
        }, duration);
        activeTimersRef.current.add(timer);
        break;
      }

      case 'kingPulse': {
        const coords = squareCenterCoords(step.square, fl);
        // Scale up
        setAnimatingPieces(
          new Map([
            [
              step.square as number,
              { overridePosition: coords, opacity: null, scale: 1.15 },
            ],
          ]),
        );

        // Scale back to normal at halfway point
        const halfTimer = setTimeout(() => {
          activeTimersRef.current.delete(halfTimer);
          if (!isAnimatingRef.current) return;
          setAnimatingPieces(
            new Map([
              [
                step.square as number,
                { overridePosition: coords, opacity: null, scale: 1.0 },
              ],
            ]),
          );
        }, duration / 2);
        activeTimersRef.current.add(halfTimer);

        // Complete
        const timer = setTimeout(() => {
          activeTimersRef.current.delete(timer);
          if (!isAnimatingRef.current) return;
          setAnimatingPieces(new Map());
          advance();
        }, duration);
        activeTimersRef.current.add(timer);
        break;
      }

      case 'pause': {
        const timer = setTimeout(() => {
          activeTimersRef.current.delete(timer);
          if (!isAnimatingRef.current) return;
          advance();
        }, duration);
        activeTimersRef.current.add(timer);
        break;
      }
    }
  };
  }, [finishAnimation]);

  const enqueue = useCallback(
    (steps: AnimationStep[], boardBeforeMove: BoardState) => {
      // Cancel any in-progress animation (without calling onComplete)
      for (const timer of activeTimersRef.current) {
        clearTimeout(timer);
      }
      activeTimersRef.current.clear();

      stepsRef.current = steps;
      stepIndexRef.current = 0;
      boardRef.current = [...boardBeforeMove];
      isAnimatingRef.current = true;

      setIsAnimating(true);
      setAnimatingPieces(new Map());
      setFadingSquares(new Set());
      setAnimationBoard([...boardBeforeMove]);

      // Start processing on next frame to ensure state is set
      requestAnimationFrame(() => {
        if (isAnimatingRef.current) {
          processNextStepRef.current();
        }
      });
    },
    [],
  );

  const skipAnimation = useCallback(() => {
    if (isAnimatingRef.current) {
      finishAnimation();
    }
  }, [finishAnimation]);

  return {
    isAnimating,
    animatingPieces,
    fadingSquares,
    enqueue,
    animationBoard,
    skipAnimation,
  };
}
