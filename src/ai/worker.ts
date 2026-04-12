/**
 * Web Worker entry point wrapping the AI search.
 * Exposes getAIMove via Comlink for off-thread computation.
 */

import { expose } from 'comlink';
import type { ActiveEvent, BoardState, GameState, Move, PieceColor, RuleSet } from '../engine/types';
import type { CrazyEvent, GameResult, PlayerSetup, GameStatus } from '../engine/types';
import { GameMode } from '../engine/types';
import type { Difficulty } from './difficulty';
import { getDifficultyConfig, toSearchConfig, selectMove } from './difficulty';
import { iterativeSearch } from './search';
import { createAmericanRules } from '../engine/rules';
import { createCompositeRuleSet } from '../engine/compositeRuleSet';

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
  readonly mode: string;
  readonly activeEvents: readonly SerializableActiveEvent[];
}

interface SerializableActiveEvent {
  readonly type: string;
  readonly remainingPlies: number;
  readonly triggeredBy: string;
  readonly triggeredAtPly: number;
  readonly permanent?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
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
  const mode = data.mode as GameMode;

  const activeEvents: ActiveEvent[] = data.activeEvents.map((e) => ({
    type: e.type as CrazyEvent,
    remainingPlies: e.remainingPlies,
    triggeredBy: e.triggeredBy as PieceColor,
    triggeredAtPly: e.triggeredAtPly,
    ...(e.permanent === true ? { permanent: true } : {}),
    ...(e.metadata !== undefined ? { metadata: e.metadata } : {}),
  }));

  const base = RULE_SET_REGISTRY[data.ruleSetId];
  if (!base) throw new Error(`Unknown ruleSetId: ${data.ruleSetId}`);

  let ruleSet: RuleSet;
  if (mode === GameMode.Crazy || mode === GameMode.Choice || mode === GameMode.Chaos) {
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents(activeEvents);
    ruleSet = composite;
  } else {
    ruleSet = base;
  }

  return {
    board: data.board,
    activeColor: data.activeColor,
    status: data.status,
    result: data.result,
    players: data.players,
    moveHistory: data.moveHistory,
    positionHashes: data.positionHashes,
    halfMoveClock: data.halfMoveClock,
    plyCount: data.plyCount,
    ruleSet,
    mode,
    activeEvents,
  };
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

  // Apply onTurnStart to get the effective board (e.g. Checks Mix shuffle).
  // Legal moves and search must use the transformed board.
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

const workerApi = { getAIMove };
export type WorkerApi = typeof workerApi;

expose(workerApi);
