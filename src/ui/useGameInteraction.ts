/**
 * Custom hook encapsulating the click-to-select, click-to-move interaction model.
 *
 * Manages a three-phase state machine: idle → selected → mid-multi-jump.
 * Produces the props that Board needs for highlights, click handling, and
 * cursor affordance.
 */

import { useState, useCallback, useMemo } from 'react';
import type { ActiveEvent, BoardState, GameState, Move, Piece, Square, SquareState } from '../engine/types';
import { CrazyEvent, GameStatus } from '../engine/types';
import { getBoardSquare } from '../engine/board';
import { extSquareToGrid } from '../engine/events/marchingOrders';
import type { MarchingOrdersMetadata } from '../engine/events/marchingOrders';
import { getMovesToSquare, getJumpsForPiece } from '../engine/moves';
import { getFlyingJumps } from '../engine/flyingMoves';
import { getBackfireJumpsForPiece } from '../engine/events/backfire';
import { getBoardSquare as getBoardSq } from '../engine/board';
import { makeMove, getCurrentLegalMoves, getEffectiveBoard } from '../engine/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Details for a single hop in a multi-jump chain. */
export interface HopDetails {
  /** Square the piece jumped from. */
  from: Square;
  /** Square the piece landed on. */
  to: Square;
  /** Square of the captured piece. */
  captured: Square;
  /** Board state after this hop (with piece moved and capture removed). */
  boardAfter: BoardState;
}

interface UseGameInteractionOptions {
  /** The current game state. */
  gameState: GameState;

  /** Callback invoked when a complete move is executed. Receives the new GameState. */
  onMove: (newState: GameState, options?: { skipMoveAnimation?: boolean }) => void;

  /** Callback invoked after each intermediate or final hop during an interactive multi-jump. */
  onHopComplete?: (hop: HopDetails) => void;

  /** Whether an animation is currently playing (suppresses input). */
  isAnimating?: boolean;

  /** Whether interaction is disabled (e.g., during AI thinking). */
  isDisabled?: boolean;

  /** Whether moves require a second click to confirm (does not apply to multi-jump continuations). */
  moveConfirmation?: boolean;
}

export interface UseGameInteractionResult {
  /** The square of the currently selected piece, or null. */
  selectedSquare: Square | null;

  /** Set of square numbers that are legal destinations for the selected piece. */
  legalDestinations: ReadonlySet<number>;

  /** The board to display — normally gameState.board, but the intermediate board during multi-jumps. */
  displayBoard: BoardState;

  /** Handler to attach to Board's onSquareClick. */
  handleSquareClick: (sq: Square) => void;

  /** Handler for Escape key (call from a keydown listener). */
  handleEscape: () => void;

  /** Whether the interaction is in the middle of a multi-jump chain. */
  isMidMultiJump: boolean;

  /**
   * Set of square numbers for pieces that have legal moves and can be selected.
   * Used for subtle visual affordance (e.g., cursor: pointer).
   */
  selectablePieces: ReadonlySet<number>;

