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
import { extSquareToGrid } from '../engine/events/marchingOrders';

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

// ---------------------------------------------------------------------------
// Event animation step types (Task 11.1)
// ---------------------------------------------------------------------------

/** Flash squares with a pulsing color overlay (e.g., King for a Day gold glow). */
export interface FlashStep {
  readonly type: 'flash';
  /** Squares to flash. */
  readonly squares: readonly Square[];
  /** CSS color for the flash overlay. */
  readonly color: string;
  /** Total duration of the flash effect in ms. */
  readonly durationMs: number;
  /** Number of pulse cycles. Default 2. */
  readonly pulses?: number;
}

/** Radial burst effect from a center square (e.g., Live Grenade detonation). */
export interface ExplosionStep {
  readonly type: 'explosion';
  /** Square at the center of the explosion. */
  readonly centerSquare: Square;
  /** Squares affected by the blast radius. */
  readonly affectedSquares: readonly Square[];
  /** Total duration of the explosion effect in ms. */
  readonly durationMs: number;
}

/** All pieces lift, scatter to new positions, and settle (Checks Mix). */
export interface ShuffleStep {
  readonly type: 'shuffle';
  /**
   * Piece positions before the shuffle.
   * Map of square number → piece info (color and type).
   */
  readonly fromPositions: ReadonlyMap<number, { color: PieceColor; type: PieceType }>;
  /**
   * Piece positions after the shuffle.
   * Map of square number → piece info (color and type).
   */
  readonly toPositions: ReadonlyMap<number, { color: PieceColor; type: PieceType }>;
  /** Total duration of the shuffle animation in ms. */
  readonly durationMs: number;
}

/** Piece changes color with a Y-axis flip animation (Hot Potato exchange). */
export interface ColorSwapStep {
  readonly type: 'colorSwap';
  /** Square of the piece being color-swapped. */
  readonly square: Square;
  /** The piece color before the swap. */
  readonly fromColor: PieceColor;
  /** The piece color after the swap. */
  readonly toColor: PieceColor;
  /** Total duration of the flip animation in ms. */
  readonly durationMs: number;
}

/** Text/icon overlay centered on the board (event announcements as animation beats). */
export interface OverlayStep {
  readonly type: 'overlay';
  /** Text to display in the overlay. */
  readonly text: string;
  /** Optional icon identifier. */
  readonly icon?: string;
  /** Total duration: fade-in + hold + fade-out. */
  readonly durationMs: number;
}

export type AnimationStep =
  | SlideStep
  | FadeOutStep
  | KingPulseStep
  | PauseStep
  | FlashStep
  | ExplosionStep
  | ShuffleStep
  | ColorSwapStep
  | OverlayStep;

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

