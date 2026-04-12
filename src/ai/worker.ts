/**
 * Web Worker entry point wrapping the AI search.
 * Exposes getAIMove via Comlink for off-thread computation.
 * Also exposes Cogitate analysis methods: analyzePosition, batchAnalyze,
 * evaluatePosition, cancelAnalysis (Task 21.1).
 */

import { expose } from 'comlink';
import type { ActiveEvent, BoardState, GameState, Move, PieceColor, RuleSet } from '../engine/types';
import type { CrazyEvent, GameResult, PlayerSetup } from '../engine/types';
import { GameMode, GameStatus, PlayerType } from '../engine/types';
import type { Difficulty } from './difficulty';
import { getDifficultyConfig, toSearchConfig, selectMove } from './difficulty';
import { iterativeSearch } from './search';
import type { SearchConfig } from './search';
import { createAmericanRules } from '../engine/rules';
import { createCompositeRuleSet } from '../engine/compositeRuleSet';
import type { SerializedActiveEvent } from '../persistence/serialization';
import { createRuleSet, hasRuleSetFactory } from '../cogitate/RuleSetFactory';
import type { AnalysisResult, NormalizedEvaluation } from '../cogitate/types';
import {
  normalizeRawScore,
} from '../cogitate/EvaluationProvider';
import { evaluate } from './evaluator';
import { evaluateWithEvents } from './eventEvalWeights';
import { moveToString } from '../utils/notation';

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

// ---------------------------------------------------------------------------
// Cogitate analysis API (Task 21.1)
// ---------------------------------------------------------------------------

const DEFAULT_PLAYERS: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.Human,
};

let cancellationRequested = false;

/** Resets the cancellation flag. */
function resetCancellation(): void {
  cancellationRequested = false;
}

function buildRuleSetForAnalysis(
  modeId: string,
  activeEvents: readonly SerializedActiveEvent[],
): { ruleSet: RuleSet; eventContext: readonly ActiveEvent[] } {
  const events: ActiveEvent[] = activeEvents.map((e) => ({
    type: e.type as CrazyEvent,
    remainingPlies: e.remainingPlies,
    triggeredBy: e.triggeredBy as PieceColor,
    triggeredAtPly: e.triggeredAtPly,
    ...(e.metadata !== undefined ? { metadata: e.metadata } : {}),
  }));
  let ruleSet: RuleSet;
  if (hasRuleSetFactory(modeId)) {
    ruleSet = createRuleSet(modeId, activeEvents);
  } else {
    // Fallback: treat unknown modes as classic American rules.
    ruleSet = createAmericanRules();
  }
  return { ruleSet, eventContext: events };
}

function buildStateForAnalysis(
  board: BoardState,
  activeColor: PieceColor,
  ruleSet: RuleSet,
  eventContext: readonly ActiveEvent[],
  modeId: string,
): GameState {
  const mode: GameMode =
    modeId === 'classic'
      ? GameMode.Classic
      : modeId === 'chaos'
        ? GameMode.Chaos
        : modeId === 'crazy'
          ? GameMode.Crazy
          : modeId.startsWith('choice-')
            ? GameMode.Choice
            : GameMode.Classic;
  return {
    board,
    activeColor,
    status: GameStatus.InProgress,
    result: null,
    ruleSet,
    players: DEFAULT_PLAYERS,
    moveHistory: [],
    positionHashes: [],
    halfMoveClock: 0,
    plyCount: 0,
    mode,
    activeEvents: eventContext,
  };
}

export function analyzePosition(
  board: BoardState,
  activeColor: PieceColor,
  modeId: string,
  activeEvents: readonly SerializedActiveEvent[],
  config: SearchConfig,
): AnalysisResult {
  const { ruleSet, eventContext } = buildRuleSetForAnalysis(modeId, activeEvents);
  const state = buildStateForAnalysis(board, activeColor, ruleSet, eventContext, modeId);

  const searchConfig: SearchConfig = { ...config, collectPV: true };
  const result = iterativeSearch(state, searchConfig);

  const sorted = [...result.rootMoveScores].sort((a, b) => b.score - a.score);
  const topAlternatives = sorted.slice(0, 3).map((entry) => {
    const { score: normalized } = normalizeRawScore(entry.score, activeColor);
    return {
      move: entry.move,
      notation: moveToString(entry.move),
      score: entry.score,
      normalizedScore: normalized,
    };
  });

  const { score: normalizedBest } = normalizeRawScore(result.score, activeColor);
  const pv = result.pv ?? (result.move ? [result.move] : []);
  const pvNotation = pv.map((m) => moveToString(m));

  return {
    evaluation: normalizedBest,
    bestMove: result.move,
    bestMoveNotation: result.move ? moveToString(result.move) : '',
    principalVariation: pv,
    pvNotation,
    alternativeMoves: topAlternatives,
    depth: result.depth,
    nodesEvaluated: result.nodesEvaluated,
    rawScore: result.score,
  };
}

export function batchAnalyze(
  positions: ReadonlyArray<{
    board: BoardState;
    activeColor: PieceColor;
    activeEvents: readonly SerializedActiveEvent[];
  }>,
  modeId: string,
  config: SearchConfig,
): AnalysisResult[] {
  resetCancellation();
  const out: AnalysisResult[] = [];
  for (const pos of positions) {
    if (cancellationRequested) break;
    out.push(analyzePosition(pos.board, pos.activeColor, modeId, pos.activeEvents, config));
  }
  return out;
}

export function evaluatePosition(
  board: BoardState,
  activeColor: PieceColor,
  modeId: string,
  activeEvents: readonly SerializedActiveEvent[],
): NormalizedEvaluation {
  const { eventContext } = buildRuleSetForAnalysis(modeId, activeEvents);
  const raw =
    eventContext.length > 0
      ? evaluateWithEvents(board, activeColor, eventContext)
      : evaluate(board, activeColor);
  const { score, isTerminal } = normalizeRawScore(raw, activeColor);
  return {
    score,
    rawScore: raw,
    isTerminal,
    confidence: 1,
  };
}

export function cancelAnalysis(): void {
  cancellationRequested = true;
}

const workerApi = {
  getAIMove,
  analyzePosition,
  batchAnalyze,
  evaluatePosition,
  cancelAnalysis,
};
export type WorkerApi = typeof workerApi;

expose(workerApi);
