/**
 * Puzzle-specific click-to-select, click-to-move interaction hook.
 *
 * Unlike useGameInteraction, this hook validates moves against a solution
 * path before applying them. Incorrect moves are rejected with a callback
 * rather than being applied to the game state.
 *
 * Handles multi-jump chains by tracking intermediate board state and
 * assembling the full move before validation.
 */

import { useState, useCallback, useMemo } from 'react';
import type { BoardState, GameState, Move, Square } from '../engine/types';
import { GameStatus } from '../engine/types';
import { getBoardSquare } from '../engine/board';
import { getJumpsForPiece } from '../engine/moves';
import { getCurrentLegalMoves, makeMove } from '../engine/game';
import { moveToString } from '../utils/notation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsePuzzleInteractionOptions {
  /** Current game state. */
  readonly gameState: GameState;

  /** Whether animations or opponent moves are in progress. */
  readonly isBlocked: boolean;

  /** Whether the puzzle is solved. */
  readonly isSolved: boolean;

  /** Called when the player completes a correct move. */
  readonly onCorrectMove: (move: Move, newState: GameState) => void;

  /** Called when the player attempts an incorrect move. */
  readonly onIncorrectMove: (move: Move) => void;

  /** Expected move notation from the solution path. */
  readonly expectedNotation: string | undefined;
}

export interface UsePuzzleInteractionResult {
  /** Currently selected piece square. */
  readonly selectedSquare: Square | null;

  /** Legal destination squares for the selected piece. */
  readonly legalDestinations: ReadonlySet<number>;

  /** Board to display (intermediate during multi-jump). */
  readonly displayBoard: BoardState;

  /** Click handler for the Board component. */
  readonly handleSquareClick: (sq: Square) => void;

  /** Escape key handler (deselects). */
  readonly handleEscape: () => void;

  /** Whether mid-multi-jump. */
  readonly isMidMultiJump: boolean;

  /** Pieces with legal moves (for cursor affordance). */
  readonly selectablePieces: ReadonlySet<number>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function applyPartialHop(
  board: BoardState,
  from: Square,
  to: Square,
  captured: Square,
): BoardState {
  const newBoard = [...board];
  const piece = getBoardSquare(board, from);
  newBoard[(from as number) - 1] = null;
  newBoard[(captured as number) - 1] = null;
  newBoard[(to as number) - 1] = piece;
  return newBoard;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePuzzleInteraction({
  gameState,
  isBlocked,
  isSolved,
  onCorrectMove,
  onIncorrectMove,
  expectedNotation,
}: UsePuzzleInteractionOptions): UsePuzzleInteractionResult {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [multiJumpProgress, setMultiJumpProgress] = useState<{
    from: Square;
    pathSoFar: Square[];
    capturedSoFar: Square[];
  } | null>(null);
  const [intermediateBoard, setIntermediateBoard] = useState<BoardState | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setMultiJumpProgress(null);
    setIntermediateBoard(null);
  }, []);

  // Compute legal moves for current state
  const legalMoves = useMemo(() => {
    if (gameState.status !== GameStatus.InProgress || isSolved) return [];
    return getCurrentLegalMoves(gameState);
  }, [gameState, isSolved]);

  // Selectable pieces = pieces with legal moves
  const selectablePieces = useMemo(() => {
    const set = new Set<number>();
    for (const move of legalMoves) {
      set.add(move.from as number);
    }
    return set;
  }, [legalMoves]);

  // Legal destinations for selected piece
  const legalDestinations = useMemo(() => {
    const set = new Set<number>();
    if (selectedSquare === null) return set;

    if (multiJumpProgress && intermediateBoard) {
      // Mid-multi-jump: show continuation jumps
      const continuations = getJumpsForPiece(intermediateBoard, selectedSquare);
      for (const move of continuations) {
        const dest = move.path[0];
        if (dest !== undefined) set.add(dest as number);
      }
    } else {
      // Normal selection
      for (const move of legalMoves) {
        if ((move.from as number) === (selectedSquare as number)) {
          const dest = move.path[0];
          if (dest !== undefined) set.add(dest as number);
        }
      }
    }
    return set;
  }, [selectedSquare, legalMoves, multiJumpProgress, intermediateBoard]);

  const displayBoard = intermediateBoard ?? gameState.board;

