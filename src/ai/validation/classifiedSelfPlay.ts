/**
 * Classified draughts self-play validation extension (Task 28.5).
 *
 * Extends the Phase 1 self-play framework (`selfPlay.ts`) with
 * variant-aware validation for all 10 Tier 1 Classified draughts games.
 *
 * Four automated validation suites:
 *   Suite 1 (C-12 Hard-vs-Easy): 200 games × 10 variants, pass ≥70%.
 *   Suite 2 (C-12 Stress Test): 1000 games × 10 variants, pass: 0 crashes.
 *   Suite 3 (Hard-vs-Random): 100 games × 10 variants, pass ≥99%.
 *   Suite 4 (Response Time): 50 games × 10 variants, pass ≤ board-size cap.
 *
 * Results are structured as JSON evidence artifacts.
 */

import type { GameResult } from '../../engine/types';
import type { DraughtsGameId } from '../../engine/classified/draughts/DraughtsConfig';
import {
  createDraughtsConfig,
  TIER_1_DRAUGHTS_GAME_IDS,
  boardSizeOf,
} from '../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../../engine/classified/draughts/ParameterizedDraughtsRules';
import type { Difficulty } from '../difficulty';
import { getDraughtsWeights } from '../evaluators/draughts/weights';
import { getDraughtsDifficultyConfig, getResponseTimeCap } from '../evaluators/draughts/difficultyPresets';
import {
  classifiedIterativeSearch,
  selectClassifiedMove,
} from '../evaluators/draughts/classifiedSearch';
import { createSeededRandom } from './selfPlay';

// ---------------------------------------------------------------------------
// Record types
// ---------------------------------------------------------------------------

export interface ClassifiedGameRecord {
  readonly gameNumber: number;
  readonly gameId: DraughtsGameId;
  readonly whiteDifficulty: Difficulty;
  readonly blackDifficulty: Difficulty;
  readonly result: 'white' | 'black' | 'draw' | 'error';
  readonly reason: string;
  readonly moveCount: number;
  readonly elapsedMs: number;
  readonly cappedByMoveLimit: boolean;
  readonly gameSeed: number;
  readonly moveTimings?: readonly number[];
  readonly errorMessage?: string;
}

export interface ClassifiedMatchResult {
  readonly gameId: DraughtsGameId;
  readonly games: readonly ClassifiedGameRecord[];
  readonly totalGames: number;
  readonly wins: { white: number; black: number; draw: number };
  readonly primaryWinRate: number;
  readonly avgMoveCount: number;
  readonly maxMoveCount: number;
  readonly minMoveCount: number;
  readonly cappedGames: number;
  readonly errorGames: number;
  readonly totalElapsedMs: number;
  readonly medianMoveTimeMs?: number;
  readonly p90MoveTimeMs?: number;
  readonly p99MoveTimeMs?: number;
}

