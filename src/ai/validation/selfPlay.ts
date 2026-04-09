import {
  PieceColor,
  PlayerType,
  CrazyEvent,
  type GameState,
  GameStatus,
  GameResultType,
  GameMode,
} from '../../engine/types';
import { createAmericanRules } from '../../engine/rules';
import { createNewGame, getEffectiveBoard, getLegalMovesFromBoard, makeMove, checkForStalemate } from '../../engine/game';
import { IMPLEMENTED_EVENTS } from '../../engine/events';
import { iterativeSearch } from '../search';
import { getDifficultyConfig, toSearchConfig, selectMove, type Difficulty } from '../difficulty';

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

  /** Game mode for this match. Defaults to Classic if omitted. */
  mode?: GameMode;

  /**
   * Force a specific event type to trigger on every multi-jump.
   * Only meaningful when mode is Crazy. Used for per-event validation.
   */
  forceEvent?: CrazyEvent;

  /**
   * Force a sequence of events to trigger in order, cycling through.
   * Used for pairwise stacking validation. Takes precedence over forceEvent.
   */
  forceEventSequence?: CrazyEvent[];

  /**
   * Extra Crazy mode: trigger an event on every capture move (not just multi-jumps).
   * Simulates Choice mode 8 behavior within the self-play framework.
   */
  extraCrazyMode?: boolean;

  /**
   * Track per-move AI search times for performance benchmarking.
   * When true, GameRecord.moveTimings will be populated.
   */
  trackMoveTimings?: boolean;
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
  result: 'white' | 'black' | 'draw' | 'error';
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

  /** Game mode used (defaults to Classic for Phase 1 records). */
  mode?: GameMode;

  /** Ordered log of events triggered during the game. */
  eventLog?: Array<{ ply: number; event: string }>;

  /** Total number of events triggered. */
  eventCount?: number;

  /** Error message if the game crashed. */
  errorMessage?: string;

  /** Per-move AI search times in ms (when trackMoveTimings is true). */
  moveTimings?: number[];

  /** Number of active events at each move (for perf correlation). */
  activeEventCounts?: number[];
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

  /** Number of games that ended with an error/crash. */
  errorGames: number;

  /** Event statistics (only populated for Crazy mode matches). */
  eventStats?: {
    /** Total events triggered across all games. */
    totalEvents: number;
    /** Average events per game. */
    avgEventsPerGame: number;
    /** Frequency count by event type. */
    eventFrequency: Record<string, number>;
    /** Number of games with zero events triggered. */
    zeroEventGames: number;
  };
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
 * Creates a deterministic PRNG that always selects a specific event index
 * from IMPLEMENTED_EVENTS when used by selectRandomEvent.
 */
function createForcedEventRandom(forceEvent: CrazyEvent): () => number {
  const targetIndex = IMPLEMENTED_EVENTS.indexOf(forceEvent);
  if (targetIndex === -1) {
    throw new Error(`forceEvent ${forceEvent} is not in IMPLEMENTED_EVENTS`);
  }
  return () => (targetIndex + 0.5) / IMPLEMENTED_EVENTS.length;
}

/**
 * Creates a PRNG that cycles through a sequence of forced events.
 */
