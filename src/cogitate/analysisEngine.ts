/**
 * Progressive game analysis orchestrator (Task 21.3).
 *
 * Runs `requestAnalysis` on every ply of a completed game, computes eval
 * drops retroactively as each successive position is analyzed, classifies
 * move quality, extracts training positions, and caches results in memory
 * and IndexedDB.
 */

import type { SearchConfig } from '../ai/search';
import {
  requestAnalysis as defaultRequestAnalysis,
  requestEvaluation as defaultRequestEvaluation,
} from '../ai/workerClient';
import type { PieceColor } from '../engine/types';
import { PieceColor as PC } from '../engine/types';
import type { GameRecord } from '../persistence/gameHistory';
import { updateGameRecord } from '../persistence/gameHistory';
import type { CogitateGameAdapter } from './CogitateGameAdapter';
import {
  ANALYSIS_SEARCH_CONFIG,
  MOVE_QUALITY_THRESHOLDS,
  type AnalysisResult,
  type MoveQuality,
} from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'cancelled';

export interface AnalysisSummary {
  readonly totalMoves: number;
  readonly brilliantCount: number;
  readonly goodCount: number;
  readonly inaccuracyCount: number;
  readonly mistakeCount: number;
  readonly blunderCount: number;
  readonly averageEvalDrop: number;
  /** Overall quality score 0–100. */
  readonly qualityScore: number;
}

export interface GameAnalysis {
  readonly results: readonly (AnalysisResult | null)[];
  readonly summary: AnalysisSummary;
  readonly trainingPositions: readonly number[];
  readonly status: AnalysisStatus;
  readonly config: SearchConfig;
}

export type AnalysisProgressCallback = (
  plyIndex: number,
  result: AnalysisResult,
  overallProgress: number,
) => void;

