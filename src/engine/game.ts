/**
 * Game state machine: turn flow, win/draw detection, undo, resignation.
 *
 * Pure functions that produce new GameState objects without side effects.
 * The UI (Zustand store) and AI (Web Worker) consume these functions.
 */

import type { ActiveEvent, GameResult, GameState, Move, Piece, PlayerSetup, RuleSet, Square } from './types';
import {
  GameEndReason,
  GameMode,
  GameResultType,
  GameStatus,
  opponentColor,
  PieceColor,
  PieceType,
  PlayerType,
} from './types';
import { createInitialBoard, getBoardSquare } from './board';
import { computeZobristHash, isRepetition, updateZobristHash } from './zobrist';
import { checkEventTrigger, createActiveEvent, EVENT_METADATA_FACTORIES, removeEventsByType, resolveConflicts, tickAllEvents } from './events';
import type { CompositeEventRuleSet } from './compositeRuleSet';
import { createCompositeRuleSet } from './compositeRuleSet';

/** Half-move clock threshold for the 40-move draw rule (40 moves x 2 sides). */
const FORTY_MOVE_THRESHOLD = 80;

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

/**
 * Creates a new game in the InProgress state with the standard starting position.
 *
 * For Crazy mode, the provided ruleSet is wrapped in a CompositeEventRuleSet
 * internally. Callers continue to pass the base RuleSet (e.g., AmericanRules).
 */
export function createNewGame(
  ruleSet: RuleSet,
  players: PlayerSetup,
  mode: GameMode = GameMode.Classic,
): GameState {
  const board = createInitialBoard();
  const activeColor = PieceColor.White;
  const initialHash = computeZobristHash(board, activeColor);

  const effectiveRuleSet =
    mode === GameMode.Crazy ? createCompositeRuleSet(ruleSet) : ruleSet;

  return {
    board,
    activeColor,
    status: GameStatus.InProgress,
    result: null,
    ruleSet: effectiveRuleSet,
    players,
    moveHistory: [],
    positionHashes: [initialHash],
    halfMoveClock: 0,
    plyCount: 0,
    mode,
    activeEvents: [],
  };
}

// ---------------------------------------------------------------------------
// Move equality
// ---------------------------------------------------------------------------

/**
 * Checks structural equality of two Move objects.
 */