/** Event animation durations (ms). Scaled by the speed multiplier at runtime. */
export const EVENT_ANIM_DURATION = {
  FLASH_PULSE: 300,
  EXPLOSION: 600,
  SHUFFLE_LIFT: 150,
  SHUFFLE_SCATTER: 400,
  SHUFFLE_SETTLE: 150,
  COLOR_SWAP: 400,
  OVERLAY_FADE_IN: 200,
  OVERLAY_HOLD: 600,
  OVERLAY_FADE_OUT: 200,
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

/** Named easing curves for event animation step types. */
export const EVENT_ANIM_EASING = {
  /** Flash pulse: smooth oscillation. */
  FLASH: 'ease-in-out',
  /** Explosion burst: sharp deceleration (Material Design decelerate curve). */
  EXPLOSION_EXPAND: 'cubic-bezier(0.0, 0.0, 0.2, 1.0)',
  /** Shuffle lift: ease-out for upward momentum. */
  SHUFFLE_LIFT: 'ease-out',
  /** Shuffle scatter: smooth arc to new positions. */
  SHUFFLE_SCATTER: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
  /** Shuffle settle: ease-in for settling feel. */
  SHUFFLE_SETTLE: 'ease-in',
  /** Color swap flip: ease-in-out for symmetric rotation. */
  COLOR_SWAP: 'ease-in-out',
  /** Overlay fade: linear for consistent opacity transitions. */
  OVERLAY: 'linear',
} as const;

// ---------------------------------------------------------------------------
// SVG coordinate helper
// ---------------------------------------------------------------------------

const SQUARE_SIZE = 100;

/**
 * Converts an engine Square to SVG viewBox center coordinates.
 * Handles both standard dark squares (1-32) and Marching Orders
 * extended light squares (33-64).
 */
export function squareCenterCoords(sq: Square, flipped: boolean): { cx: number; cy: number } {
  const sqNum = sq as number;
  const { row, col } = sqNum > 32 ? extSquareToGrid(sqNum) : squareToGrid(sq);
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
  /** Horizontal scale override (for color swap Y-axis flip). Null = default (1). */
  scaleX: number | null;
  /** CSS transition duration for position/scale changes (ms). 0 = instant. */
  transitionDurationMs: number;
  /** CSS easing function override. */
  easing?: string;
  /**
   * Stable key for React reconciliation. During multi-jump animations, the
   * piece's map key changes as the animation board updates, but this value
   * stays constant (the original fromSquare) so React preserves the DOM node.
   */
  stableKey?: number;
}

// ---------------------------------------------------------------------------
// Event animation state (exposed to Board/EventAnimations)
// ---------------------------------------------------------------------------

/** State for flash overlay rendering. */
export interface FlashingSquaresState {
  /** Squares currently being flashed. */
  readonly squares: ReadonlySet<number>;
  /** CSS color for the flash. */
  readonly color: string;
  /** Number of pulses. */
  readonly pulses: number;
  /** Duration of the entire flash in ms. */
  readonly durationMs: number;
}

/** State for explosion overlay rendering. */
export interface ExplosionState {
  /** Center square of the explosion. */
  readonly centerSquare: number;
  /** Affected squares. */
  readonly affectedSquares: ReadonlySet<number>;
  /** Duration of the entire explosion in ms. */
  readonly durationMs: number;
}

/** State for text overlay rendering. */
export interface OverlayState {
  /** Text to display. */
  readonly text: string;
  /** Optional icon identifier. */
  readonly icon?: string;
  /** Duration of the entire overlay in ms. */
  readonly durationMs: number;
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
  enqueue: (
    steps: AnimationStep[],
    boardBeforeMove: BoardState,
    capturingColor?: PieceColor,
  ) => void;

  /**
   * The board to display during animation. Null when idle.
   */
  animationBoard: BoardState | null;

  /** Skip the current animation immediately. */
  skipAnimation: () => void;

  // --- Event animation states (Task 11.1) ---

  /** Flash overlay state, or null when no flash is active. */
  flashingSquares: FlashingSquaresState | null;

  /** Explosion overlay state, or null when no explosion is active. */
  explosionState: ExplosionState | null;

  /** Text overlay state, or null when no overlay is active. */
  overlayState: OverlayState | null;
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

  // Event animation states (Task 11.1)
  const [flashingSquares, setFlashingSquares] = useState<FlashingSquaresState | null>(null);
  const [explosionState, setExplosionState] = useState<ExplosionState | null>(null);
  const [overlayState, setOverlayState] = useState<OverlayState | null>(null);

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
  /** Stable key for the moving piece — set to the first slide's fromSquare. */
  const movingPieceKeyRef = useRef<number | null>(null);

  // Keep refs in sync via effects (refs must not be written during render)
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onCaptureAnimatedRef.current = onCaptureAnimated;
  }, [onCaptureAnimated]);
  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);
  useEffect(() => {
    flippedRef.current = flipped;
  }, [flipped]);

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
    movingPieceKeyRef.current = null;

    setIsAnimating(false);
    setAnimatingPieces(new Map());
    setFadingSquares(new Set());
    setAnimationBoard(null);
    setFlashingSquares(null);
    setExplosionState(null);
    setOverlayState(null);

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

          // On the first slide in a sequence, lock the stable key so the
          // floating layer uses a consistent React key across all hops.
          if (movingPieceKeyRef.current === null) {
            movingPieceKeyRef.current = step.fromSquare as number;
          }
          const stableKey = movingPieceKeyRef.current;

          // Set piece at start position with no transition, then animate to target
          setAnimatingPieces(
            new Map([
              [
                step.fromSquare as number,
                {
                  overridePosition: fromCoords,
                  opacity: null,
                  scale: null,
                  scaleX: null,
                  transitionDurationMs: 0,
                  stableKey,
                },
              ],
            ]),
          );

          // Use a double-RAF to ensure the initial position is committed to the
          // DOM before we set the transition target. A single RAF is not enough
          // because React may batch the state update and not paint before the
          // callback fires — especially on Firefox where microtask scheduling
          // differs from Chromium.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!isAnimatingRef.current) return;
              setAnimatingPieces(
                new Map([
                  [
                    step.fromSquare as number,
                    {
                      overridePosition: toCoords,
                      opacity: null,
                      scale: null,
                      scaleX: null,
                      transitionDurationMs: duration,
                      easing: slideEasing,
                      stableKey,
                    },
                  ],
                ]),
              );
            });
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
                  {
                    overridePosition: destCoords,
                    opacity: null,
                    scale: null,
                    scaleX: null,
                    transitionDurationMs: 0,
                    stableKey,
                  },
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
                {
                  overridePosition: coords,
                  opacity: null,
                  scale: 1.15,
                  scaleX: null,
                  transitionDurationMs: halfDuration,
                  easing: step.easingUp,
                },
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
                  {
                    overridePosition: coords,
                    opacity: null,
                    scale: 1.0,
                    scaleX: null,
                    transitionDurationMs: halfDuration,
                    easing: step.easingDown,
                  },
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

        // ── Event animation steps (Task 11.1) ─────────────────────────

        case 'flash': {
          const pulses = step.pulses ?? 2;
          setFlashingSquares({
            squares: new Set(step.squares.map((s) => s as number)),
            color: step.color,
            pulses,
            durationMs: duration,
          });

          const timer = setTimeout(() => {
            activeTimersRef.current.delete(timer);
            if (!isAnimatingRef.current) return;
            setFlashingSquares(null);
            advance();
          }, duration);
          activeTimersRef.current.add(timer);
          break;
        }

        case 'explosion': {
          setExplosionState({
            centerSquare: step.centerSquare as number,
            affectedSquares: new Set(step.affectedSquares.map((s) => s as number)),
            durationMs: duration,
          });

          const timer = setTimeout(() => {
            activeTimersRef.current.delete(timer);
            if (!isAnimatingRef.current) return;
            setExplosionState(null);
            advance();
          }, duration);
          activeTimersRef.current.add(timer);
          break;
        }

        case 'shuffle': {
          // Use absolute phase durations from constants (scaled by multiplier)
          const liftDuration = EVENT_ANIM_DURATION.SHUFFLE_LIFT * multiplier;
          const scatterDuration = EVENT_ANIM_DURATION.SHUFFLE_SCATTER * multiplier;
          const settleDuration = EVENT_ANIM_DURATION.SHUFFLE_SETTLE * multiplier;
          const totalDuration = liftDuration + scatterDuration + settleDuration;

          // Phase 1: All pieces lift slightly (scale up)
          const liftMap = new Map<number, AnimatingPiece>();
          for (const [sq] of step.fromPositions) {
            const coords = squareCenterCoords(sq as Square, fl);
            liftMap.set(sq, {
              overridePosition: coords,
              opacity: null,
              scale: 1.1,
              scaleX: null,
              transitionDurationMs: liftDuration,
              easing: EVENT_ANIM_EASING.SHUFFLE_LIFT,
            });
          }
          setAnimatingPieces(liftMap);

          // Phase 2: Scatter to new positions
          const scatterTimer = setTimeout(() => {
            activeTimersRef.current.delete(scatterTimer);
            if (!isAnimatingRef.current) return;

            const scatterMap = new Map<number, AnimatingPiece>();
            const fromEntries = Array.from(step.fromPositions.entries());
            const toEntries = Array.from(step.toPositions.entries());

            for (let i = 0; i < fromEntries.length && i < toEntries.length; i++) {
              const fromEntry = fromEntries[i];
              const toEntry = toEntries[i];
              if (fromEntry === undefined || toEntry === undefined) continue;
              const fromSq = fromEntry[0];
              const toSq = toEntry[0];
              const toCoords = squareCenterCoords(toSq as Square, fl);
              scatterMap.set(fromSq, {
                overridePosition: toCoords,
                opacity: null,
                scale: 1.0,
                scaleX: null,
                transitionDurationMs: scatterDuration,
                easing: EVENT_ANIM_EASING.SHUFFLE_SCATTER,
              });
            }
            setAnimatingPieces(scatterMap);
          }, liftDuration);
          activeTimersRef.current.add(scatterTimer);

          // Phase 3: Settle and update board atomically
          const settleTimer = setTimeout(() => {
            activeTimersRef.current.delete(settleTimer);
            if (!isAnimatingRef.current) return;

            // Update the animation board to the post-shuffle state
            if (boardRef.current) {
              const board = new Array(boardRef.current.length).fill(null) as BoardState;
              for (const [sq, piece] of step.toPositions) {
                (board as Array<{ color: PieceColor; type: PieceType } | null>)[sq - 1] = {
                  color: piece.color,
                  type: piece.type,
                };
              }
              boardRef.current = board;
              setAnimationBoard(board);
            }

            const settleMap = new Map<number, AnimatingPiece>();
            for (const [sq] of step.toPositions) {
              const coords = squareCenterCoords(sq as Square, fl);
              settleMap.set(sq, {
                overridePosition: coords,
                opacity: null,
                scale: 1.0,
                scaleX: null,
                transitionDurationMs: settleDuration,
                easing: EVENT_ANIM_EASING.SHUFFLE_SETTLE,
              });
            }
            setAnimatingPieces(settleMap);
          }, liftDuration + scatterDuration);
          activeTimersRef.current.add(settleTimer);

          // Complete
          const completeTimer = setTimeout(() => {
            activeTimersRef.current.delete(completeTimer);
            if (!isAnimatingRef.current) return;
            setAnimatingPieces(new Map());
            advance();
          }, totalDuration);
          activeTimersRef.current.add(completeTimer);
          break;
        }

        case 'colorSwap': {
          const coords = squareCenterCoords(step.square, fl);
          const halfDuration = duration / 2;

          // Phase 1: Scale X down to 0 (first half of flip)
          setAnimatingPieces(
            new Map([
              [
                step.square as number,
                {
                  overridePosition: coords,
                  opacity: null,
                  scale: null,
                  scaleX: 0,
                  transitionDurationMs: halfDuration,
                  easing: EVENT_ANIM_EASING.COLOR_SWAP,
                },
              ],
            ]),
          );

          // Phase 2: At midpoint, swap the piece color on the board and scale X back up
          const midTimer = setTimeout(() => {
            activeTimersRef.current.delete(midTimer);
            if (!isAnimatingRef.current) return;

            // Update piece color on animation board
            if (boardRef.current) {
              const board = [...boardRef.current];
              const idx = (step.square as number) - 1;
              const piece = board[idx];
              if (piece !== null && piece !== undefined) {
                board[idx] = { ...piece, color: step.toColor };
                boardRef.current = board;
                setAnimationBoard(board);
              }
            }

            // Scale X back to 1 (second half of flip)
            setAnimatingPieces(
              new Map([
                [
                  step.square as number,
                  {
                    overridePosition: coords,
                    opacity: null,
                    scale: null,
                    scaleX: 1,
                    transitionDurationMs: halfDuration,
                    easing: EVENT_ANIM_EASING.COLOR_SWAP,
                  },
                ],
              ]),
            );
          }, halfDuration);
          activeTimersRef.current.add(midTimer);

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

        case 'overlay': {
          setOverlayState({
            text: step.text,
            icon: step.icon,
            durationMs: duration,
          });

          const timer = setTimeout(() => {
            activeTimersRef.current.delete(timer);
            if (!isAnimatingRef.current) return;
            setOverlayState(null);
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
      movingPieceKeyRef.current = null;

      setIsAnimating(true);
      setAnimatingPieces(new Map());
      setFadingSquares(new Set());
      setAnimationBoard([...boardBeforeMove]);
      setFlashingSquares(null);
      setExplosionState(null);
      setOverlayState(null);

      // Start processing after two frames to ensure React has committed
      // the initial state to the DOM (double-RAF for Firefox reliability).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (isAnimatingRef.current) {
            processNextStepRef.current();
          }
        });
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
    flashingSquares,
    explosionState,
    overlayState,
  };
}
