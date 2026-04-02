import {
  PieceColor,
  PlayerType,
  type GameState,
  GameStatus,
  GameResultType,
} from '../../engine/types';
import { createAmericanRules } from '../../engine/rules';
import { createNewGame, makeMove, movesAreEqual } from '../../engine/game';
import { iterativeSearch } from '../search';
import {
  getDifficultyConfig,
  toSearchConfig,
  selectMove,
  type Difficulty,
} from '../difficulty';

/** Configuration for a single self-play match. */
export interface MatchConfig {
  /** Number of games to play. */
  gameCount: number;
  /** Difficulty for the White player. */
  whiteDifficulty: Difficulty;
  /** Difficulty for the Black player. */
  blackDifficulty: Difficulty;
  /** Whether to alternate colors between games (for asymmetric matches). */
  alternateColors: boolean;
  /** Maximum moves per game before forced termination. */
  maxMovesPerGame: number;
  /** Master seed for the PRNG. */
  seed: number;
  /** Optional callback invoked after each game completes (for progress reporting). */
  onGameComplete?: (result: GameRecord) => void;
}

/** Record of a single completed game. */
export interface GameRecord {
  /** Game index (1-based). */
  gameNumber: number;
  /** Which difficulty played White in this game. */
  whiteDifficulty: Difficulty;
  /** Which difficulty played Black in this game. */
  blackDifficulty: Difficulty;
  /** Game outcome. */
  result: 'white' | 'black' | 'draw';
  /** Reason for game ending. */
  reason: string;
  /** Total number of moves (plies). */
  moveCount: number;
  /** Total time elapsed for the game in milliseconds. */
  elapsedMs: number;
  /** Whether the game hit the max-move safety cap. */
  cappedByMoveLimit: boolean;
  /** Seed used for this game's PRNG. */
  gameSeed: number;
}

/** Aggregated results of a full match. */
export interface MatchResult {
  /** All individual game records. */
  games: GameRecord[];
  /** Total games played. */
  totalGames: number;
  /** Win counts by result category. */
  wins: { white: number; black: number; draw: number };
  /** Win rate for the "primary" side (Hard in Hard-vs-Easy, or White in symmetric). */
  primaryWinRate: number;
  /** Average game length in moves. */
  avgMoveCount: number;
  /** Maximum game length observed. */
  maxMoveCount: number;
  /** Minimum game length observed. */
  minMoveCount: number;
  /** Number of games that hit the move limit cap. */
  cappedGames: number;
  /** Total elapsed time for the entire match in milliseconds. */
  totalElapsedMs: number;
  /** List of anomalous game indices (for investigation). */
  anomalousGames: number[];
}

/**
 * Mulberry32: a simple, fast 32-bit seeded PRNG.
 * Returns a function that produces numbers in [0, 1) on each call.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Valid game-ending reasons from the engine plus our safety-cap reason. */
const VALID_REASONS: ReadonlySet<string> = new Set<string>([
  'NO_PIECES_LEFT',
  'NO_LEGAL_MOVES',
  'REPETITION',
  'FORTY_MOVE_RULE',
  'RESIGNATION',
  'move-limit-cap',
]);

/**
 * Plays a single game between two AI opponents.
 *
 * Uses the engine's createNewGame + makeMove pipeline directly,
 * bypassing the Web Worker and UI layer.
 */
