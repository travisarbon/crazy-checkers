/**
 * Training session engine (Task 21.4).
 *
 * Loads training positions from analyzed games in IndexedDB, evaluates the
 * player's attempted moves against the engine's recommendation, and computes
 * incremental session statistics.
 *
 * UI-agnostic. Consumed by `useTrainingSession` and `TrainingTool`.
 */

import type { ActiveEvent, BoardState, Move, PieceColor, RuleSet } from '../engine/types';
import { PieceColor as PC } from '../engine/types';
import type { SerializedActiveEvent } from '../persistence/serialization';
import type { GameRecord } from '../persistence/gameHistory';
import {
  getAllGameRecords as defaultGetAllGameRecords,
  getGameRecord as defaultGetGameRecord,
} from '../persistence/gameHistory';
import type { CogitateGameAdapter } from './CogitateGameAdapter';
import {
  ANALYSIS_SEARCH_CONFIG,
  type AnalysisResult,
  type EvaluatedMove,
  type MoveQuality,
  type NormalizedEvaluation,
} from './types';
import { classifyMove } from './analysisEngine';
import { requestAnalysis as defaultRequestAnalysis } from '../ai/workerClient';
import { deserializeActiveEvents } from '../ui/cogitate/useReplayNavigation';
import { resolveGameRecord } from '../persistence/gameModeRegistry';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TrainingPosition {
  readonly plyIndex: number;
  readonly board: BoardState;
  readonly activeColor: PieceColor;
  readonly activeEvents: readonly ActiveEvent[];
  readonly serializedEvents: readonly SerializedActiveEvent[];
  readonly ruleSet: RuleSet;
  readonly analysisResult: AnalysisResult;
  readonly gameId: string;
  readonly modeId: string;
  readonly gameLabel: string;
  readonly moveNumber: number;
  /** Original eval drop recorded by the Analysis tool, for display. */
  readonly originalEvalDrop: number;
  /** Original move-quality classification from the Analysis tool. */
  readonly originalMoveQuality: MoveQuality | null;
}

export interface TrainingAttemptResult {
  readonly playerMove: Move;
  readonly playerMoveNotation: string;
  readonly playerMoveEval: NormalizedEvaluation;
  readonly bestMove: Move | null;
  readonly bestMoveNotation: string;
  readonly bestMoveEval: NormalizedEvaluation;
  readonly evalDifference: number;
  readonly isCorrect: boolean;
  readonly isAcceptable: boolean;
  readonly attemptQuality: MoveQuality;
  readonly alternatives: readonly EvaluatedMove[];
  readonly bestMovePV: readonly string[];
}

export interface TrainingSessionStats {
  readonly totalPositions: number;
  readonly completedPositions: number;
  readonly correctCount: number;
  readonly acceptableCount: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly accuracy: number;
}

export interface TrainingSourceFilter {
  readonly gameId?: string;
  readonly modeFilter?: readonly string[];
  readonly maxPositions?: number;
}

export interface LoadTrainingPositionsOptions {
  readonly getAllGameRecordsFn?: typeof defaultGetAllGameRecords;
  readonly getGameRecordFn?: typeof defaultGetGameRecord;
}

const DEFAULT_MAX_POSITIONS = 20;
const ACCEPTABLE_EVAL_DROP_THRESHOLD = 0.05;

// ---------------------------------------------------------------------------
// Session statistics
// ---------------------------------------------------------------------------

export function createSessionStats(totalPositions: number): TrainingSessionStats {
  return {
    totalPositions,
    completedPositions: 0,
    correctCount: 0,
    acceptableCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    accuracy: 0,
  };
}