  const handleSquareClick = useCallback((sq: Square) => {
    if (isBlocked || isSolved) return;

    const sqNum = sq as number;
    const currentBoard = intermediateBoard ?? gameState.board;
    const piece = getBoardSquare(currentBoard, sq);

    // ── Mid-multi-jump ────────────────────────────────────────
    if (multiJumpProgress && intermediateBoard) {
      // Click on a legal continuation destination
      if (legalDestinations.has(sqNum)) {
        const continuations = getJumpsForPiece(intermediateBoard, selectedSquare as Square);
        const hop = continuations.find(
          (m) => m.path.length > 0 && (m.path[0] as number) === sqNum,
        );
        if (!hop || hop.captured.length === 0) return;

        const capturedSq = hop.captured[0] as Square;
        const newBoard = applyPartialHop(intermediateBoard, selectedSquare as Square, sq, capturedSq);

        const newPath = [...multiJumpProgress.pathSoFar, sq];
        const newCaptured = [...multiJumpProgress.capturedSoFar, capturedSq];

        // Check for further continuations
        const furtherJumps = getJumpsForPiece(newBoard, sq);
        if (furtherJumps.length > 0) {
          // Continue the chain
          setMultiJumpProgress({
            from: multiJumpProgress.from,
            pathSoFar: newPath,
            capturedSoFar: newCaptured,
          });
          setIntermediateBoard(newBoard);
          setSelectedSquare(sq);
          return;
        }

        // Chain complete — assemble full move and validate
        const fullMove: Move = {
          from: multiJumpProgress.from,
          path: newPath,
          captured: newCaptured,
        };
        const notation = moveToString(fullMove);
        clearSelection();

        if (notation === expectedNotation) {
          const newState = makeMove(gameState, fullMove);
          onCorrectMove(fullMove, newState);
        } else {
          onIncorrectMove(fullMove);
        }
        return;
      }

      // Click elsewhere during multi-jump — ignore
      return;
    }

    // ── No selection yet — select a piece ─────────────────────
    if (selectedSquare === null) {
      if (piece !== null && piece.color === gameState.activeColor && selectablePieces.has(sqNum)) {
        setSelectedSquare(sq);
      }
      return;
    }

    // ── Already selected — click on a different friendly piece ──
    if (piece !== null && piece.color === gameState.activeColor && selectablePieces.has(sqNum)) {
      setSelectedSquare(sq);
      return;
    }

    // ── Click on a legal destination ──────────────────────────
    if (legalDestinations.has(sqNum)) {
      // Find the matching move
      const matchingMoves = legalMoves.filter(
        (m) => (m.from as number) === (selectedSquare as number) &&
               m.path.length > 0 && (m.path[0] as number) === sqNum,
      );
      const move = matchingMoves[0];
      if (!move) return;

      // Check if this is the start of a multi-jump chain
      if (move.captured.length > 0) {
        const capturedSq = move.captured[0] as Square;
        const firstDest = move.path[0] as Square;
        const newBoard = applyPartialHop(gameState.board, selectedSquare, firstDest, capturedSq);

        // Check for continuation jumps
        const continuations = getJumpsForPiece(newBoard, firstDest);
        if (continuations.length > 0) {
          // Start multi-jump chain
          setMultiJumpProgress({
            from: selectedSquare,
            pathSoFar: [firstDest],
            capturedSoFar: [capturedSq],
          });
          setIntermediateBoard(newBoard);
          setSelectedSquare(firstDest);
          return;
        }
      }

      // Simple move or single jump — validate immediately
      const singleMove: Move = {
        from: selectedSquare,
        path: [sq],
        captured: move.captured,
      };
      const notation = moveToString(singleMove);
      clearSelection();

      if (notation === expectedNotation) {
        const newState = makeMove(gameState, singleMove);
        onCorrectMove(singleMove, newState);
      } else {
        onIncorrectMove(singleMove);
      }
      return;
    }

    // Click on non-destination — deselect
    clearSelection();
  }, [
    isBlocked, isSolved, gameState, selectedSquare, legalMoves, legalDestinations,
    selectablePieces, multiJumpProgress, intermediateBoard, expectedNotation,
    onCorrectMove, onIncorrectMove, clearSelection,
  ]);

  const handleEscape = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return {
    selectedSquare,
    legalDestinations,
    displayBoard,
    handleSquareClick,
    handleEscape,
    isMidMultiJump: multiJumpProgress !== null,
    selectablePieces,
  };
}
