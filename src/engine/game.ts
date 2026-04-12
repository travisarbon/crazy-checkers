/**
 * Game state machine: turn flow, win/draw detection, undo, resignation.
 *
 * Pure functions that produce new GameState objects without side effects.
 * The UI (Zustand store) and AI (Web Worker) consume these functions.
 */

import type { ActiveEvent, BoardState, GameResult, GameState, Move, Piece, PlayerSetup, RuleSet, Square } from './types';
import {
  CrazyEvent,
  GameEndReason,
  GameMode,
  GameResultType,
  GameStatus,
  opponentColor,
  PieceColor,
  PieceType,
  PlayerType,
} from './types';
import { BOARD_SIZE, createInitialBoard, getBoardSquare } from './board';
import { computeZobristHash, isRepetition, updateZobristHash } from './zobrist';
import { checkEventTrigger, createActiveEvent, EVENT_METADATA_FACTORIES, removeEventsByType, resolveConflicts, selectRandomEvent, tickAllEvents } from './events';
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
  eventRandomFn?: () => number,
): GameState {
  const board = createInitialBoard();
  const activeColor = PieceColor.White;
  const initialHash = computeZobristHash(board, activeColor);

  const effectiveRuleSet =
    mode === GameMode.Crazy || mode === GameMode.Choice || mode === GameMode.Chaos
      ? createCompositeRuleSet(ruleSet)
      : ruleSet;

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
    eventRandomFn,
  };
}

/**
 * Creates a new Choice mode game with a permanent event pre-seeded.
 *
 * The permanent event is created with remainingPlies = -1 (condition-based /
 * never expires via ticking) and triggeredBy = PieceColor.White (convention
 * for mode-selected events, as opposed to gameplay-triggered events).
 *
 * For Extra Crazy (permanentEvent = null), creates a standard Choice mode
 * game with empty activeEvents. The event-on-every-jump behavior is handled
 * by the event trigger logic in makeMove.
 */