  /** Square awaiting move confirmation (second click), or null. */
  pendingConfirmSquare: Square | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Look up a piece at any square, including Marching Orders light squares (33-64).
 * Falls back to the 32-square board for dark squares (1-32).
 */
function getPieceAtSquare(
  board: BoardState,
  sq: Square,
  activeEvents: readonly ActiveEvent[],
): Piece | null {
  const sqNum = sq as number;
  if (sqNum <= 32) return getBoardSquare(board, sq);

  // Light square — check Marching Orders metadata
  for (let i = activeEvents.length - 1; i >= 0; i--) {
    const event = activeEvents[i];
    if (event?.type === CrazyEvent.MarchingOrders && event.metadata) {
      const meta = event.metadata as unknown as MarchingOrdersMetadata;
      const { row, col } = extSquareToGrid(sqNum);
      const gridPiece = meta.orthogonalGrid[row * 8 + col];
      if (gridPiece) return { color: gridPiece.color, type: gridPiece.type };
      return null;
    }
  }
  return null;
}

/**
 * Create a temporary board showing the piece at `to`, with `from` vacated
 * and the captured piece removed. Used for rendering and for computing
 * continuation jumps during a multi-jump chain.
 */
function applyPartialHop(
  board: BoardState,
  from: Square,
  to: Square,
  captured: Square,
): BoardState {
  const newBoard = [...board] as SquareState[];
  const piece = getBoardSquare(board, from);
  newBoard[(from as number) - 1] = null;
  newBoard[(captured as number) - 1] = null;
  newBoard[(to as number) - 1] = piece;
  return newBoard;
}

/**
 * Returns continuation jumps for a piece during a multi-jump chain.
 * Uses flying jump logic when Up in the Air is active, Backfire-aware
 * logic when Backfire is active (to allow friendly captures), standard otherwise.
 */
function getContinuationJumps(
  board: BoardState,
  sq: Square,
  activeEvents: readonly ActiveEvent[],
): Move[] {
  const upInTheAir = activeEvents.some(e => e.type === CrazyEvent.UpInTheAir);
  if (upInTheAir) {
    return getFlyingJumps(board, sq);
  }

  const backfireActive = activeEvents.some(e => e.type === CrazyEvent.Backfire);
  if (backfireActive) {
    const piece = getBoardSq(board, sq);
    if (piece !== null) {
      const stepBackActive = activeEvents.some(e => e.type === CrazyEvent.StepBack);
      return getBackfireJumpsForPiece(board, sq, piece.color, piece.type, stepBackActive);
    }
  }

  return getJumpsForPiece(board, sq);
}

/**
 * Find the captured square for a hop from `from` to `to` by looking at the
 * legal moves' first path entry.
 */
function findCapturedForHop(_from: Square, to: Square, legalMoves: Move[]): Square | null {
  for (const move of legalMoves) {
    if (move.path.length > 0 && (move.path[0] as number) === (to as number)) {
      return move.captured.length > 0 ? (move.captured[0] ?? null) : null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameInteraction({
  gameState,
  onMove,
  onHopComplete,
  isAnimating = false,
  isDisabled = false,
  moveConfirmation = false,
}: UseGameInteractionOptions): UseGameInteractionResult {
  // ── Internal state ───────────────────────────────────────────────────
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [multiJumpProgress, setMultiJumpProgress] = useState<{
    from: Square;
    pathSoFar: Square[];
    capturedSoFar: Square[];
  } | null>(null);
  const [intermediateBoard, setIntermediateBoard] = useState<BoardState | null>(null);
  const [pendingConfirmSquare, setPendingConfirmSquare] = useState<Square | null>(null);

  // ── clearSelection helper ────────────────────────────────────────────
  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setMultiJumpProgress(null);
    setIntermediateBoard(null);
    setPendingConfirmSquare(null);
  }, []);

  const handleEscape = useCallback(() => {
    if (isAnimating) return;
    clearSelection();
  }, [clearSelection, isAnimating]);

  // ── Reset selection when game state changes externally ───────────────
  const [trackedPly, setTrackedPly] = useState(gameState.plyCount);
  if (gameState.plyCount !== trackedPly) {
    setTrackedPly(gameState.plyCount);
    if (selectedSquare !== null || multiJumpProgress !== null || pendingConfirmSquare !== null) {
      setSelectedSquare(null);
      setMultiJumpProgress(null);
      setIntermediateBoard(null);
      setPendingConfirmSquare(null);
    }
  }

  // ── Derived state: legal moves for selected piece ────────────────────
  const legalMoves = useMemo(() => {
    if (selectedSquare === null) return [];

    if (intermediateBoard !== null) {
      // Mid-multi-jump: continuation jumps from the current landing.
      // Uses flying jumps when Up in the Air is active.
      return getContinuationJumps(intermediateBoard, selectedSquare, gameState.activeEvents);
    }

    // Use getCurrentLegalMoves (routes through CompositeEventRuleSet) and filter.
    // Use numeric comparison so extended square numbers (33-64 from Marching Orders) work.
    const allMoves = getCurrentLegalMoves(gameState);
    return allMoves.filter((m) => (m.from as number) === (selectedSquare as number));
  }, [selectedSquare, intermediateBoard, gameState]);

  // ── Derived state: destination squares ───────────────────────────────
  const legalDestinations = useMemo(() => {
    const set = new Set<number>();
    for (const move of legalMoves) {
      if (move.path.length > 0) {
        set.add(move.path[0] as number);
      }
    }
    return set as ReadonlySet<number>;
  }, [legalMoves]);

  // ── Derived state: selectable pieces ─────────────────────────────────
  const selectablePieces = useMemo(() => {
    if (multiJumpProgress !== null) {
      // During a multi-jump, only the jumping piece is selectable
      return new Set<number>(selectedSquare !== null ? [selectedSquare as number] : []);
    }
    const allMoves = getCurrentLegalMoves(gameState);
    const set = new Set<number>();
    for (const move of allMoves) {
      set.add(move.from as number);
    }
    return set as ReadonlySet<number>;
  }, [gameState, multiJumpProgress, selectedSquare]);

  // ── Effective board (after onTurnStart, e.g. Checks Mix shuffle) ─────
  const effectiveBoard: BoardState = useMemo(() => getEffectiveBoard(gameState), [gameState]);

  // ── Display board ────────────────────────────────────────────────────
  const displayBoard = intermediateBoard ?? effectiveBoard;

  // ── Core click handler ───────────────────────────────────────────────
  const handleSquareClick = useCallback(
    (sq: Square) => {
      // Suppress input during animation or when disabled (e.g., AI thinking)
      if (isAnimating || isDisabled) return;

      if (gameState.status !== GameStatus.InProgress) return;

      // ── MID-MULTI-JUMP phase ───────────────────────────────────────
      if (multiJumpProgress !== null && intermediateBoard !== null && selectedSquare !== null) {
        if (!legalDestinations.has(sq as number)) {
          // Clicked somewhere invalid during multi-jump — ignore
          return;
        }

        const captured = findCapturedForHop(selectedSquare, sq, legalMoves);
        if (captured === null) return;

        const applyHopResult = () => {
          const newBoard = applyPartialHop(intermediateBoard, selectedSquare, sq, captured);
          const newPath = [...multiJumpProgress.pathSoFar, sq];
          const newCaptured = [...multiJumpProgress.capturedSoFar, captured];

          // Check for continuations from the new landing
          const continuations = getContinuationJumps(newBoard, sq, gameState.activeEvents);

          // Notify about this hop for per-hop animation
          onHopComplete?.({ from: selectedSquare, to: sq, captured, boardAfter: newBoard });

          if (continuations.length > 0) {
            // More jumps available — stay in mid-multi-jump
            setSelectedSquare(sq);
            setIntermediateBoard(newBoard);
            setMultiJumpProgress({
              from: multiJumpProgress.from,
              pathSoFar: newPath,
              capturedSoFar: newCaptured,
            });
          } else {
            // Chain complete — assemble the full Move and execute
            const completeMove: Move = {
              from: multiJumpProgress.from,
              path: newPath,
              captured: newCaptured,
            };
            clearSelection();
            const newState = makeMove(gameState, completeMove);
            onMove(newState, { skipMoveAnimation: true });
          }
        };

        applyHopResult();

        return;
      }

      // ── IDLE or SELECTED phase ─────────────────────────────────────

      // Clicking a legal destination for the currently selected piece
      if (selectedSquare !== null && legalDestinations.has(sq as number)) {
        // Move confirmation: if enabled and this is the first click on a
        // destination, mark it as pending instead of executing.
        if (moveConfirmation && pendingConfirmSquare === null) {
          setPendingConfirmSquare(sq);
          return;
        }

        // Move confirmation: clicking a different destination than the pending
        // one switches the pending target.
        if (
          moveConfirmation &&
          pendingConfirmSquare !== null &&
          (sq as number) !== (pendingConfirmSquare as number)
        ) {
          setPendingConfirmSquare(sq);
          return;
        }

        // Either confirmation is off, or this is the confirming second click.
        setPendingConfirmSquare(null);

        const movesForDest = getMovesToSquare(legalMoves, sq);
        if (movesForDest.length === 0) return;

        const isJump = movesForDest.some((m) => m.captured.length > 0);

        if (isJump) {
          const captured = findCapturedForHop(selectedSquare, sq, legalMoves);
          if (captured === null) return;

          // Marching Orders: the 32-square board can't represent intermediate
          // light-square positions, so execute multi-jump moves atomically.
          //
          // Leapfrog: friendly-piece leapfrogs produce hops that have no
          // captured square, so per-hop click processing (which identifies
          // each hop by its captured piece) cannot encode a mixed chain of
          // friendly leapfrogs + enemy captures. Execute atomically instead.
          const marchingOrdersActive = gameState.activeEvents.some(
            e => e.type === CrazyEvent.MarchingOrders,
          );
          const leapfrogActive = gameState.activeEvents.some(
            e => e.type === CrazyEvent.Leapfrog,
          );
          if (marchingOrdersActive || leapfrogActive) {
            const fullMove = movesForDest.find(m => m.captured.length > 0);
            if (fullMove) {
              clearSelection();
              const newState = makeMove(gameState, fullMove);
              onMove(newState);
            }
            return;
          }

          const applyFirstHop = () => {
            const newBoard = applyPartialHop(effectiveBoard, selectedSquare, sq, captured);
            const continuations = getContinuationJumps(newBoard, sq, gameState.activeEvents);

            if (continuations.length > 0) {
              // Multi-jump: enter mid-multi-jump phase
              // Notify about first hop for per-hop animation
              onHopComplete?.({ from: selectedSquare, to: sq, captured, boardAfter: newBoard });
              setSelectedSquare(sq);
              setIntermediateBoard(newBoard);
              setMultiJumpProgress({
                from: selectedSquare,
                pathSoFar: [sq],
                capturedSoFar: [captured],
              });
            } else {
              // Single jump — execute immediately
              const completeMove: Move = {
                from: selectedSquare,
                path: [sq],
                captured: [captured],
              };
              clearSelection();
              const newState = makeMove(gameState, completeMove);
              onMove(newState);
            }
          };

          applyFirstHop();
        } else {
          // Simple move (no capture)
          const move = movesForDest[0];
          if (move) {
            clearSelection();
            const newState = makeMove(gameState, move);
            onMove(newState);
          }
        }

        return;
      }

      // Clicking a piece of the active color — select it (or switch selection)
      // Use getPieceAtSquare to handle Marching Orders light squares (33-64)
      const piece = getPieceAtSquare(effectiveBoard, sq, gameState.activeEvents);
      if (piece !== null && piece.color === gameState.activeColor) {
        if (selectablePieces.has(sq as number)) {
          setSelectedSquare(sq);
          setMultiJumpProgress(null);
          setIntermediateBoard(null);
          setPendingConfirmSquare(null);
        }
        return;
      }

      // Clicked an empty / opponent square that isn't a legal destination — deselect
      clearSelection();
    },
    [
      gameState,
      effectiveBoard,
      selectedSquare,
      legalDestinations,
      legalMoves,
      multiJumpProgress,
      intermediateBoard,
      selectablePieces,
      pendingConfirmSquare,
      moveConfirmation,
      onMove,
      onHopComplete,
      clearSelection,
      isAnimating,
      isDisabled,
    ],
  );

  return {
    selectedSquare: selectedSquare,
    legalDestinations,
    displayBoard,
    handleSquareClick,
    handleEscape,
    isMidMultiJump: multiJumpProgress !== null,
    selectablePieces,
    pendingConfirmSquare,
  };
}
