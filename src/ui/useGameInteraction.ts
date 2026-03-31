/**
 * Custom hook encapsulating the click-to-select, click-to-move interaction model.
 *
 * Manages a three-phase state machine: idle → selected → mid-multi-jump.
 * Produces the props that Board needs for highlights, click handling, and
 * cursor affordance.
 */

import { useState, useCallback, useMemo } from 'react';
import type { BoardState, GameState, Move, Square, SquareState } from '../engine/types';
import { GameStatus } from '../engine/types';
import { getBoardSquare } from '../engine/board';
import { getLegalMovesForPiece, getMovesToSquare, getJumpsForPiece } from '../engine/moves';
import { makeMove, getCurrentLegalMoves } from '../engine/game';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseGameInteractionOptions {
  /** The current game state. */
  gameState: GameState;

  /** Callback invoked when a complete move is executed. Receives the new GameState. */
  onMove: (newState: GameState) => void;

  /** Whether an animation is currently playing (suppresses input). */
  isAnimating?: boolean;
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
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
  isAnimating = false,
}: UseGameInteractionOptions): UseGameInteractionResult {
  // ── Internal state ───────────────────────────────────────────────────
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [multiJumpProgress, setMultiJumpProgress] = useState<{
    from: Square;
    pathSoFar: Square[];
    capturedSoFar: Square[];
  } | null>(null);
  const [intermediateBoard, setIntermediateBoard] = useState<BoardState | null>(null);

  // ── clearSelection helper ────────────────────────────────────────────
  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setMultiJumpProgress(null);
    setIntermediateBoard(null);
  }, []);

  const handleEscape = useCallback(() => {
    if (isAnimating) return;
    clearSelection();
  }, [clearSelection, isAnimating]);

  // ── Reset selection when game state changes externally ───────────────
  const [trackedPly, setTrackedPly] = useState(gameState.plyCount);
  if (gameState.plyCount !== trackedPly) {
    setTrackedPly(gameState.plyCount);
    if (selectedSquare !== null || multiJumpProgress !== null) {
      setSelectedSquare(null);
      setMultiJumpProgress(null);
      setIntermediateBoard(null);
    }
  }

  // ── Derived state: legal moves for selected piece ────────────────────
  const legalMoves = useMemo(() => {
    if (selectedSquare === null) return [];

    if (intermediateBoard !== null) {
      // Mid-multi-jump: only continuation jumps from the current landing
      return getJumpsForPiece(intermediateBoard, selectedSquare);
    }

    // Normal selection: all legal moves for this piece (respects mandatory capture)
    return getLegalMovesForPiece(gameState.board, selectedSquare);
  }, [selectedSquare, intermediateBoard, gameState.board]);

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

  // ── Display board ────────────────────────────────────────────────────
  const displayBoard = intermediateBoard ?? gameState.board;

  // ── Core click handler ───────────────────────────────────────────────
  const handleSquareClick = useCallback(
    (sq: Square) => {
      // Suppress input during animation
      if (isAnimating) return;

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
          const continuations = getJumpsForPiece(newBoard, sq);

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
            onMove(newState);
          }
        };

        applyHopResult();

        return;
      }

      // ── IDLE or SELECTED phase ─────────────────────────────────────

      // Clicking a legal destination for the currently selected piece
      if (selectedSquare !== null && legalDestinations.has(sq as number)) {
        const movesForDest = getMovesToSquare(legalMoves, sq);
        if (movesForDest.length === 0) return;

        const isJump = movesForDest.some((m) => m.captured.length > 0);

        if (isJump) {
          const captured = findCapturedForHop(selectedSquare, sq, legalMoves);
          if (captured === null) return;

          const applyFirstHop = () => {
            const newBoard = applyPartialHop(gameState.board, selectedSquare, sq, captured);
            const continuations = getJumpsForPiece(newBoard, sq);

            if (continuations.length > 0) {
              // Multi-jump: enter mid-multi-jump phase
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
      const piece = getBoardSquare(gameState.board, sq);
      if (piece !== null && piece.color === gameState.activeColor) {
        if (selectablePieces.has(sq as number)) {
          setSelectedSquare(sq);
          setMultiJumpProgress(null);
          setIntermediateBoard(null);
        }
        return;
      }

      // Clicked an empty / opponent square that isn't a legal destination — deselect
      clearSelection();
    },
    [
      gameState,
      selectedSquare,
      legalDestinations,
      legalMoves,
      multiJumpProgress,
      intermediateBoard,
      selectablePieces,
      onMove,
      clearSelection,
      isAnimating,
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
  };
}