function createForcedEventSequenceRandom(sequence: CrazyEvent[]): () => number {
  let callCount = 0;
  return () => {
    const event = sequence[callCount % sequence.length] as CrazyEvent;
    callCount++;
    const targetIndex = IMPLEMENTED_EVENTS.indexOf(event);
    if (targetIndex === -1) {
      throw new Error(`forceEvent ${event} is not in IMPLEMENTED_EVENTS`);
    }
    return (targetIndex + 0.5) / IMPLEMENTED_EVENTS.length;
  };
}

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
  gameNumber: number = 0,
  gameSeed: number = 0,
  mode: GameMode = GameMode.Classic,
  forceEvent?: CrazyEvent,
  forceEventSequence?: CrazyEvent[],
  _extraCrazyMode?: boolean,
  trackMoveTimings?: boolean,
): GameRecord {
  const ruleSet = createAmericanRules();
  const isCrazyMode = mode === GameMode.Crazy || mode === GameMode.Chaos;

  // Build the event PRNG for deterministic event selection in Crazy mode.
  // Uses a separate seeded PRNG (derived from gameSeed) so event selection
  // is reproducible. Forced-event PRNGs override when specified.
  let eventRandomFn: (() => number) | undefined;
  if (isCrazyMode) {
    if (forceEventSequence && forceEventSequence.length > 0) {
      eventRandomFn = createForcedEventSequenceRandom(forceEventSequence);
    } else if (forceEvent !== undefined) {
      eventRandomFn = createForcedEventRandom(forceEvent);
    } else {
      // Use a seeded PRNG for deterministic event selection
      eventRandomFn = createSeededRandom(gameSeed + 999_983);
    }
  }

  let currentState: GameState = createNewGame(ruleSet, {
    white: PlayerType.CpuHard,
    black: PlayerType.CpuHard,
  }, mode, eventRandomFn);

  const eventLog: Array<{ ply: number; event: string }> = [];
  let prevEventCount = 0;

  let moveCount = 0;
  let cappedByMoveLimit = false;
  const startTime = performance.now();
  const moveTimings: number[] = [];
  const activeEventCounts: number[] = [];

  while (currentState.status === GameStatus.InProgress) {
    if (moveCount >= maxMoves) {
      cappedByMoveLimit = true;
      break;
    }

    // Check for stalemate: zero legal moves without checkGameOver having
    // fired (e.g., MO + NoTouching combined decorator filtering).
    currentState = checkForStalemate(currentState);
    if (currentState.status !== GameStatus.InProgress) break;

    const difficulty =
      currentState.activeColor === PieceColor.White ? whiteDifficulty : blackDifficulty;

    const config = getDifficultyConfig(difficulty);
    const searchConfig = toSearchConfig(config);

    // Compute the effective board once. Both the AI search and legal-move
    // derivation use this same board, avoiding double onTurnStart application
    // (which would consume PRNG state twice for events like ChecksMix).
    const effectiveBoard = getEffectiveBoard(currentState);
    const searchState: GameState = effectiveBoard !== currentState.board
      ? { ...currentState, board: effectiveBoard }
      : currentState;

    const searchStart = trackMoveTimings ? performance.now() : 0;
    const searchResult = iterativeSearch(searchState, searchConfig);
    if (trackMoveTimings) {
      moveTimings.push(performance.now() - searchStart);
      activeEventCounts.push(currentState.activeEvents.length);
    }

    // Derive legal moves from the same effective board the search used.
    const legalMoves = getLegalMovesFromBoard(currentState, effectiveBoard);

    if (legalMoves.length === 0) {
      // Should not happen after checkForStalemate, but guard defensively.
      currentState = checkForStalemate(currentState);
      break;
    }

    if (searchResult.move === null) {
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

    // With idempotent onTurnStart (single application shared between search
    // and legal moves), the selected move should always be in the legal list.
    currentState = makeMove(currentState, selectedMove);
    moveCount++;

    // Track event triggers for Crazy mode
    if (isCrazyMode) {
      const currentEventCount = currentState.activeEvents.length;
      if (currentEventCount > prevEventCount) {
        for (let i = prevEventCount; i < currentEventCount; i++) {
          const evt = currentState.activeEvents[i];
          if (evt) {
            eventLog.push({ ply: moveCount, event: evt.type });
          }
        }
      }
      prevEventCount = currentEventCount;
    }
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
    gameNumber,
    whiteDifficulty,
    blackDifficulty,
    result,
    reason,
    moveCount,
    elapsedMs,
    cappedByMoveLimit,
    gameSeed,
    mode,
    eventLog: isCrazyMode ? eventLog : undefined,
    eventCount: isCrazyMode ? eventLog.length : undefined,
    moveTimings: trackMoveTimings ? moveTimings : undefined,
    activeEventCounts: trackMoveTimings ? activeEventCounts : undefined,
  };
}

/**
 * Aggregates individual game records into a MatchResult with statistics
 * and anomaly detection.
 */
function aggregateResults(games: GameRecord[], config: MatchConfig): MatchResult {
  const wins = { white: 0, black: 0, draw: 0 };
  let totalMoves = 0;
  let maxMoves = 0;
  let minMoves = Infinity;
  let cappedCount = 0;
  let errorCount = 0;
  const anomalous: number[] = [];

  const isCrazyMode = config.mode === GameMode.Crazy || config.mode === GameMode.Chaos;
  const shortGameThreshold = isCrazyMode ? 6 : 10;
  const longGameThreshold = isCrazyMode ? 400 : Infinity;

  for (const game of games) {
    if (game.result === 'error') {
      errorCount++;
      anomalous.push(game.gameNumber);
      continue;
    }

    wins[game.result]++;
    totalMoves += game.moveCount;
    maxMoves = Math.max(maxMoves, game.moveCount);
    minMoves = Math.min(minMoves, game.moveCount);
    if (game.cappedByMoveLimit) cappedCount++;

    if (game.cappedByMoveLimit) {
      anomalous.push(game.gameNumber);
    }
    if (game.moveCount < shortGameThreshold) {
      anomalous.push(game.gameNumber);
    }
    if (game.moveCount > longGameThreshold) {
      anomalous.push(game.gameNumber);
    }

    // Crazy mode: flag zero-event games
    if (isCrazyMode && (game.eventCount ?? 0) === 0) {
      anomalous.push(game.gameNumber);
    }

    // Crazy mode: flag 3+ consecutive same-event triggers
    if (isCrazyMode && game.eventLog && game.eventLog.length >= 3) {
      for (let i = 2; i < game.eventLog.length; i++) {
        const curr = game.eventLog[i];
        const prev1 = game.eventLog[i - 1];
        const prev2 = game.eventLog[i - 2];
        if (curr && prev1 && prev2 && curr.event === prev1.event && curr.event === prev2.event) {
          anomalous.push(game.gameNumber);
          break;
        }
      }
    }
  }

  const nonErrorGames = games.filter((g) => g.result !== 'error');

  let primaryWinRate: number;
  if (config.alternateColors) {
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

  // Crazy mode event statistics
  let eventStats: MatchResult['eventStats'] = undefined;
  if (isCrazyMode) {
    const totalEvents = games.reduce((sum, g) => sum + (g.eventCount ?? 0), 0);
    const frequency: Record<string, number> = {};
    for (const game of games) {
      for (const entry of game.eventLog ?? []) {
        frequency[entry.event] = (frequency[entry.event] ?? 0) + 1;
      }
    }
    eventStats = {
      totalEvents,
      avgEventsPerGame: games.length > 0 ? totalEvents / games.length : 0,
      eventFrequency: frequency,
      zeroEventGames: games.filter((g) => (g.eventCount ?? 0) === 0).length,
    };
  }

  return {
    games,
    totalGames: games.length,
    wins,
    primaryWinRate,
    avgMoveCount: nonErrorGames.length > 0 ? totalMoves / nonErrorGames.length : 0,
    maxMoveCount: maxMoves,
    minMoveCount: minMoves === Infinity ? 0 : minMoves,
    cappedGames: cappedCount,
    totalElapsedMs: games.reduce((sum, g) => sum + g.elapsedMs, 0),
    anomalousGames: [...new Set(anomalous)],
    errorGames: errorCount,
    eventStats,
  };
}

/**
 * Runs a full match of N games between two AI configurations.
 * Returns aggregated results with per-game detail.
 */
export function runMatch(config: MatchConfig): MatchResult {
  const games: GameRecord[] = [];
  const mode = config.mode ?? GameMode.Classic;

  for (let i = 0; i < config.gameCount; i++) {
    const gameSeed = config.seed + i * 7919;
    const randomFn = createSeededRandom(gameSeed);

    let whiteDiff = config.whiteDifficulty;
    let blackDiff = config.blackDifficulty;
    if (config.alternateColors && i % 2 === 1) {
      whiteDiff = config.blackDifficulty;
      blackDiff = config.whiteDifficulty;
    }

    let record: GameRecord;
    try {
      record = playSingleGame(
        whiteDiff,
        blackDiff,
        config.maxMovesPerGame,
        randomFn,
        i + 1,
        gameSeed,
        mode,
        config.forceEvent,
        config.forceEventSequence,
        config.extraCrazyMode,
        config.trackMoveTimings,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      record = {
        gameNumber: i + 1,
        whiteDifficulty: whiteDiff,
        blackDifficulty: blackDiff,
        result: 'error',
        reason: 'crash',
        moveCount: 0,
        elapsedMs: 0,
        cappedByMoveLimit: false,
        gameSeed,
        mode,
        errorMessage,
      };
    }

    games.push(record);

    if (config.onGameComplete) {
      config.onGameComplete(record);
    }
  }

  return aggregateResults(games, config);
}

export { VALID_REASONS };