export function movesAreEqual(a: Move, b: Move): boolean {
  if ((a.from as number) !== (b.from as number)) return false;
  if (a.path.length !== b.path.length) return false;
  if (a.captured.length !== b.captured.length) return false;
  for (let i = 0; i < a.path.length; i++) {
    if ((a.path[i] as number) !== (b.path[i] as number)) return false;
  }
  for (let i = 0; i < a.captured.length; i++) {
    if ((a.captured[i] as number) !== (b.captured[i] as number)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Type guard: checks if a RuleSet is a CompositeEventRuleSet.
 * Uses duck-typing to keep game.ts loosely coupled to the composite implementation.
 */
function isCompositeRuleSet(ruleSet: RuleSet): ruleSet is CompositeEventRuleSet {
  return (
    'setActiveEvents' in ruleSet &&
    typeof (ruleSet as CompositeEventRuleSet).setActiveEvents === 'function'
  );
}

// ---------------------------------------------------------------------------
// Core turn-advance function
// ---------------------------------------------------------------------------

/**
 * Applies a move to the current game state, producing a new GameState.
 *
 * Orchestrates the full turn lifecycle:
 * 1. Validate the game is in progress and the move is legal.
 * 2. Call optional ruleSet hooks (onTurnStart, onCapture, onTurnEnd).
 * 3. Apply the move via the ruleSet.
 * 4. Compute new Zobrist hash.
 * 5. Update half-move clock, switch active color.
 * 6. Check for game-over conditions (win + draws).
 *
 * @throws Error if the game is not in progress or the move is not legal.
 */
export function makeMove(state: GameState, move: Move): GameState {
  // ── Validation ──────────────────────────────────────────────────────
  if (state.status !== GameStatus.InProgress) {
    throw new Error('Cannot make a move: game is not in progress.');
  }

  // ── Sync event context ─────────────────────────────────────────────
  const activeEvents = state.activeEvents;
  if (isCompositeRuleSet(state.ruleSet)) {
    state.ruleSet.setActiveEvents(activeEvents);
  }

  const legalMoves = state.ruleSet.getLegalMoves(state.board, state.activeColor);
  if (!legalMoves.some((m) => movesAreEqual(m, move))) {
    throw new Error('Illegal move.');
  }

  // ── onTurnStart hook ────────────────────────────────────────────────
  let board = state.board;
  if (state.ruleSet.onTurnStart) {
    board = state.ruleSet.onTurnStart(board, state.activeColor);
  }

  // ── Snapshot captured pieces before removal ─────────────────────────
  const capturedPieces: Array<{ sq: Square; piece: Piece }> = [];
  for (const sq of move.captured) {
    const piece = getBoardSquare(board, sq);
    if (piece !== null) {
      capturedPieces.push({ sq, piece });
    }
  }

  // ── Snapshot the moving piece before apply ──────────────────────────
  const movingPiece = getBoardSquare(board, move.from);
  if (movingPiece === null) {
    throw new Error(`No piece at move origin square ${String(move.from)}`);
  }

  // ── Apply the move ──────────────────────────────────────────────────
  board = state.ruleSet.applyMove(board, move);

  // ── onCapture hook ──────────────────────────────────────────────────
  if (move.captured.length > 0 && state.ruleSet.onCapture) {
    const landingSquare = move.path[move.path.length - 1];
    if (landingSquare !== undefined) {
      board = state.ruleSet.onCapture(board, landingSquare, [...move.captured]);
    }
  }

  // ── Drain pending removals after onCapture ──────────────────────────
  let updatedEvents: readonly ActiveEvent[] = activeEvents;
  if (isCompositeRuleSet(state.ruleSet)) {
    const removals = state.ruleSet.drainPendingRemovals();
    for (const type of removals) {
      updatedEvents = removeEventsByType(updatedEvents, type);
    }
  }

  // ── onTurnEnd hook ──────────────────────────────────────────────────
  if (state.ruleSet.onTurnEnd) {
    board = state.ruleSet.onTurnEnd(board, state.activeColor, move);
  }

  // ── Drain pending removals after onTurnEnd ─────────────────────────
  if (isCompositeRuleSet(state.ruleSet)) {
    const removals = state.ruleSet.drainPendingRemovals();
    for (const type of removals) {
      updatedEvents = removeEventsByType(updatedEvents, type);
    }
  }

  // ── Determine the landing piece (for Zobrist update) ────────────────
  const finalSquare = move.path[move.path.length - 1];
  if (finalSquare === undefined) {
    throw new Error('makeMove: move has empty path');
  }
  const landingPiece = getBoardSquare(board, finalSquare);

  // ── Compute new Zobrist hash ────────────────────────────────────────
  const nextColor = opponentColor(state.activeColor);
  let newHash: bigint;

  // If hooks modified the board beyond the move, incremental update
  // would be incorrect. Use full recomputation when hooks are present.
  const hasHooks = !!(
    state.ruleSet.onTurnStart ??
    state.ruleSet.onTurnEnd ??
    state.ruleSet.onCapture
  );
  if (!hasHooks && landingPiece !== null) {
    newHash = updateZobristHash(
      state.positionHashes[state.positionHashes.length - 1] ?? 0n,
      move,
      movingPiece,
      landingPiece,
      capturedPieces,
    );
  } else {
    newHash = computeZobristHash(board, nextColor);
  }

  // ── Update half-move clock ──────────────────────────────────────────
  const isCapture = move.captured.length > 0;
  const isPawnAdvance = movingPiece.type === PieceType.Pawn;
  const halfMoveClock = isCapture || isPawnAdvance ? 0 : state.halfMoveClock + 1;

  // ── Assemble position hash history ──────────────────────────────────
  const newPositionHashes = [...state.positionHashes, newHash];

  // ── Check for game-over conditions ──────────────────────────────────
  let status: GameStatus = GameStatus.InProgress;
  let result: GameResult | null = null;

  // Board-state conditions via the rule set
  let boardResult = state.ruleSet.checkGameOver(board, nextColor);

  // onCheckGameOver hook (Phase 2)
  if (state.ruleSet.onCheckGameOver) {
    boardResult = state.ruleSet.onCheckGameOver(board, nextColor, boardResult);
  }

  if (boardResult !== null) {
    status = GameStatus.GameOver;
    result = boardResult;
  }

  // Threefold repetition
  if (status === GameStatus.InProgress && isRepetition(newPositionHashes, newHash, 3)) {
    status = GameStatus.GameOver;
    result = { type: GameResultType.Draw, reason: GameEndReason.Repetition };
  }

  // 40-move rule (80 half-moves)
  if (status === GameStatus.InProgress && halfMoveClock >= FORTY_MOVE_THRESHOLD) {
    status = GameStatus.GameOver;
    result = { type: GameResultType.Draw, reason: GameEndReason.FortyMoveRule };
  }

  // ── Tick existing event durations (Crazy mode only) ─────────────────
  if (state.mode === GameMode.Crazy && updatedEvents.length > 0) {
    updatedEvents = tickAllEvents(updatedEvents);
    updatedEvents = resolveConflicts(updatedEvents);
  }

  // ── Event trigger on multi-jump (Crazy mode only) ──────────────────
  if (state.mode === GameMode.Crazy) {
    const triggeredEvents = checkEventTrigger(move, state.mode);
    if (triggeredEvents !== null) {
      const newEvents: ActiveEvent[] = [];
      for (const eventType of triggeredEvents) {
        // Build event-specific metadata via the registry
        const metadataFactory = EVENT_METADATA_FACTORIES.get(eventType);
        const metadata = metadataFactory ? metadataFactory(board, state.activeColor) : undefined;

        newEvents.push(createActiveEvent(
          eventType,
          state.activeColor,
          state.plyCount + 1,
          metadata,
        ));
      }
      updatedEvents = [...updatedEvents, ...newEvents];
    }
  }

  // ── Return new state ────────────────────────────────────────────────
  return {
    board,
    activeColor: nextColor,
    status,
    result,
    ruleSet: state.ruleSet,
    players: state.players,
    moveHistory: [...state.moveHistory, move],
    positionHashes: newPositionHashes,
    halfMoveClock,
    plyCount: state.plyCount + 1,
    mode: state.mode,
    activeEvents: updatedEvents,
  };
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

/**
 * Returns true if an undo is possible from an engine perspective.
 * Policy enforcement (unlimited / one takeback / none) is the UI's responsibility.
 */
export function canUndo(state: GameState): boolean {
  if (state.plyCount === 0) return false;
  if (state.status === GameStatus.GameOver) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Resignation
// ---------------------------------------------------------------------------

/**
 * Returns a new GameState with the game ended by resignation.
 * @throws Error if the game is not in progress.
 */
export function resign(state: GameState, resigningColor: PieceColor): GameState {
  if (state.status !== GameStatus.InProgress) {
    throw new Error('Cannot resign: game is not in progress.');
  }

  const winner =
    resigningColor === PieceColor.White ? GameResultType.BlackWin : GameResultType.WhiteWin;

  return {
    ...state,
    status: GameStatus.GameOver,
    result: { type: winner, reason: GameEndReason.Resignation },
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Returns the legal moves for the active player in the current state. */
export function getCurrentLegalMoves(state: GameState): Move[] {
  if (state.status !== GameStatus.InProgress) return [];

  // Sync active events for CompositeEventRuleSet
  if (isCompositeRuleSet(state.ruleSet)) {
    state.ruleSet.setActiveEvents(state.activeEvents);
  }

  return state.ruleSet.getLegalMoves(state.board, state.activeColor);
}

/** Returns the PlayerType for the currently active color. */
export function getActivePlayerType(state: GameState): PlayerType {
  return state.activeColor === PieceColor.White ? state.players.white : state.players.black;
}

/** Returns true if the active player is a CPU. */
export function isAITurn(state: GameState): boolean {
  const pt = getActivePlayerType(state);
  return pt === PlayerType.CpuEasy || pt === PlayerType.CpuHard;
}
