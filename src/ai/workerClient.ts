/**
 * Main-thread client for the AI Web Worker.
 *
 * Encapsulates worker lifecycle: lazy initialization, Comlink wrapping,
 * and a main-thread fallback if the Worker cannot be created.
 */

import { wrap, type Remote } from 'comlink';
import type { GameState, Move } from '../engine/types';
import type { Difficulty } from './difficulty';
import { getDifficultyConfig, toSearchConfig, selectMove } from './difficulty';
import { iterativeSearch } from './search';
import type { WorkerApi, SerializableGameState } from './worker';

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Strips the ruleSet from a GameState and adds a ruleSetId.
 * The resulting object is safe for structured clone (postMessage).
 */
function serializeGameState(state: GameState): SerializableGameState {
  const { ruleSet: _, ...rest } = state;
  void _;
  return {
    ...rest,
    ruleSetId: 'american',
    mode: state.mode,
    activeEvents: state.activeEvents.map((e) => ({
      type: e.type,
      remainingPlies: e.remainingPlies,
      triggeredBy: e.triggeredBy,
      triggeredAtPly: e.triggeredAtPly,
      ...(e.metadata !== undefined ? { metadata: { ...e.metadata } } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let workerApi: Remote<WorkerApi> | null = null;
let fallbackMode = false;

/**
 * Lazily initializes the AI Web Worker.
 * Returns the Comlink-wrapped API, or null if worker creation fails.
 */
function getWorkerApi(): Remote<WorkerApi> | null {
  if (fallbackMode) return null;
  if (workerApi) return workerApi;

  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerApi = wrap<WorkerApi>(worker);
    return workerApi;
  } catch (error) {
    console.warn('Failed to create AI Web Worker. Falling back to main-thread computation.', error);
    fallbackMode = true;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main-thread fallback
// ---------------------------------------------------------------------------

function mainThreadFallback(state: GameState, difficulty: Difficulty): Move {
  const config = getDifficultyConfig(difficulty);
  const searchConfig = toSearchConfig(config);

  // Apply onTurnStart to get the effective board (e.g. Checks Mix shuffle).
  let effectiveBoard = state.board;
  if (state.ruleSet.onTurnStart) {
    effectiveBoard = state.ruleSet.onTurnStart(state.board, state.activeColor);
  }
  const effectiveState: GameState = effectiveBoard !== state.board
    ? { ...state, board: effectiveBoard }
    : state;

  const searchResult = iterativeSearch(effectiveState, searchConfig);
  const legalMoves = state.ruleSet.getLegalMoves(effectiveBoard, state.activeColor);

  return selectMove(searchResult, searchResult.rootMoveScores, legalMoves, config);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Hard timeout for an AI move request, in milliseconds. Some Choice-mode
 * events (ChecksMix, Conscription, Ricochet, etc.) can send the minimax
 * search into pathological branching. Without a timeout the game would
 * hang forever. When we time out, we terminate the worker and return a
 * random legal move so the game always progresses.
 */
const AI_MOVE_TIMEOUT_MS = 10_000;

function pickRandomLegalMove(state: GameState): Move {
  let effectiveBoard = state.board;
  if (state.ruleSet.onTurnStart) {
    effectiveBoard = state.ruleSet.onTurnStart(state.board, state.activeColor);
  }
  const legalMoves = state.ruleSet.getLegalMoves(effectiveBoard, state.activeColor);
  if (legalMoves.length === 0) {
    throw new Error('AI fallback: no legal moves available');
  }
  const index = Math.floor(Math.random() * legalMoves.length);
  return legalMoves[index] as Move;
}

/**
 * Requests an AI move for the given game state and difficulty.
 *
 * Delegates to the Web Worker if available, otherwise falls back to
 * main-thread computation (blocking, but functional). Enforces a hard
 * timeout so the UI can never hang on a runaway search.
 */
export async function requestAIMove(state: GameState, difficulty: Difficulty): Promise<Move> {
  const api = getWorkerApi();

  const computation: Promise<Move> = api
    ? (async () => {
        const serialized = serializeGameState(state);
        return api.getAIMove(serialized, difficulty);
      })()
    : Promise.resolve(mainThreadFallback(state, difficulty));

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('AI_TIMEOUT'));
    }, AI_MOVE_TIMEOUT_MS);
  });

  try {
    const move = await Promise.race([computation, timeout]);
    return move;
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_TIMEOUT') {
      console.warn(
        `AI move timed out after ${String(AI_MOVE_TIMEOUT_MS)}ms; terminating worker and returning random legal move.`,
      );
      terminateWorker();
      return pickRandomLegalMove(state);
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/**
 * Terminates the Web Worker and releases resources.
 * Safe to call multiple times. After termination, the next requestAIMove
 * call will create a fresh worker.
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    workerApi = null;
  }
}

/**
 * Resets internal state (worker references and fallback mode).
 * Intended for testing only.
 */
export function _resetForTesting(): void {
  terminateWorker();
  fallbackMode = false;
}
