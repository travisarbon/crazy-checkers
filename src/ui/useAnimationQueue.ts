/**
 * Animation queue hook — manages sequenced move animations for the board.
 *
 * Processes an ordered list of animation steps (slide, fade, king pulse, pause)
 * and exposes state that Board/Piece components use to render CSS transitions.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { BoardState, Move, Square } from '../engine/types';
import { PieceColor, PieceType } from '../engine/types';
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
  readonly easing?: string;
}

/** Fade out a captured piece (opacity 1 → 0). */
export interface FadeOutStep {
  readonly type: 'fadeOut';
  readonly square: Square;
  readonly durationMs: number;
  readonly easing?: string;
}

/** Scale-up pulse + crown appearance for a newly kinged piece. */
export interface KingPulseStep {
  readonly type: 'kingPulse';
  readonly square: Square;
  readonly durationMs: number;
  readonly easingUp?: string;
  readonly easingDown?: string;
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
// Easing constants
// ---------------------------------------------------------------------------

/** Named easing curves for each animation step type. */
export const ANIM_EASING = {
  /** Simple moves and single jumps: gentle deceleration into destination. */
  SLIDE: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
  /** Multi-jump hops: quicker attack, more percussive feel. */
  MULTI_JUMP_HOP: 'cubic-bezier(0.33, 0, 0.25, 1.0)',
  /** Capture fade-out: linear for consistent opacity decay. */
  CAPTURE_FADE: 'ease-out',
  /** King pulse scale-up: ease-out for an expanding feel. */
  KING_PULSE_UP: 'ease-out',
  /** King pulse scale-down: ease-in for a settling feel. */
  KING_PULSE_DOWN: 'ease-in',
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
      easing: ANIM_EASING.SLIDE,
    });
  } else if (!isMultiJump) {
    // Single jump
    steps.push({
      type: 'slide',
      fromSquare: move.from,
      toSquare: firstDest,
      durationMs: ANIM_DURATION.SIMPLE_MOVE,
      easing: ANIM_EASING.SLIDE,
    });
    if (firstCaptured) {
      steps.push({
        type: 'fadeOut',
        square: firstCaptured,
        durationMs: ANIM_DURATION.CAPTURE_FADE,
        easing: ANIM_EASING.CAPTURE_FADE,
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
        easing: ANIM_EASING.MULTI_JUMP_HOP,
      });
      if (captured) {
        steps.push({
          type: 'fadeOut',
          square: captured,
          durationMs: ANIM_DURATION.CAPTURE_FADE,
          easing: ANIM_EASING.CAPTURE_FADE,
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
      easingUp: ANIM_EASING.KING_PULSE_UP,
      easingDown: ANIM_EASING.KING_PULSE_DOWN,
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
  /** CSS transition duration for position/scale changes (ms). 0 = instant. */
  transitionDurationMs: number;
  /** CSS easing function override. */
  easing?: string;
}

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseAnimationQueueOptions {
  /** Speed multiplier (0.5–2.0). Default 1.0. */
  speedMultiplier?: number;
  /** Called when the full animation sequence completes. */
  onComplete?: () => void;
  /** Called when a capture fade-out animation completes, with the capturing player's color. */
  onCaptureAnimated?: (capturedByColor: PieceColor) => void;
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
  enqueue: (steps: AnimationStep[], boardBeforeMove: BoardState, capturingColor?: PieceColor) => void;

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
  onCaptureAnimated,
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
  const onCaptureAnimatedRef = useRef(onCaptureAnimated);
  const speedRef = useRef(speedMultiplier);
  const flippedRef = useRef(flipped);
  const boardRef = useRef<BoardState | null>(null);
  const capturingColorRef = useRef<PieceColor | undefined>(undefined);
  const activeTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const isAnimatingRef = useRef(false);
  const processNextStepRef = useRef<() => void>(() => {});

  // Keep refs in sync via effects (refs must not be written during render)
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onCaptureAnimatedRef.current = onCaptureAnimated; }, [onCaptureAnimated]);
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
        const slideEasing = step.easing;

        // Set piece at start position with no transition, then animate to target
        setAnimatingPieces(
          new Map([
            [
              step.fromSquare as number,
              { overridePosition: fromCoords, opacity: null, scale: null, transitionDurationMs: 0 },
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
                { overridePosition: toCoords, opacity: null, scale: null, transitionDurationMs: duration, easing: slideEasing },
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

          // Keep piece floating at destination to prevent flash between hops.
          // The piece is now at toSquare on the animation board; keeping it in
          // the animatingPieces map (with no transition) maintains DOM continuity
          // so it doesn't unmount/remount between steps.
          const destCoords = squareCenterCoords(step.toSquare, fl);
          setAnimatingPieces(
            new Map([
              [
                step.toSquare as number,
                { overridePosition: destCoords, opacity: null, scale: null, transitionDurationMs: 0 },
              ],
            ]),
          );
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

          // Notify that a capture animation completed
          if (capturingColorRef.current !== undefined) {
            onCaptureAnimatedRef.current?.(capturingColorRef.current);
          }

          setFadingSquares(new Set());
          advance();
        }, duration);
        activeTimersRef.current.add(timer);
        break;
      }

      case 'kingPulse': {
        const coords = squareCenterCoords(step.square, fl);
        const halfDuration = duration / 2;
        // Scale up
        setAnimatingPieces(
          new Map([
            [
              step.square as number,
              { overridePosition: coords, opacity: null, scale: 1.15, transitionDurationMs: halfDuration, easing: step.easingUp },
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
                { overridePosition: coords, opacity: null, scale: 1.0, transitionDurationMs: halfDuration, easing: step.easingDown },
              ],
            ]),
          );
        }, halfDuration);
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
    (steps: AnimationStep[], boardBeforeMove: BoardState, capturingColor?: PieceColor) => {
      // Cancel any in-progress animation (without calling onComplete)
      for (const timer of activeTimersRef.current) {
        clearTimeout(timer);
      }
      activeTimersRef.current.clear();

      stepsRef.current = steps;
      stepIndexRef.current = 0;
      boardRef.current = [...boardBeforeMove];
      capturingColorRef.current = capturingColor;
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