export interface ClassifiedValidationSummary {
  readonly suite: string;
  readonly variants: readonly ClassifiedMatchResult[];
  readonly passedAll: boolean;
  readonly failedVariants: readonly DraughtsGameId[];
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// Match config
// ---------------------------------------------------------------------------

export interface ClassifiedMatchConfig {
  readonly gameId: DraughtsGameId;
  readonly gameCount: number;
  readonly whiteDifficulty: Difficulty;
  readonly blackDifficulty: Difficulty;
  readonly alternateColors: boolean;
  readonly maxMovesPerGame: number;
  readonly seed: number;
  readonly trackMoveTimings?: boolean;
  readonly onGameComplete?: (record: ClassifiedGameRecord) => void;
}

// ---------------------------------------------------------------------------
// Single game
// ---------------------------------------------------------------------------

function playClassifiedGame(
  gameId: DraughtsGameId,
  whiteDifficulty: Difficulty,
  blackDifficulty: Difficulty,
  maxMoves: number,
  randomFn: () => number,
  gameNumber: number,
  gameSeed: number,
  trackMoveTimings: boolean,
): ClassifiedGameRecord {
  const config = createDraughtsConfig(gameId);
  const weights = getDraughtsWeights(gameId);
  const ruleSet = createDraughtsRuleSet(config);

  let state = ruleSet.startingPosition();
  let moveCount = 0;
  const startTime = performance.now();
  const moveTimings: number[] = [];

  // Game loop: play moves until game over or move limit.
  for (; moveCount < maxMoves; moveCount++) {
    const gameOver = ruleSet.checkGameOver(state);
    if (gameOver !== null) {
      const elapsedMs = performance.now() - startTime;
      return {
        gameNumber,
        gameId,
        whiteDifficulty,
        blackDifficulty,
        result: gameResultToString(gameOver),
        reason: gameOver.reason,
        moveCount,
        elapsedMs,
        cappedByMoveLimit: false,
        gameSeed,
        moveTimings: trackMoveTimings ? moveTimings : undefined,
      };
    }

    const turn = (state.turn ?? 'white') as 'white' | 'black';
    const difficulty = turn === 'white' ? whiteDifficulty : blackDifficulty;
    const diffConfig = getDraughtsDifficultyConfig(config, difficulty);

    const legalMoves = ruleSet.getLegalMoves(state);
    if (legalMoves.length === 0) break;

    // For random difficulty (baseline), pick uniformly random.
    if (difficulty === 'easy' && diffConfig.blunderRate >= 1.0) {
      const idx = Math.floor(randomFn() * legalMoves.length);
      const randomMove = legalMoves[idx];
      if (randomMove) state = ruleSet.applyMove(state, randomMove);
      continue;
    }

    const moveStart = trackMoveTimings ? performance.now() : 0;
    const searchResult = classifiedIterativeSearch(
      state,
      ruleSet,
      config,
      weights,
      diffConfig,
    );
    if (trackMoveTimings) {
      moveTimings.push(performance.now() - moveStart);
    }

    const selected = selectClassifiedMove(
      searchResult,
      legalMoves,
      diffConfig,
      randomFn,
    );

    state = ruleSet.applyMove(state, selected);
  }

  // Reached here = move limit or no legal moves.
  const elapsedMs = performance.now() - startTime;
  const cappedByMoveLimit = moveCount >= maxMoves;
  return {
    gameNumber,
    gameId,
    whiteDifficulty,
    blackDifficulty,
    result: 'draw',
    reason: cappedByMoveLimit ? 'move-limit-cap' : 'NO_LEGAL_MOVES',
    moveCount,
    elapsedMs,
    cappedByMoveLimit,
    gameSeed,
    moveTimings: trackMoveTimings ? moveTimings : undefined,
  };
}

function gameResultToString(
  result: GameResult,
): 'white' | 'black' | 'draw' {
  // GameResultType values are 'WHITE_WIN', 'BLACK_WIN', 'DRAW'.
  switch (result.type) {
    case 'WHITE_WIN':
      return 'white';
    case 'BLACK_WIN':
      return 'black';
    case 'DRAW':
      return 'draw';
    default:
      return 'draw';
  }
}

// ---------------------------------------------------------------------------
// Match runner
// ---------------------------------------------------------------------------

export function runClassifiedMatch(
  matchConfig: ClassifiedMatchConfig,
): ClassifiedMatchResult {
  const games: ClassifiedGameRecord[] = [];
  const trackTimings = matchConfig.trackMoveTimings ?? false;

  for (let i = 0; i < matchConfig.gameCount; i++) {
    const gameSeed = matchConfig.seed + i * 7919;
    const randomFn = createSeededRandom(gameSeed);

    let whiteDiff = matchConfig.whiteDifficulty;
    let blackDiff = matchConfig.blackDifficulty;
    if (matchConfig.alternateColors && i % 2 === 1) {
      whiteDiff = matchConfig.blackDifficulty;
      blackDiff = matchConfig.whiteDifficulty;
    }

    let record: ClassifiedGameRecord;
    try {
      record = playClassifiedGame(
        matchConfig.gameId,
        whiteDiff,
        blackDiff,
        matchConfig.maxMovesPerGame,
        randomFn,
        i + 1,
        gameSeed,
        trackTimings,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      record = {
        gameNumber: i + 1,
        gameId: matchConfig.gameId,
        whiteDifficulty: whiteDiff,
        blackDifficulty: blackDiff,
        result: 'error',
        reason: 'crash',
        moveCount: 0,
        elapsedMs: 0,
        cappedByMoveLimit: false,
        gameSeed,
        errorMessage,
      };
    }

    games.push(record);
    matchConfig.onGameComplete?.(record);
  }

  return aggregateClassifiedResults(matchConfig.gameId, games, matchConfig.alternateColors);
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function aggregateClassifiedResults(
  gameId: DraughtsGameId,
  games: readonly ClassifiedGameRecord[],
  alternateColors: boolean,
): ClassifiedMatchResult {
  const wins = { white: 0, black: 0, draw: 0 };
  let totalMoves = 0;
  let maxMoves = 0;
  let minMoves = Infinity;
  let cappedCount = 0;
  let errorCount = 0;
  const allTimings: number[] = [];

  for (const game of games) {
    if (game.result === 'error') {
      errorCount++;
      continue;
    }
    wins[game.result]++;
    totalMoves += game.moveCount;
    maxMoves = Math.max(maxMoves, game.moveCount);
    minMoves = Math.min(minMoves, game.moveCount);
    if (game.cappedByMoveLimit) cappedCount++;
    if (game.moveTimings) allTimings.push(...game.moveTimings);
  }

  const nonErrorGames = games.filter((g) => g.result !== 'error');

  let primaryWinRate: number;
  if (alternateColors) {
    let hardWins = 0;
    for (const game of nonErrorGames) {
      const hardIsWhite = game.whiteDifficulty === 'hard';
      if (hardIsWhite && game.result === 'white') hardWins++;
      if (!hardIsWhite && game.result === 'black') hardWins++;
    }
    primaryWinRate = nonErrorGames.length > 0 ? hardWins / nonErrorGames.length : 0;
  } else {
    primaryWinRate = nonErrorGames.length > 0 ? wins.white / nonErrorGames.length : 0;
  }

  // Compute timing percentiles.
  allTimings.sort((a, b) => a - b);
  const medianMs = percentile(allTimings, 0.5);
  const p90Ms = percentile(allTimings, 0.9);
  const p99Ms = percentile(allTimings, 0.99);

  return {
    gameId,
    games,
    totalGames: games.length,
    wins,
    primaryWinRate,
    avgMoveCount: nonErrorGames.length > 0 ? totalMoves / nonErrorGames.length : 0,
    maxMoveCount: maxMoves,
    minMoveCount: minMoves === Infinity ? 0 : minMoves,
    cappedGames: cappedCount,
    errorGames: errorCount,
    totalElapsedMs: games.reduce((sum, g) => sum + g.elapsedMs, 0),
    medianMoveTimeMs: medianMs,
    p90MoveTimeMs: p90Ms,
    p99MoveTimeMs: p99Ms,
  };
}

function percentile(sorted: readonly number[], p: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const idx = Math.min(Math.floor(p * sorted.length), sorted.length - 1);
  return sorted[idx];
}

// ---------------------------------------------------------------------------
// Validation suite runners
// ---------------------------------------------------------------------------

/**
 * Suite 1: Hard-vs-Easy (C-12 primary).
 * 200 games per variant, pass ≥70% hard win rate.
 */
export function runHardVsEasySuite(
  gameIds: readonly DraughtsGameId[] = TIER_1_DRAUGHTS_GAME_IDS,
  gamesPerVariant = 200,
  seed = 42,
): ClassifiedValidationSummary {
  const results: ClassifiedMatchResult[] = [];
  const failed: DraughtsGameId[] = [];

  for (const gameId of gameIds) {
    const result = runClassifiedMatch({
      gameId,
      gameCount: gamesPerVariant,
      whiteDifficulty: 'hard',
      blackDifficulty: 'easy',
      alternateColors: true,
      maxMovesPerGame: 300,
      seed,
    });
    results.push(result);
    if (result.primaryWinRate < 0.70) failed.push(gameId);
  }

  return {
    suite: 'C-12 Hard-vs-Easy',
    variants: results,
    passedAll: failed.length === 0,
    failedVariants: failed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Suite 2: Stress Test (C-12 secondary).
 * 1000 games per variant, pass: 0 crashes or illegal moves.
 */
export function runStressTestSuite(
  gameIds: readonly DraughtsGameId[] = TIER_1_DRAUGHTS_GAME_IDS,
  gamesPerVariant = 1000,
  seed = 1337,
): ClassifiedValidationSummary {
  const results: ClassifiedMatchResult[] = [];
  const failed: DraughtsGameId[] = [];

  for (const gameId of gameIds) {
    const result = runClassifiedMatch({
      gameId,
      gameCount: gamesPerVariant,
      whiteDifficulty: 'hard',
      blackDifficulty: 'hard',
      alternateColors: false,
      maxMovesPerGame: 500,
      seed,
    });
    results.push(result);
    if (result.errorGames > 0) failed.push(gameId);
  }

  return {
    suite: 'C-12 Stress Test',
    variants: results,
    passedAll: failed.length === 0,
    failedVariants: failed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Suite 3: Hard-vs-Random.
 * 100 games per variant, pass ≥99% hard win rate.
 */
export function runHardVsRandomSuite(
  gameIds: readonly DraughtsGameId[] = TIER_1_DRAUGHTS_GAME_IDS,
  gamesPerVariant = 100,
  seed = 9999,
): ClassifiedValidationSummary {
  const results: ClassifiedMatchResult[] = [];
  const failed: DraughtsGameId[] = [];

  for (const gameId of gameIds) {
    // For "random" opponent, use easy with 100% blunder rate.
    const result = runClassifiedMatch({
      gameId,
      gameCount: gamesPerVariant,
      whiteDifficulty: 'hard',
      blackDifficulty: 'easy',
      alternateColors: true,
      maxMovesPerGame: 300,
      seed,
    });
    results.push(result);
    if (result.primaryWinRate < 0.99) failed.push(gameId);
  }

  return {
    suite: 'Hard-vs-Random Baseline',
    variants: results,
    passedAll: failed.length === 0,
    failedVariants: failed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Suite 4: Response Time Validation.
 * 50 games per variant, pass: median response ≤ board-size cap.
 */
export function runResponseTimeSuite(
  gameIds: readonly DraughtsGameId[] = TIER_1_DRAUGHTS_GAME_IDS,
  gamesPerVariant = 50,
  seed = 7777,
): ClassifiedValidationSummary {
  const results: ClassifiedMatchResult[] = [];
  const failed: DraughtsGameId[] = [];

  for (const gameId of gameIds) {
    const config = createDraughtsConfig(gameId);
    const boardSize = boardSizeOf(config);
    const cap = getResponseTimeCap(boardSize);

    const result = runClassifiedMatch({
      gameId,
      gameCount: gamesPerVariant,
      whiteDifficulty: 'hard',
      blackDifficulty: 'hard',
      alternateColors: false,
      maxMovesPerGame: 200,
      seed,
      trackMoveTimings: true,
    });
    results.push(result);
    if (result.medianMoveTimeMs !== undefined && result.medianMoveTimeMs > cap) {
      failed.push(gameId);
    }
  }

  return {
    suite: 'Response Time Validation',
    variants: results,
    passedAll: failed.length === 0,
    failedVariants: failed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Runs a smoke test: 2 games per variant, Hard-vs-Easy.
 * Fast sanity check that all variants can complete games without crashing.
 */
export function runClassifiedSmoke(
  gameIds: readonly DraughtsGameId[] = TIER_1_DRAUGHTS_GAME_IDS,
  seed = 12345,
): ClassifiedValidationSummary {
  const results: ClassifiedMatchResult[] = [];
  const failed: DraughtsGameId[] = [];

  for (const gameId of gameIds) {
    const result = runClassifiedMatch({
      gameId,
      gameCount: 2,
      whiteDifficulty: 'hard',
      blackDifficulty: 'easy',
      alternateColors: true,
      maxMovesPerGame: 200,
      seed,
    });
    results.push(result);
    if (result.errorGames > 0) failed.push(gameId);
  }

  return {
    suite: 'Classified Smoke Test',
    variants: results,
    passedAll: failed.length === 0,
    failedVariants: failed,
    timestamp: new Date().toISOString(),
  };
}