export interface AnalyzeGameOptions {
  readonly requestAnalysisFn?: typeof defaultRequestAnalysis;
  readonly requestEvaluationFn?: typeof defaultRequestEvaluation;
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const memoryCache = new Map<string, GameAnalysis>();

export function _clearAnalysisCache(): void {
  memoryCache.clear();
}

// ---------------------------------------------------------------------------
// Mode threshold multipliers
// ---------------------------------------------------------------------------

function thresholdMultiplier(modeId: string): number {
  if (modeId === 'chaos') return 1.5;
  return 1.0;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export interface ClassifyOptions {
  readonly modeId?: string;
}

export function classifyMove(
  evalDrop: number,
  legalMoveCount: number,
  isForcedCapture: boolean,
  secondBestGap: number,
  options: ClassifyOptions = {},
): MoveQuality {
  const mult = thresholdMultiplier(options.modeId ?? 'classic');
  const goodMax = MOVE_QUALITY_THRESHOLDS.good.maxEvalDrop * mult;
  const inaccMax = MOVE_QUALITY_THRESHOLDS.inaccuracy.maxEvalDrop * mult;
  const mistakeMax = MOVE_QUALITY_THRESHOLDS.mistake.maxEvalDrop * mult;
  const drop = Math.max(0, evalDrop);

  if (drop < goodMax) {
    if (
      legalMoveCount >= MOVE_QUALITY_THRESHOLDS.brilliant.minLegalMoves &&
      !isForcedCapture &&
      secondBestGap >= MOVE_QUALITY_THRESHOLDS.brilliant.secondBestGap
    ) {
      return 'brilliant';
    }
    return 'good';
  }
  if (drop < inaccMax) return 'inaccuracy';
  if (drop < mistakeMax) return 'mistake';
  return 'blunder';
}

// ---------------------------------------------------------------------------
// Summary & quality score
// ---------------------------------------------------------------------------

export function computeSummary(
  results: readonly (AnalysisResult | null)[],
): AnalysisSummary {
  let brilliantCount = 0;
  let goodCount = 0;
  let inaccuracyCount = 0;
  let mistakeCount = 0;
  let blunderCount = 0;
  let totalDrop = 0;
  let classifiedCount = 0;

  for (const r of results) {
    if (!r?.moveQuality) continue;
    classifiedCount += 1;
    totalDrop += r.evalDrop ?? 0;
    switch (r.moveQuality) {
      case 'brilliant': brilliantCount += 1; break;
      case 'good': goodCount += 1; break;
      case 'inaccuracy': inaccuracyCount += 1; break;
      case 'mistake': mistakeCount += 1; break;
      case 'blunder': blunderCount += 1; break;
    }
  }

  const penalty = inaccuracyCount * 5 + mistakeCount * 15 + blunderCount * 30;
  const bonus = brilliantCount * 5;
  const qualityScore = Math.max(0, Math.min(100, 100 - penalty + bonus));

  return {
    totalMoves: results.length,
    brilliantCount,
    goodCount,
    inaccuracyCount,
    mistakeCount,
    blunderCount,
    averageEvalDrop: classifiedCount === 0 ? 0 : totalDrop / classifiedCount,
    qualityScore,
  };
}

// ---------------------------------------------------------------------------
// Training position extraction
// ---------------------------------------------------------------------------

export function extractTrainingPositions(
  results: readonly (AnalysisResult | null)[],
): number[] {
  const candidates: Array<{ ply: number; drop: number }> = [];
  results.forEach((r, ply) => {
    if (!r) return;
    const drop = r.evalDrop ?? 0;
    if (drop < 0.05) return;
    if (r.alternativeMoves.length < 2) return;
    candidates.push({ ply, drop });
  });
  candidates.sort((a, b) => b.drop - a.drop);
  return candidates.map((c) => c.ply);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function activeColorForPly(ply: number): PieceColor {
  return ply % 2 === 0 ? PC.White : PC.Black;
}

function secondBestGapFromAlternatives(
  result: AnalysisResult,
): number {
  if (result.alternativeMoves.length < 2) return Infinity;
  const best = result.alternativeMoves[0];
  const second = result.alternativeMoves[1];
  if (!best || !second) return Infinity;
  return Math.abs(best.normalizedScore - second.normalizedScore);
}

function isForcedCapture(result: AnalysisResult): boolean {
  // A capture move uses 'x' in standard notation; forced if only one legal move.
  if (result.alternativeMoves.length !== 1) return false;
  const only = result.alternativeMoves[0];
  return !!only && only.notation.includes('x');
}

/**
 * Given the "played" move's resulting-position normalized score (from the
 * *opponent's* perspective at ply N+1), convert to the current player's
 * perspective and compute the eval drop vs. the best move.
 *
 * `bestMoveEval` and `playedPosEvalFromOpp` are both in [-1, +1].
 */
function computeEvalDrop(
  bestMoveEval: number,
  playedPosEvalFromOpp: number,
): number {
  // After the player plays, it's the opponent's turn. The opponent's eval is
  // from their perspective; negating yields the current player's perspective.
  const playedMoveEval = -playedPosEvalFromOpp;
  const drop = bestMoveEval - playedMoveEval;
  return Math.max(0, drop);
}

// ---------------------------------------------------------------------------
// Progressive game analysis
// ---------------------------------------------------------------------------

export async function analyzeGame(
  game: GameRecord,
  adapter: CogitateGameAdapter,
  config: SearchConfig,
  onProgress: AnalysisProgressCallback,
  options: AnalyzeGameOptions = {},
): Promise<GameAnalysis> {
  const requestAnalysis = options.requestAnalysisFn ?? defaultRequestAnalysis;
  const requestEvaluation = options.requestEvaluationFn ?? defaultRequestEvaluation;
  const signal = options.signal;

  const totalMoves = game.moves.length;
  const rawResults: Array<AnalysisResult | null> = new Array<AnalysisResult | null>(totalMoves).fill(null);
  const evaluations: Array<number | null> = new Array<number | null>(totalMoves + 1).fill(null);

  let status: AnalysisStatus = 'running';

  const classify = (ply: number): AnalysisResult | null => {
    const analysis = rawResults[ply];
    if (!analysis) return null;
    const nextEval = evaluations[ply + 1];
    if (nextEval === null || nextEval === undefined) return null;
    const drop = computeEvalDrop(analysis.evaluation, nextEval);
    const legalMoveCount = analysis.alternativeMoves.length;
    const forced = isForcedCapture(analysis);
    const gap = secondBestGapFromAlternatives(analysis);
    const quality = classifyMove(drop, legalMoveCount, forced, gap, {
      modeId: adapter.modeId,
    });
    const classified: AnalysisResult = {
      ...analysis,
      evalDrop: drop,
      moveQuality: quality,
    };
    rawResults[ply] = classified;
    return classified;
  };

  for (let ply = 0; ply < totalMoves; ply += 1) {
    if (signal?.aborted) {
      status = 'cancelled';
      break;
    }

    const snapshot = game.boardStates[ply];
    if (snapshot === undefined) continue;
    const board = adapter.getBoard(snapshot);
    const events = game.activeEventsPerPly?.[ply] ?? [];
    const color = activeColorForPly(ply);

    let analysis: AnalysisResult;
    try {
      analysis = await requestAnalysis(board, color, adapter.modeId, events, config);
    } catch (err) {
      console.warn(`[AnalysisEngine] ply ${String(ply)} failed:`, err);
      continue;
    }
    rawResults[ply] = analysis;
    evaluations[ply] = analysis.evaluation;

    // Classify the previous ply now that we know the post-move evaluation.
    if (ply > 0) {
      const classified = classify(ply - 1);
      if (classified) {
        onProgress(ply - 1, classified, (ply + 1) / totalMoves);
      }
    }

    // Always report progress for the just-analyzed ply (unclassified for now).
    onProgress(ply, analysis, (ply + 1) / totalMoves);
  }

  // Terminal evaluation for the final position so the last move can be classified.
  if (status !== 'cancelled' && totalMoves > 0) {
    const finalSnapshot = game.boardStates[totalMoves];
    if (finalSnapshot !== undefined) {
      try {
        const finalBoard = adapter.getBoard(finalSnapshot);
        const finalColor = activeColorForPly(totalMoves);
        const finalEval = await requestEvaluation(
          finalBoard,
          finalColor,
          adapter.modeId,
          game.activeEventsPerPly?.[totalMoves] ?? [],
        );
        evaluations[totalMoves] = finalEval.score;
      } catch (err) {
        console.warn('[AnalysisEngine] terminal eval failed:', err);
      }
    }
    const classified = classify(totalMoves - 1);
    if (classified) {
      onProgress(totalMoves - 1, classified, 1);
    }
  }

  if (status === 'running') status = 'complete';

  const summary = computeSummary(rawResults);
  const trainingPositions = extractTrainingPositions(rawResults);

  const analysisResult: GameAnalysis = {
    results: rawResults,
    summary,
    trainingPositions,
    status,
    config,
  };

  memoryCache.set(game.id, analysisResult);
  return analysisResult;
}

// ---------------------------------------------------------------------------
// Caching and persistence
// ---------------------------------------------------------------------------

export function getCachedAnalysis(gameId: string): GameAnalysis | null {
  return memoryCache.get(gameId) ?? null;
}

export function loadCachedAnalysis(game: GameRecord): GameAnalysis | null {
  const inMemory = memoryCache.get(game.id);
  if (inMemory) return inMemory;
  if (!game.analysisCache || game.analysisCache.length === 0) return null;
  const results: (AnalysisResult | null)[] = game.analysisCache.map((r) => r);
  const summary = computeSummary(results);
  const trainingPositions = game.trainingPositions ?? extractTrainingPositions(results);
  const analysis: GameAnalysis = {
    results,
    summary,
    trainingPositions,
    status: 'complete',
    config: ANALYSIS_SEARCH_CONFIG,
  };
  memoryCache.set(game.id, analysis);
  return analysis;
}

export async function persistAnalysis(
  gameId: string,
  analysis: GameAnalysis,
): Promise<void> {
  try {
    const results = analysis.results.filter(
      (r): r is AnalysisResult => r !== null,
    );
    await updateGameRecord(gameId, {
      analysisCache: results,
      trainingPositions: [...analysis.trainingPositions],
    });
  } catch (err) {
    console.warn('[AnalysisEngine] persistAnalysis failed:', err);
  }
}
