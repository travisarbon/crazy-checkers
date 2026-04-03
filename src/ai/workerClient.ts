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
  const searchResult = iterativeSearch(state, searchConfig);
  const legalMoves = state.ruleSet.getLegalMoves(state.board, state.activeColor);

  return selectMove(searchResult, searchResult.rootMoveScores, legalMoves, config);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Requests an AI move for the given game state and difficulty.
 *
 * Delegates to the Web Worker if available, otherwise falls back to
 * main-thread computation (blocking, but functional).
 */
export async function requestAIMove(state: GameState, difficulty: Difficulty): Promise<Move> {
  const api = getWorkerApi();

  if (api) {
    const serialized = serializeGameState(state);
    return api.getAIMove(serialized, difficulty);
  }

  // Fallback: run on main thread (blocks UI, but game remains playable)
  return mainThreadFallback(state, difficulty);
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