export function updateSessionStats(
  current: TrainingSessionStats,
  result: TrainingAttemptResult,
): TrainingSessionStats {
  const completedPositions = current.completedPositions + 1;
  const correctCount = current.correctCount + (result.isCorrect ? 1 : 0);
  const acceptableCount = current.acceptableCount + (result.isAcceptable ? 1 : 0);
  const currentStreak = result.isCorrect ? current.currentStreak + 1 : 0;
  const bestStreak = Math.max(current.bestStreak, currentStreak);
  const accuracy =
    completedPositions > 0 ? Math.round((correctCount / completedPositions) * 100) : 0;
  return {
    totalPositions: current.totalPositions,
    completedPositions,
    correctCount,
    acceptableCount,
    currentStreak,
    bestStreak,
    accuracy,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function activeColorForPly(ply: number): PieceColor {
  return ply % 2 === 0 ? PC.White : PC.Black;
}

function formatGameLabel(game: GameRecord): string {
  const mode = resolveGameRecord(game).displayName;
  const date = new Date(game.completedAt);
  const dateLabel = Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';
  const players = `${game.playerWhite} vs ${game.playerBlack}`;
  return dateLabel ? `${mode} — ${players}, ${dateLabel}` : `${mode} — ${players}`;
}

export function movesEqual(a: Move | null, b: Move | null): boolean {
  if (a === null || b === null) return false;
  if ((a.from as number) !== (b.from as number)) return false;
  if (a.path.length !== b.path.length) return false;
  for (let i = 0; i < a.path.length; i += 1) {
    if ((a.path[i] as number) !== (b.path[i] as number)) return false;
  }
  if (a.captured.length !== b.captured.length) return false;
  for (let i = 0; i < a.captured.length; i += 1) {
    if ((a.captured[i] as number) !== (b.captured[i] as number)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Position loading
// ---------------------------------------------------------------------------

export async function loadTrainingPositions(
  filter: TrainingSourceFilter,
  adapterLookup: (modeId: string) => CogitateGameAdapter | null,
  options: LoadTrainingPositionsOptions = {},
): Promise<TrainingPosition[]> {
  const getAllGameRecordsFn = options.getAllGameRecordsFn ?? defaultGetAllGameRecords;
  const getGameRecordFn = options.getGameRecordFn ?? defaultGetGameRecord;
  const maxPositions = filter.maxPositions ?? DEFAULT_MAX_POSITIONS;
  const modeFilterSet =
    filter.modeFilter && filter.modeFilter.length > 0
      ? new Set(filter.modeFilter)
      : null;

  let games: GameRecord[];
  if (filter.gameId) {
    const single = await getGameRecordFn(filter.gameId);
    games = single ? [single] : [];
  } else {
    games = await getAllGameRecordsFn();
  }

  const collected: TrainingPosition[] = [];
  const seenBoards = new Map<string, number>();

  for (const game of games) {
    const trainingPlies = game.trainingPositions;
    if (!trainingPlies || trainingPlies.length === 0) continue;
    if (modeFilterSet && !modeFilterSet.has(game.mode)) continue;

    const entry = resolveGameRecord(game);
    const adapter = adapterLookup(entry.id);
    if (!adapter) {
      console.warn(`[TrainingEngine] No adapter registered for mode: ${entry.id}`);
      continue;
    }

    const cache = game.analysisCache;
    if (!cache || cache.length === 0) continue;

    const gameLabel = formatGameLabel(game);

    for (const ply of trainingPlies) {
      const snapshot = game.boardStates[ply];
      const analysis = cache[ply];
      if (snapshot === undefined || !analysis) continue;

      const board = adapter.getBoard(snapshot);
      const serialized = game.activeEventsPerPly?.[ply] ?? [];
      const events = deserializeActiveEvents(serialized);
      const ruleSet = adapter.getRuleSet(events);
      const evalDrop = analysis.evalDrop ?? 0;
      const moveQuality = analysis.moveQuality ?? null;

      const boardKey = adapter.serializeBoard(board);
      const existingIdx = seenBoards.get(boardKey);
      const position: TrainingPosition = {
        plyIndex: ply,
        board,
        activeColor: activeColorForPly(ply),
        activeEvents: events,
        serializedEvents: serialized,
        ruleSet,
        analysisResult: analysis,
        gameId: game.id,
        modeId: adapter.modeId,
        gameLabel,
        moveNumber: Math.floor(ply / 2) + 1,
        originalEvalDrop: evalDrop,
        originalMoveQuality: moveQuality,
      };

      if (existingIdx === undefined) {
        seenBoards.set(boardKey, collected.length);
        collected.push(position);
      } else {
        const existing = collected[existingIdx];
        if (existing && position.originalEvalDrop > existing.originalEvalDrop) {
          collected[existingIdx] = position;
        }
      }
    }
  }

  collected.sort((a, b) => b.originalEvalDrop - a.originalEvalDrop);
  return collected.slice(0, maxPositions);
}

// ---------------------------------------------------------------------------
// Move evaluation
// ---------------------------------------------------------------------------

export interface EvaluateAttemptOptions {
  readonly requestAnalysisFn?: typeof defaultRequestAnalysis;
}

export async function evaluateAttempt(
  position: TrainingPosition,
  playerMove: Move,
  adapter: CogitateGameAdapter,
  options: EvaluateAttemptOptions = {},
): Promise<TrainingAttemptResult> {
  const requestAnalysis = options.requestAnalysisFn ?? defaultRequestAnalysis;
  const notationAdapter = adapter.getNotationAdapter();
  const analysis = position.analysisResult;

  const playerMoveNotation = notationAdapter.moveToString(playerMove, position.board);
  const bestMove = analysis.bestMove;
  const bestMoveNotation = analysis.bestMoveNotation;
  const bestMoveEval: NormalizedEvaluation = {
    score: analysis.evaluation,
    rawScore: analysis.rawScore,
    isTerminal: false,
    confidence: 1,
  };

  const isCorrect = bestMove !== null && movesEqual(playerMove, bestMove);

  let playerMoveEval: NormalizedEvaluation;
  let evalDifference: number;

  if (isCorrect) {
    playerMoveEval = bestMoveEval;
    evalDifference = 0;
  } else {
    const nextBoard = position.ruleSet.applyMove(position.board, playerMove);
    const opponentColor =
      position.activeColor === PC.White ? PC.Black : PC.White;
    const opponentAnalysis = await requestAnalysis(
      nextBoard,
      opponentColor,
      position.modeId,
      position.serializedEvents,
      ANALYSIS_SEARCH_CONFIG,
    );
    // Opponent's eval is from opponent's perspective. Negate to get the
    // current player's perspective.
    const playerScore = -opponentAnalysis.evaluation;
    playerMoveEval = {
      score: playerScore,
      rawScore: -opponentAnalysis.rawScore,
      isTerminal: false,
      confidence: 1,
    };
    evalDifference = Math.max(0, bestMoveEval.score - playerMoveEval.score);
  }

  const legalMoveCount = analysis.alternativeMoves.length;
  const forcedCapture =
    legalMoveCount === 1 &&
    (analysis.alternativeMoves[0]?.notation.includes('x') ?? false);
  const secondBestGap =
    analysis.alternativeMoves.length >= 2
      ? Math.abs(
          (analysis.alternativeMoves[0]?.normalizedScore ?? 0) -
            (analysis.alternativeMoves[1]?.normalizedScore ?? 0),
        )
      : Infinity;

  const attemptQuality = classifyMove(
    evalDifference,
    legalMoveCount,
    forcedCapture,
    secondBestGap,
    { modeId: position.modeId },
  );

  const isAcceptable = isCorrect || evalDifference < ACCEPTABLE_EVAL_DROP_THRESHOLD;

  return {
    playerMove,
    playerMoveNotation,
    playerMoveEval,
    bestMove,
    bestMoveNotation,
    bestMoveEval,
    evalDifference,
    isCorrect,
    isAcceptable,
    attemptQuality,
    alternatives: analysis.alternativeMoves,
    bestMovePV: analysis.pvNotation,
  };
}
