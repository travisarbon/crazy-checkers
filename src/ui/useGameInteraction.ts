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
import { getBoardSquare, gridToSquare, squareToGrid } from '../engine/board';
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
  /**
   * True when this hop is a continuation within an already-started multi-jump
   * (hop index >= 1). False for the first hop of a chain. Used to select a
   * lighter SFX for continuation jumps.
   */
  isContinuation: boolean;
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

  /** The effective board after onTurnStart event transformations (Task 23.2). */
  effectiveBoard: BoardState;
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
 * and (optionally) the captured piece removed. Used for rendering and for
 * computing continuation jumps during a multi-jump chain. `captured` may be
 * null for friendly leapfrog hops, which do not remove the leapt-over piece.
 */
function applyPartialHop(
  board: BoardState,
  from: Square,
  to: Square,
  captured: Square | null,
): BoardState {
  const newBoard = [...board] as SquareState[];
  const piece = getBoardSquare(board, from);
  newBoard[(from as number) - 1] = null;
  if (captured !== null) {
    newBoard[(captured as number) - 1] = null;
  }
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
 * Returns the dark squares strictly between two dark squares `a` and `b` that
 * lie on the same diagonal, in order from `a` toward `b`. Empty array if they
 * are not on a common diagonal or either is an extended (light) square.
 */
function diagonalSquaresBetween(a: Square, b: Square): Square[] {
  if ((a as number) > 32 || (b as number) > 32) return [];
  const g1 = squareToGrid(a);
  const g2 = squareToGrid(b);
  const dRow = g2.row - g1.row;
  const dCol = g2.col - g1.col;
  if (Math.abs(dRow) !== Math.abs(dCol) || dRow === 0) return [];
  const stepRow = Math.sign(dRow);
  const stepCol = Math.sign(dCol);
  const out: Square[] = [];
  let r = g1.row + stepRow;
  let c = g1.col + stepCol;
  while (r !== g2.row && c !== g2.col) {
    const sq = gridToSquare(r, c);
    if (sq === null) return [];
    out.push(sq);
    r += stepRow;
    c += stepCol;
  }
  return out;
}

/**
 * Resolves a single hop click against a list of candidate full-chain moves.
 * Returns `{ matched: true, capturedSquare }` where `capturedSquare` is the
 * piece removed by this hop, or null for a friendly leapfrog hop.
 *
 * Handles three variants: (a) standard 2-diagonal jumps where the captured
 * piece is at the midpoint, (b) flying jumps (Up in the Air) where the
 * captured piece lies anywhere along the diagonal between `fromStep` and
 * `toStep`, and (c) Leapfrog chains whose `captured` array has fewer entries
 * than `path` (friendly leapfrog hops contribute no capture).
 */
interface HopResolution {
  readonly matched: boolean;
  readonly capturedSquare: Square | null;
}

function resolveHop(
  fromStep: Square,
  toStep: Square,
  candidateMoves: readonly Move[],
): HopResolution {
  for (const move of candidateMoves) {
    // Find the index at which `toStep` appears in the move path.
    const hopIndex = move.path.findIndex(p => (p as number) === (toStep as number));
    if (hopIndex < 0) continue;

    // Verify that the previous step matches `fromStep` (move.from for the
    // first hop, or the prior path entry for continuations).
    const prevSq = hopIndex === 0 ? move.from : move.path[hopIndex - 1];
    if (prevSq === undefined || (prevSq as number) !== (fromStep as number)) continue;

    // Walk the diagonal between fromStep and toStep and find which square
    // (if any) is this move's captured piece for this hop. For standard
    // jumps the diagonal has a single midpoint; for flying jumps it may
    // have multiple empty squares and one capture; for friendly leapfrog
    // hops no square on the diagonal appears in `move.captured`.
    const between = diagonalSquaresBetween(fromStep, toStep);
    const capturedSet = new Set(move.captured.map(c => c as number));
    let capturedHere: Square | null = null;
    for (const mid of between) {
      if (capturedSet.has(mid as number)) {
        capturedHere = mid;
        break;
      }
    }
    return { matched: true, capturedSquare: capturedHere };
  }
  return { matched: false, capturedSquare: null };
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

    if (intermediateBoard !== null && multiJumpProgress !== null) {
      // Mid-multi-jump: project the full legal chains (including Leapfrog's
      // mixed friendly-leapfrog + enemy-capture chains) whose path prefix
      // matches what the player has already clicked. This gives us the set
      // of valid next-hop destinations without re-deriving them from the
      // intermediate board (which would miss friendly leapfrogs).
      const allMoves = getCurrentLegalMoves(gameState);
      const prefix = multiJumpProgress.pathSoFar;
      const originSq = multiJumpProgress.from;
      const matching: Move[] = [];
      for (const m of allMoves) {
        if ((m.from as number) !== (originSq as number)) continue;
        if (m.path.length <= prefix.length) continue;
        let ok = true;
        for (let i = 0; i < prefix.length; i++) {
          if ((m.path[i] as number) !== (prefix[i] as number)) { ok = false; break; }
        }
        if (!ok) continue;
        // Surface the move as-is; callers filter by path[prefix.length].
        matching.push(m);
      }

      // Fall back to engine continuation detection if the full-chain lookup
      // yields nothing (e.g. caller is inspecting a non-Leapfrog state).
      if (matching.length === 0) {
        return getContinuationJumps(intermediateBoard, selectedSquare, gameState.activeEvents);
      }
      return matching;
    }

    // Use getCurrentLegalMoves (routes through CompositeEventRuleSet) and filter.
    // Use numeric comparison so extended square numbers (33-64 from Marching Orders) work.
    const allMoves = getCurrentLegalMoves(gameState);
    return allMoves.filter((m) => (m.from as number) === (selectedSquare as number));
  }, [selectedSquare, intermediateBoard, multiJumpProgress, gameState]);

  // ── Derived state: destination squares ───────────────────────────────
  const legalDestinations = useMemo(() => {
    const set = new Set<number>();
    // During mid-multi-jump we index into the next path step (after the
    // clicks already committed). Otherwise (idle/selected) the valid
    // destination is the first step of each move.
    const pathIndex = multiJumpProgress !== null ? multiJumpProgress.pathSoFar.length : 0;
    for (const move of legalMoves) {
      const step = move.path[pathIndex];
      if (step !== undefined) {
        set.add(step as number);
      }
    }
    return set as ReadonlySet<number>;
  }, [legalMoves, multiJumpProgress]);

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

        // Candidate full-chain moves at this depth whose next path step is `sq`.
        const prefix = multiJumpProgress.pathSoFar;
        const candidateMoves = legalMoves.filter(
          (m) =>
            m.path.length > prefix.length &&
            (m.path[prefix.length] as number) === (sq as number),
        );
        const hop = resolveHop(selectedSquare, sq, candidateMoves);
        if (!hop.matched) return;

        const applyHopResult = () => {
          const newBoard = applyPartialHop(intermediateBoard, selectedSquare, sq, hop.capturedSquare);
          const newPath = [...multiJumpProgress.pathSoFar, sq];
          const newCaptured = hop.capturedSquare !== null
            ? [...multiJumpProgress.capturedSoFar, hop.capturedSquare]
            : multiJumpProgress.capturedSoFar;

          // Any candidate move has content past this step → chain continues
          const hasContinuation = candidateMoves.some(m => m.path.length > newPath.length);

          // Notify about this hop for per-hop animation
          onHopComplete?.({
            from: selectedSquare,
            to: sq,
            captured: hop.capturedSquare ?? selectedSquare,
            boardAfter: newBoard,
            isContinuation: true,
          });

          if (hasContinuation) {
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
          // Marching Orders: the 32-square board can't represent intermediate
          // light-square positions, so execute multi-jump moves atomically.
          const marchingOrdersActive = gameState.activeEvents.some(
            e => e.type === CrazyEvent.MarchingOrders,
          );
          if (marchingOrdersActive) {
            const fullMove = movesForDest.find(m => m.captured.length > 0);
            if (fullMove) {
              clearSelection();
              const newState = makeMove(gameState, fullMove);
              onMove(newState);
            }
            return;
          }

          // Candidate full-chain moves whose first step is this square.
          const candidateMoves = legalMoves.filter(
            (m) => (m.path[0] as number) === (sq as number) && m.captured.length > 0,
          );
          const hop = resolveHop(selectedSquare, sq, candidateMoves);
          if (!hop.matched) return;

          const applyFirstHop = () => {
            const newBoard = applyPartialHop(effectiveBoard, selectedSquare, sq, hop.capturedSquare);
            const hasContinuation = candidateMoves.some(m => m.path.length > 1);
            const initialCaptured: Square[] = hop.capturedSquare !== null
              ? [hop.capturedSquare]
              : [];

            if (hasContinuation) {
              onHopComplete?.({
                from: selectedSquare,
                to: sq,
                captured: hop.capturedSquare ?? selectedSquare,
                boardAfter: newBoard,
                isContinuation: false,
              });
              setSelectedSquare(sq);
              setIntermediateBoard(newBoard);
              setMultiJumpProgress({
                from: selectedSquare,
                pathSoFar: [sq],
                capturedSoFar: initialCaptured,
              });
            } else {
              // Single-hop move — execute immediately.
              const completeMove: Move = {
                from: selectedSquare,
                path: [sq],
                captured: initialCaptured,
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
    effectiveBoard,
  };
}
