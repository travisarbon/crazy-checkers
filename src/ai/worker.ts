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
// Rule set registry (Task 27.4 — X-04 closure)
// ---------------------------------------------------------------------------

/**
 * Mutable rule-set registry keyed by `ruleSetId` with a public
 * `registerRuleSet` / `getRuleSet` API. Replaces the closed `const` object
 * that Task 27.1 flagged as delta X-04. Lazy-factory entries ensure each
 * `getRuleSet` call returns a fresh rule-set instance — important for
 * CompositeEventRuleSet which is stateful.
 *
 * Classified games register their Phase-1-compatible rule-set factories
 * here at import time (the ClassifiedRuleSet itself does not satisfy the
 * Phase 1 `RuleSet` signature, so Task 27.4 registers a wrapper when one is
 * supplied via `spec.workerRuleSetFactory`; otherwise Classified deserialize
 * paths use the Task 27.6 state-serialiser surface).
 */
const ruleSetRegistry = new Map<string, () => RuleSet>();
ruleSetRegistry.set('american', createAmericanRules);

/** Install or replace a rule-set factory. Exported for Classified registration. */
export function registerRuleSet(id: string, factory: () => RuleSet): void {
  ruleSetRegistry.set(id, factory);
}

/** Resolve a rule-set id. Returns null when the id is unknown. */
export function getRuleSet(id: string): RuleSet | null {
  const factory = ruleSetRegistry.get(id);
  return factory ? factory() : null;
}

/** Inspect which rule-set ids are currently registered (diagnostics). */
export function listRegisteredRuleSetIds(): readonly string[] {
  return [...ruleSetRegistry.keys()];
}

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

  const base = getRuleSet(data.ruleSetId);
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

// ---------------------------------------------------------------------------
// Classified Draughts AI (Task 28.5)
// ---------------------------------------------------------------------------

import type { ClassifiedGameState, ClassifiedPiece } from '../engine/classified/state';
import type { NodeId } from '../engine/boardGeometry';
import { asNodeId } from '../engine/boardGeometry';
import type { DraughtsGameId } from '../engine/classified/draughts/DraughtsConfig';
import { createDraughtsConfig, TIER_1_DRAUGHTS_GAME_IDS } from '../engine/classified/draughts/DraughtsConfig';
import type { DraughtsMove } from '../engine/classified/draughts/moveGen';
import { createDraughtsRuleSet } from '../engine/classified/draughts/ParameterizedDraughtsRules';
import { getDraughtsWeights } from './evaluators/draughts/weights';
import { getDraughtsDifficultyConfig } from './evaluators/draughts/difficultyPresets';
import {
  classifiedIterativeSearch,
  selectClassifiedMove,
} from './evaluators/draughts/classifiedSearch';
import { evaluateDraughtsPosition } from './evaluators/draughts/DraughtsEvaluator';
import { normalizeDraughtsScore } from './evaluators/draughts/DraughtsEvaluationProvider';

/**
 * Serializable form of a ClassifiedGameState.
 * `pieces` is encoded as an array of `[nodeIdNumber, piece]` tuples
 * because `Map` is not structured-clone-transferable.
 */
export interface SerializableClassifiedDraughtsState {
  readonly gameId: DraughtsGameId;
  readonly pieces: ReadonlyArray<readonly [number, { owner: string; kind: string }]>;
  readonly turn: 'white' | 'black';
  readonly plyCount: number;
  readonly moveHistory: readonly DraughtsMove[];
  readonly meta?: Readonly<Record<string, unknown>>;
}

const DRAUGHTS_ID_SET: ReadonlySet<string> = new Set<string>(TIER_1_DRAUGHTS_GAME_IDS);

/** Check if a ruleSetId is a Tier 1 draughts variant. */
export function isDraughtsGameId(ruleSetId: string): ruleSetId is DraughtsGameId {
  return DRAUGHTS_ID_SET.has(ruleSetId);
}

/** Reconstruct a ClassifiedGameState from serializable form. */
function deserializeClassifiedDraughtsState(
  data: SerializableClassifiedDraughtsState,
): ClassifiedGameState {
  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (const [rawId, piece] of data.pieces) {
    pieces.set(asNodeId(rawId), { owner: piece.owner, kind: piece.kind });
  }
  return {
    pieces,
    turn: data.turn,
    plyCount: data.plyCount,
    moveHistory: data.moveHistory,
    meta: data.meta,
  };
}

/**
 * Computes the AI move for a Classified draughts game.
 */