export function createNewChoiceGame(
  ruleSet: RuleSet,
  players: PlayerSetup,
  permanentEvent: CrazyEvent | null,
  eventRandomFn?: () => number,
): GameState {
  const base = createNewGame(ruleSet, players, GameMode.Choice, eventRandomFn);

  if (permanentEvent === null) {
    // Extra Crazy: no permanent event, events trigger on every jump
    return base;
  }

  // Create a permanent ActiveEvent
  const metadataFactory = EVENT_METADATA_FACTORIES.get(permanentEvent);
  const metadata = metadataFactory
    ? metadataFactory(base.board, PieceColor.White)
    : undefined;

  const permanentActiveEvent: ActiveEvent = {
    type: permanentEvent,
    remainingPlies: -1,
    triggeredBy: PieceColor.White,
    triggeredAtPly: 0,
    permanent: true,
    metadata,
  };

  const activeEvents = [permanentActiveEvent];

  // Set the active events on the CompositeEventRuleSet so the first
  // getLegalMoves call reflects the permanent event's rule modifications
  if (isCompositeRuleSet(base.ruleSet)) {
    base.ruleSet.setActiveEvents(activeEvents);
  }

  return {
    ...base,
    activeEvents,
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

/**
 * Applies pending metadata updates to the active events list.
 * For each update, replaces the metadata of the newest matching event entry.
 */
function applyMetadataUpdates(
  events: readonly ActiveEvent[],
  updates: ReadonlyArray<{ type: CrazyEvent; metadata: Readonly<Record<string, unknown>> }>,
): readonly ActiveEvent[] {
  if (updates.length === 0) return events;
  const result = [...events];
  for (const { type, metadata } of updates) {
    // Update the newest (last) matching entry
    for (let i = result.length - 1; i >= 0; i--) {
      const entry = result[i];
      if (entry !== undefined && entry.type === type) {
        result[i] = { ...entry, metadata };
        break;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Core turn-advance function
// ---------------------------------------------------------------------------

/**
 * Applies a move to the current game state, producing a new GameState.
 *
 * Orchestrates the full turn lifecycle:
 * 1. Apply onTurnStart hooks (e.g., Checks Mix board shuffle).
 * 2. Validate the move is legal on the transformed board.
 * 3. Apply the move via the ruleSet.
 * 4. Call optional ruleSet hooks (onCapture, onTurnEnd).
 * 5. Compute new Zobrist hash.
 * 6. Update half-move clock, switch active color.
 * 7. Check for game-over conditions (win + draws).
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

  // ── onTurnStart hook (BEFORE validation) ────────────────────────────
  // Instant events like Checks Mix transform the board at the start of
  // the turn. Legal moves must be computed on the transformed board so
  // validation matches what the UI displayed via getEffectiveBoard().
  let board = state.board;
  if (state.ruleSet.onTurnStart) {
    board = state.ruleSet.onTurnStart(board, state.activeColor);
  }

  const legalMoves = state.ruleSet.getLegalMoves(board, state.activeColor);
  if (!legalMoves.some((m) => movesAreEqual(m, move))) {
    throw new Error('Illegal move.');
  }

  // ── Snapshot captured pieces before removal ─────────────────────────
  // Extended squares (> 32) are used by Marching Orders for light-square
  // pieces that live only in the event's 64-element grid metadata.
  // getBoardSquare only handles 1–32, so skip it for extended squares.
  const capturedPieces: Array<{ sq: Square; piece: Piece }> = [];
  for (const sq of move.captured) {
    if ((sq as number) <= BOARD_SIZE) {
      const piece = getBoardSquare(board, sq);
      if (piece !== null) {
        capturedPieces.push({ sq, piece });
      }
    }
  }

  // ── Snapshot the moving piece before apply ──────────────────────────
  // For standard dark-square moves (from ≤ 32), the piece must exist on
  // the board. Extended squares (> 32) are Marching Orders light-square
  // pieces that live only in the event's 64-element grid metadata.
  let movingPiece: Piece | null = null;
  if ((move.from as number) <= BOARD_SIZE) {
    movingPiece = getBoardSquare(board, move.from);
    if (movingPiece === null) {
      throw new Error(
        `makeMove: no piece at square ${String(move.from as number)} on the 32-square board.`,
      );
    }
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
    // ── Apply pending metadata updates after onTurnEnd ────────────────
    const metadataUpdates = state.ruleSet.drainPendingMetadataUpdates();
    updatedEvents = applyMetadataUpdates(updatedEvents, metadataUpdates);
  }

  // ── Check suppress-turn-switch signal (Double Time) ────────────────
  const suppressTurnSwitch =
    isCompositeRuleSet(state.ruleSet) && state.ruleSet.drainSuppressTurnSwitch();

  // ── Determine the landing piece (for Zobrist update) ────────────────
  const finalSquare = move.path[move.path.length - 1];
  if (finalSquare === undefined) {
    throw new Error('makeMove: move has empty path');
  }
  const landingPiece = getBoardSquare(board, finalSquare);

  // ── Compute new Zobrist hash ────────────────────────────────────────
  const nextColor = suppressTurnSwitch ? state.activeColor : opponentColor(state.activeColor);
  let newHash: bigint;

  // If hooks modified the board beyond the move, incremental update
  // would be incorrect. Use full recomputation when hooks are present.
  const hasHooks = !!(
    state.ruleSet.onTurnStart ??
    state.ruleSet.onTurnEnd ??
    state.ruleSet.onCapture
  );
  if (!hasHooks && movingPiece !== null && landingPiece !== null) {
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
  const isPawnAdvance = movingPiece !== null && movingPiece.type === PieceType.Pawn;
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

  // Threefold repetition — skip when permanent events are active (Choice mode)
  // because event hooks (onTurnStart, onTurnEnd) transform the board in ways
  // that make Zobrist hashes unreliable for position comparison.
  const hasPermanentEvents = updatedEvents.some(e => e.permanent === true);
  if (status === GameStatus.InProgress && !hasPermanentEvents && isRepetition(newPositionHashes, newHash, 3)) {
    status = GameStatus.GameOver;
    result = { type: GameResultType.Draw, reason: GameEndReason.Repetition };
  }

  // 40-move rule (80 half-moves)
  if (status === GameStatus.InProgress && halfMoveClock >= FORTY_MOVE_THRESHOLD) {
    status = GameStatus.GameOver;
    result = { type: GameResultType.Draw, reason: GameEndReason.FortyMoveRule };
  }

  // ── Tick existing event durations (any mode with active events) ─────
  // Skip tick when turn switch is suppressed (Double Time first sub-move)
  // so both sub-moves count as a single ply for duration purposes.
  if (updatedEvents.length > 0 && !suppressTurnSwitch) {
    updatedEvents = tickAllEvents(updatedEvents);
    updatedEvents = resolveConflicts(updatedEvents);
  }

  // ── Event trigger (Crazy, Chaos, and Extra Crazy modes) ─────────────
  // Extra Crazy = Choice mode with no permanent event: any jump (1+ captures)
  // triggers a single random event. All other Choice modes must NOT trigger
  // random events — their permanent event is their only event.
  const hasPermanentEvent = state.activeEvents.some(e => e.permanent === true);
  const isExtraCrazy = state.mode === GameMode.Choice && !hasPermanentEvent;
  const isChoiceWithPermanent = state.mode === GameMode.Choice && hasPermanentEvent;

  if (
    !isChoiceWithPermanent
    && (state.mode === GameMode.Crazy || state.mode === GameMode.Chaos || isExtraCrazy)
  ) {
    let triggeredEvents: CrazyEvent[] | null = null;

    if (isExtraCrazy) {
      // Extra Crazy: single random event on every jump (1+ captures)
      if (move.captured.length >= 1) {
        triggeredEvents = selectRandomEvent(state.eventRandomFn ?? Math.random);
      }
    } else {
      triggeredEvents = checkEventTrigger(move, state.mode, state.eventRandomFn);
    }

    if (triggeredEvents !== null) {
      const newEvents: ActiveEvent[] = [];
      for (const eventType of triggeredEvents) {
        // Build event-specific metadata via the registry
        const metadataFactory = EVENT_METADATA_FACTORIES.get(eventType);
        const metadata = metadataFactory ? metadataFactory(board, state.activeColor, undefined, move) : undefined;

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
    eventRandomFn: state.eventRandomFn,
  };
}

// ---------------------------------------------------------------------------
// Zero-legal-moves detection (stalemate)
// ---------------------------------------------------------------------------

/**
 * Checks if the active player has zero legal moves and, if so, transitions
 * the game to GameOver with the appropriate result.
 *
 * This handles the edge case where combined event decorators (e.g., Marching
 * Orders + NoTouching, Marching Orders + Frozen Assets) collectively produce
 * zero legal moves mid-game without capturing all pieces. Without this check,
 * the game would hang because makeMove requires a move to advance.
 *
 * Should be called:
 * - By the self-play harness at the top of each loop iteration.
 * - By the UI after each makeMove dispatch.
 *
 * Returns the state unchanged if the game is not in progress or if the
 * active player has legal moves.
 */
export function checkForStalemate(state: GameState): GameState {
  if (state.status !== GameStatus.InProgress) return state;

  const legalMoves = getCurrentLegalMoves(state);
  if (legalMoves.length > 0) return state;

  // Zero legal moves — determine game result
  // Check if the active player has any pieces left
  let pieceCount = 0;
  for (let i = 0; i < state.board.length; i++) {
    const piece = state.board[i];
    if (piece !== null && piece !== undefined && piece.color === state.activeColor) {
      pieceCount++;
    }
  }

  const reason = pieceCount === 0 ? GameEndReason.NoPiecesLeft : GameEndReason.NoLegalMoves;
  const type =
    state.activeColor === PieceColor.White ? GameResultType.BlackWin : GameResultType.WhiteWin;

  return {
    ...state,
    status: GameStatus.GameOver,
    result: { type, reason },
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

/**
 * Returns the board after applying onTurnStart hooks (e.g., Checks Mix shuffle).
 * The UI should display this board rather than raw state.board when instant
 * events are pending. Deterministic: seeded events produce the same result
 * on every call for the same state.
 */
export function getEffectiveBoard(state: GameState): BoardState {
  if (state.status !== GameStatus.InProgress) return state.board;

  if (isCompositeRuleSet(state.ruleSet)) {
    state.ruleSet.setActiveEvents(state.activeEvents);
  }

  if (state.ruleSet.onTurnStart) {
    return state.ruleSet.onTurnStart(state.board, state.activeColor);
  }

  return state.board;
}

/** Returns the legal moves for the active player in the current state. */
export function getCurrentLegalMoves(state: GameState): Move[] {
  if (state.status !== GameStatus.InProgress) return [];

  // Sync active events for CompositeEventRuleSet
  if (isCompositeRuleSet(state.ruleSet)) {
    state.ruleSet.setActiveEvents(state.activeEvents);
  }

  // Apply onTurnStart so legal moves reflect instant board transformations
  // (e.g., Checks Mix shuffle). Must match what makeMove uses for validation.
  const board = state.ruleSet.onTurnStart
    ? state.ruleSet.onTurnStart(state.board, state.activeColor)
    : state.board;

  return state.ruleSet.getLegalMoves(board, state.activeColor);
}

/**
 * Returns legal moves using a pre-computed effective board.
 *
 * Used by the self-play harness to ensure the search and legal-move
 * computation share a single onTurnStart application, avoiding PRNG
 * double-consumption by instant events like ChecksMix.
 */
export function getLegalMovesFromBoard(state: GameState, effectiveBoard: BoardState): Move[] {
  if (state.status !== GameStatus.InProgress) return [];

  if (isCompositeRuleSet(state.ruleSet)) {
    state.ruleSet.setActiveEvents(state.activeEvents);
  }

  return state.ruleSet.getLegalMoves(effectiveBoard, state.activeColor);
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
