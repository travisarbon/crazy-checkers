/**
 * Web Worker entry point wrapping the AI search.
 * Exposes getAIMove via Comlink for off-thread computation.
 */

import { expose } from 'comlink';
import type { BoardState, GameState, Move, PieceColor, RuleSet } from '../engine/types';
import type { GameResult, PlayerSetup, GameStatus } from '../engine/types';
import type { Difficulty } from './difficulty';
import { getDifficultyConfig, toSearchConfig, selectMove } from './difficulty';
import { iterativeSearch } from './search';
import { createAmericanRules } from '../engine/rules';

// ---------------------------------------------------------------------------
// Serialization types
// ---------------------------------------------------------------------------

/**
 * A GameState stripped of non-serializable fields (ruleSet) and annotated
 * with a ruleSetId so the worker can reconstruct the full state.
 *
 * All fields use only structured-clone-compatible types:
 * primitives, plain objects, arrays, and bigints.
 */
export interface SerializableGameState {
  readonly board: BoardState;
  readonly activeColor: PieceColor;
  readonly status: GameStatus;
  readonly result: GameResult | null;
  readonly players: PlayerSetup;
  readonly moveHistory: readonly Move[];
  readonly positionHashes: readonly bigint[];
  readonly halfMoveClock: number;
  readonly plyCount: number;
  readonly ruleSetId: string;
}

// ---------------------------------------------------------------------------
// Rule set registry
// ---------------------------------------------------------------------------

/** Maps ruleSetId strings to RuleSet instances. */
const RULE_SET_REGISTRY: Record<string, RuleSet> = {
  american: createAmericanRules(),
};

/**
 * Reconstructs a full GameState from the serialized form.
 * @throws Error if the ruleSetId is not recognized.
 */
export function deserializeGameState(data: SerializableGameState): GameState {
  const ruleSet = RULE_SET_REGISTRY[data.ruleSetId];
  if (!ruleSet) {
    throw new Error(`Unknown ruleSetId: ${data.ruleSetId}`);
  }
  const { ruleSetId: _, ...rest } = data;
  void _;
  return { ...rest, ruleSet };
}

// ---------------------------------------------------------------------------
// Worker API
// ---------------------------------------------------------------------------

/**
 * Computes the AI's move for the given game state and difficulty.
 *
 * This function runs on the worker thread. Comlink handles serialization
 * of the input and output across the postMessage boundary.
 */
export function getAIMove(data: SerializableGameState, difficulty: Difficulty): Move {
  const state = deserializeGameState(data);
  const config = getDifficultyConfig(difficulty);
  const searchConfig = toSearchConfig(config);
  const searchResult = iterativeSearch(state, searchConfig);
  const legalMoves = state.ruleSet.getLegalMoves(state.board, state.activeColor);

  return selectMove(
    searchResult,
    searchResult.rootMoveScores,
    legalMoves,
    config,
  );
}

const workerApi = { getAIMove };
export type WorkerApi = typeof workerApi;

expose(workerApi);