export function getClassifiedDraughtsAIMove(
  data: SerializableClassifiedDraughtsState,
  difficulty: Difficulty,
): DraughtsMove {
  const state = deserializeClassifiedDraughtsState(data);
  const config = createDraughtsConfig(data.gameId);
  const weights = getDraughtsWeights(data.gameId);
  const diffConfig = getDraughtsDifficultyConfig(config, difficulty);

  const ruleSet = createDraughtsRuleSet(config);

  const searchResult = classifiedIterativeSearch(
    state,
    ruleSet,
    config,
    weights,
    diffConfig,
  );

  const legalMoves = ruleSet.getLegalMoves(state);
  return selectClassifiedMove(searchResult, legalMoves, diffConfig);
}

/**
 * Evaluates a Classified draughts position for Cogitate.
 */
export function evaluateClassifiedDraughtsPosition(
  data: SerializableClassifiedDraughtsState,
): NormalizedEvaluation {
  const state = deserializeClassifiedDraughtsState(data);
  const config = createDraughtsConfig(data.gameId);
  const weights = getDraughtsWeights(data.gameId);
  const ruleSet = createDraughtsRuleSet(config);

  const moves = ruleSet.getLegalMoves(state);
  const raw = evaluateDraughtsPosition(state, config, weights, moves.length);
  const { score, isTerminal } = normalizeDraughtsScore(
    raw,
    data.turn,
    weights.sigmoidK,
  );

  return {
    score,
    rawScore: raw,
    isTerminal,
    confidence: 1,
  };
}

// ---------------------------------------------------------------------------
// Tier 2 Classified AI entry point (Task 29.7)
// ---------------------------------------------------------------------------

import {
  getTier2Dispatch,
  getTier2DifficultyConfig,
  tier2IterativeSearch,
} from './evaluators/tier2';
import type { ClassifiedGameId, ClassifiedMove } from '../engine/classified/ClassifiedRuleSet';

/**
 * Serializable form of a Tier 2 ClassifiedGameState.
 * `pieces` is `[nodeIdNumber, piece]` tuples since `Map` isn't transferable.
 */
export interface SerializableClassifiedTier2State {
  readonly gameId: string;
  readonly pieces: ReadonlyArray<readonly [number, { owner: string; kind: string; promoted?: boolean; stack?: ReadonlyArray<{ owner: string; kind: string }> }]>;
  readonly turn: 'white' | 'black';
  readonly plyCount: number;
  readonly moveHistory: readonly ClassifiedMove[];
  readonly meta?: Readonly<Record<string, unknown>>;
}

function deserializeClassifiedTier2State(
  data: SerializableClassifiedTier2State,
): ClassifiedGameState {
  const pieces = new Map<NodeId, ClassifiedPiece>();
  for (const [rawId, piece] of data.pieces) {
    const value: ClassifiedPiece = piece.stack
      ? { owner: piece.owner, kind: piece.kind, stack: piece.stack as ClassifiedPiece['stack'] }
      : piece.promoted === true
        ? { owner: piece.owner, kind: piece.kind, promoted: true }
        : { owner: piece.owner, kind: piece.kind };
    pieces.set(asNodeId(rawId), value);
  }
  return {
    pieces,
    turn: data.turn,
    plyCount: data.plyCount,
    moveHistory: data.moveHistory,
    meta: data.meta,
  };
}

/**
 * Computes the AI move for a Tier 2 Classified game. Generic dispatch via
 * gameId. Returns `null` only when the position has zero legal moves.
 */
export function getClassifiedTier2AIMove(
  data: SerializableClassifiedTier2State,
  difficulty: 'easy' | 'hard',
): ClassifiedMove | null {
  const gameId = data.gameId as unknown as ClassifiedGameId;
  const dispatch = getTier2Dispatch(gameId);
  const state = deserializeClassifiedTier2State(data);
  const config = getTier2DifficultyConfig({ gameId, level: difficulty });
  const result = tier2IterativeSearch(state, dispatch.ruleSet, dispatch.evaluate, config);
  return result.move;
}

const workerApi = {
  getAIMove,
  analyzePosition,
  batchAnalyze,
  evaluatePosition,
  cancelAnalysis,
  getClassifiedDraughtsAIMove,
  evaluateClassifiedDraughtsPosition,
  isDraughtsGameId,
  getClassifiedTier2AIMove,
};
export type WorkerApi = typeof workerApi;

expose(workerApi);