export function playSingleGame(
  whiteDifficulty: Difficulty,
  blackDifficulty: Difficulty,
  maxMoves: number,
  randomFn: () => number,
): GameRecord {
  const ruleSet = createAmericanRules();
  let currentState: GameState = createNewGame(ruleSet, {
    white: PlayerType.CpuHard,
    black: PlayerType.CpuHard,
  });

  let moveCount = 0;
  let cappedByMoveLimit = false;
  const startTime = performance.now();

  while (currentState.status === GameStatus.InProgress) {
    if (moveCount >= maxMoves) {
      cappedByMoveLimit = true;
      break;
    }

    const difficulty =
      currentState.activeColor === PieceColor.White
        ? whiteDifficulty
        : blackDifficulty;

    const config = getDifficultyConfig(difficulty);
    const searchConfig = toSearchConfig(config);
    const searchResult = iterativeSearch(currentState, searchConfig);
    const legalMoves = currentState.ruleSet.getLegalMoves(
      currentState.board,
      currentState.activeColor,
    );

    if (searchResult.move === null || legalMoves.length === 0) {
      throw new Error(
        `Game ply ${String(moveCount)}: AI returned null move with ${String(legalMoves.length)} legal moves available.`,
      );
    }

    const selectedMove = selectMove(
      searchResult,
      searchResult.rootMoveScores,
      legalMoves,
      config,
      randomFn,
    );

    if (!legalMoves.some((m) => movesAreEqual(m, selectedMove))) {
      throw new Error(
        `Game produced an illegal move at ply ${String(moveCount)}. ` +
          `Selected move from=${String(selectedMove.from)} ` +
          `path=${selectedMove.path.map(String).join(',')} ` +
          `is not in the legal move list.`,
      );
    }

    currentState = makeMove(currentState, selectedMove);
    moveCount++;
  }

  const elapsedMs = performance.now() - startTime;

  let result: 'white' | 'black' | 'draw';
  let reason: string;

  if (cappedByMoveLimit) {
    result = 'draw';
    reason = 'move-limit-cap';
  } else if (currentState.result === null) {
    result = 'draw';
    reason = 'unknown';
  } else {
    switch (currentState.result.type) {
      case GameResultType.WhiteWin:
        result = 'white';
        break;
      case GameResultType.BlackWin:
        result = 'black';
        break;
      case GameResultType.Draw:
        result = 'draw';
        break;
    }
    reason = currentState.result.reason;
  }

  return {
    gameNumber: 0,
    whiteDifficulty,
    blackDifficulty,
    result,
    reason,
    moveCount,
    elapsedMs,
    cappedByMoveLimit,
    gameSeed: 0,
  };
}

/**
 * Aggregates individual game records into a MatchResult with statistics
 * and anomaly detection.
 */
function aggregateResults(
  games: GameRecord[],
  config: MatchConfig,
): MatchResult {
  const wins = { white: 0, black: 0, draw: 0 };
  let totalMoves = 0;
  let maxMoves = 0;
  let minMoves = Infinity;
  let cappedCount = 0;
  const anomalous: number[] = [];

  for (const game of games) {
    wins[game.result]++;
    totalMoves += game.moveCount;
    maxMoves = Math.max(maxMoves, game.moveCount);
    minMoves = Math.min(minMoves, game.moveCount);
    if (game.cappedByMoveLimit) cappedCount++;

    if (game.cappedByMoveLimit) {
      anomalous.push(game.gameNumber);
    }
    if (game.moveCount < 10) {
      anomalous.push(game.gameNumber);
    }
  }

  let primaryWinRate: number;
  if (config.alternateColors) {
    let hardWins = 0;
    for (const game of games) {
      const hardIsWhite = game.whiteDifficulty === 'hard';
      if (hardIsWhite && game.result === 'white') hardWins++;
      if (!hardIsWhite && game.result === 'black') hardWins++;
    }
    primaryWinRate = games.length > 0 ? hardWins / games.length : 0;
  } else {
    primaryWinRate = games.length > 0 ? wins.white / games.length : 0;
  }

  return {
    games,
    totalGames: games.length,
    wins,
    primaryWinRate,
    avgMoveCount: games.length > 0 ? totalMoves / games.length : 0,
    maxMoveCount: maxMoves,
    minMoveCount: minMoves === Infinity ? 0 : minMoves,
    cappedGames: cappedCount,
    totalElapsedMs: games.reduce((sum, g) => sum + g.elapsedMs, 0),
    anomalousGames: [...new Set(anomalous)],
  };
}

/**
 * Runs a full match of N games between two AI configurations.
 * Returns aggregated results with per-game detail.
 */
export function runMatch(config: MatchConfig): MatchResult {
  const games: GameRecord[] = [];

  for (let i = 0; i < config.gameCount; i++) {
    const gameSeed = config.seed + i * 7919;
    const randomFn = createSeededRandom(gameSeed);

    let whiteDiff = config.whiteDifficulty;
    let blackDiff = config.blackDifficulty;
    if (config.alternateColors && i % 2 === 1) {
      whiteDiff = config.blackDifficulty;
      blackDiff = config.whiteDifficulty;
    }

    const record = playSingleGame(
      whiteDiff,
      blackDiff,
      config.maxMovesPerGame,
      randomFn,
    );
    record.gameNumber = i + 1;
    record.gameSeed = gameSeed;

    games.push(record);

    if (config.onGameComplete) {
      config.onGameComplete(record);
    }
  }

  return aggregateResults(games, config);
}

export { VALID_REASONS };
