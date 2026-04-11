/**
 * Shared utility functions for the puzzle generation pipeline.
 *
 * Provides: instrumentedPlayGame, board deserialization, game state construction,
 * solution path extraction, puzzle classification, difficulty scoring, and
 * time threshold computation.
 */

import type { BoardState, GameState, Move, SquareState } from '../src/engine/types.ts';
import {
  GameMode,
  GameStatus,
  PieceColor,
  PieceType,
  PlayerType,
  square,
} from '../src/engine/types.ts';
import { createAmericanRules } from '../src/engine/rules.ts';
import {
  createNewGame,
  getCurrentLegalMoves,
  makeMove,
  checkForStalemate,
} from '../src/engine/game.ts';
import { countPieces } from '../src/engine/board.ts';
import { iterativeSearch } from '../src/ai/search.ts';
import type { SearchConfig } from '../src/ai/search.ts';
import { evaluate } from '../src/ai/evaluator.ts';
import {
  getDifficultyConfig,
  toSearchConfig,
  selectMove,
} from '../src/ai/difficulty.ts';
import type { Difficulty } from '../src/ai/difficulty.ts';
import { createSeededRandom } from '../src/ai/validation/selfPlay.ts';
import { serializeBoard } from '../src/persistence/serialization.ts';
import { moveToString, stringToMove } from '../src/utils/notation.ts';
import { computeZobristHash } from '../src/engine/zobrist.ts';
import { getLegalMoves } from '../src/engine/moves.ts';
import {
  MAX_MOVES_PER_GAME,
  EVAL_SWING_THRESHOLD_CP,
  SOLUTION_UNIQUENESS_MARGIN_CP,
  MIN_PIECE_COUNT,
  MAX_PIECE_COUNT,
  VALIDATION_SEARCH_DEPTH,
  VALIDATION_TIME_LIMIT_MS,
  SELF_PLAY_TIME_LIMIT_MS,
  DIFFICULTY_WEIGHTS,
  BASE_TIME_PER_MOVE_MS,
  EXPERT_TIME_PER_MOVE_MS,
  SLOW_THRESHOLD_MULTIPLIER,
  SOLUTION_PATH_MAX_DEPTH,
  DECISIVE_ADVANTAGE_CP,
} from './puzzleGenConfig.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstrumentedGameRecord {
  gameId: string;
  gameSeed: number;
  whiteDifficulty: Difficulty;
  blackDifficulty: Difficulty;
  result: string;
  reason: string;
  boardStates: string[];
  activeColors: PieceColor[];
  movesPlayed: Move[];
  evaluations: number[];
  plyCount: number;
}

export interface CandidatePuzzle {
  boardState: string;
  activeColor: PieceColor;
  sourceGameId: string;
  sourcePly: number;
  evalSwing: number;
  pieceCount: number;
  tentativeFirstMove: Move;
}

export interface ValidatedPuzzle extends CandidatePuzzle {
  solutionPath: string[];
  solutionDepth: number;
  bestScore: number;
  margin: number;
  rootMoveScores: Array<{ move: Move; score: number }>;
}

export type PuzzleType =
  | 'forced_capture_chain'
  | 'promotion_forcing'
  | 'sacrifice_and_recapture'
  | 'positional_squeeze'
  | 'king_vs_pawns_endgame'
  | 'winning_combination';

export interface RatedPuzzle extends ValidatedPuzzle {
  difficultyRating: number;
  difficultyTier: 'easy' | 'medium' | 'hard';
  puzzleType: PuzzleType;
  goal: string;
  thresholdFastMs: number;
  thresholdSlowMs: number;
}

export interface PuzzleDefinition {
  readonly id: number;
  readonly boardState: string;
  readonly activeColor: 'white' | 'black';
  readonly goal: string;
  readonly solutionPath: readonly string[];
  readonly solutionDepth: number;
  readonly difficultyRating: number;
  readonly difficultyTier: 'easy' | 'medium' | 'hard';
  readonly pieceCount: number;
  readonly puzzleType: string;
  readonly sourceGameId: string;
  readonly sourcePly: number;
  readonly thresholdFastMs: number;
  readonly thresholdSlowMs: number;
}

// ---------------------------------------------------------------------------
// Board deserialization
// ---------------------------------------------------------------------------

/**
 * Parses a 32-character serialized string back into a BoardState array.
 * Inverse of serializeBoard.
 */
export function deserializeBoardState(serialized: string): BoardState {
  if (serialized.length !== 32) {
    throw new Error(`Invalid board string length: ${String(serialized.length)}, expected 32`);
  }

  const board: SquareState[] = [];
  for (let i = 0; i < 32; i++) {
    const ch = serialized[i];
    switch (ch) {
      case '.':
        board.push(null);
        break;
      case 'w':
        board.push({ color: PieceColor.White, type: PieceType.Pawn });
        break;
      case 'W':
        board.push({ color: PieceColor.White, type: PieceType.King });
        break;
      case 'b':
        board.push({ color: PieceColor.Black, type: PieceType.Pawn });
        break;
      case 'B':
        board.push({ color: PieceColor.Black, type: PieceType.King });
        break;
      default:
        throw new Error(`Invalid board character '${String(ch)}' at position ${String(i)}`);
    }
  }
  return board;
}

// ---------------------------------------------------------------------------
// GameState construction from board
// ---------------------------------------------------------------------------

/**
 * Wraps a BoardState and activeColor into a minimal GameState suitable for iterativeSearch.
 * Uses AmericanRules in Classic mode — no events.
 */
export function createGameStateFromBoard(board: BoardState, activeColor: PieceColor): GameState {
  return {
    board,
    activeColor,
    status: GameStatus.InProgress,
    result: null,
    ruleSet: createAmericanRules(),
    players: {
      white: PlayerType.CpuHard,
      black: PlayerType.CpuHard,
    },
    moveHistory: [],
    positionHashes: [computeZobristHash(board, activeColor)],
    halfMoveClock: 0,
    plyCount: 0,
    mode: GameMode.Classic,
    activeEvents: [],
  };
}

// ---------------------------------------------------------------------------
// Piece counting helpers
// ---------------------------------------------------------------------------

/** Returns total piece count on a serialized board. */
export function countPiecesFromSerialized(serialized: string): number {
  let count = 0;
  for (let i = 0; i < serialized.length; i++) {
    if (serialized[i] !== '.') count++;
  }
  return count;
}

/** Counts kings on a board. */
export function countKings(board: BoardState): number {
  let count = 0;
  for (const sq of board) {
    if (sq !== null && sq.type === PieceType.King) count++;
  }
  return count;
}

/** Center squares: 14, 15, 18, 19 (1-indexed). Board array is 0-indexed. */
const CENTER_INDICES = new Set([13, 14, 17, 18]); // 0-indexed = square-1

/** Counts pieces in center squares. */
export function countPiecesInCenter(board: BoardState): number {
  let count = 0;
  for (const idx of CENTER_INDICES) {
    if (board[idx] !== null && board[idx] !== undefined) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Instrumented self-play
// ---------------------------------------------------------------------------

/**
 * Plays a single game with full per-ply instrumentation.
 * Records board states, evaluations, and moves at every ply.
 */
export function instrumentedPlayGame(
  whiteDifficulty: Difficulty,
  blackDifficulty: Difficulty,
  gameSeed: number,
  gameId: string,
  maxMoves: number = MAX_MOVES_PER_GAME,
): InstrumentedGameRecord {
  const ruleSet = createAmericanRules();
  const gameRandom = createSeededRandom(gameSeed);

  let state: GameState = createNewGame(ruleSet, {
    white: PlayerType.CpuHard,
    black: PlayerType.CpuHard,
  }, GameMode.Classic);

  const boardStates: string[] = [];
  const activeColors: PieceColor[] = [];
  const movesPlayed: Move[] = [];
  const evaluations: number[] = [];

  let plyCount = 0;

  while (state.status === GameStatus.InProgress && plyCount < maxMoves) {
    state = checkForStalemate(state);
    if (state.status !== GameStatus.InProgress) break;

    const board = state.board;
    const color = state.activeColor;

    boardStates.push(serializeBoard(board));
    activeColors.push(color);
    evaluations.push(evaluate(board, color));

    const difficulty = color === PieceColor.White ? whiteDifficulty : blackDifficulty;
    const config = getDifficultyConfig(difficulty);

    // Use reduced depth and time limit for self-play phase to speed up generation.
    // Easy AI already uses depth 4 with no quiescence (fast).
    // Hard AI gets capped at depth 6 + SELF_PLAY_TIME_LIMIT_MS for speed.
    // Depth 6 produces sufficient play quality for tactical position extraction.
    const searchConfig: SearchConfig = {
      ...toSearchConfig(config),
      maxDepth: difficulty === 'hard' ? 6 : config.maxDepth,
      timeLimitMs: difficulty === 'hard' ? SELF_PLAY_TIME_LIMIT_MS : config.timeLimitMs,
    };

    const searchResult = iterativeSearch(state, searchConfig);
    const legalMoves = getCurrentLegalMoves(state);

    if (legalMoves.length === 0) {
      state = checkForStalemate(state);
      break;
    }

    if (searchResult.move === null) {
      break;
    }

    const selectedMove = selectMove(
      searchResult,
      searchResult.rootMoveScores,
      legalMoves,
      config,
      gameRandom,
    );

    movesPlayed.push(selectedMove);
    state = makeMove(state, selectedMove);
    plyCount++;
  }

  let result: string;
  let reason: string;

  if (plyCount >= maxMoves) {
    result = 'capped';
    reason = 'move-limit-cap';
  } else if (state.result) {
    result = state.result.type;
    reason = state.result.reason;
  } else {
    result = 'draw';
    reason = 'unknown';
  }

  return {
    gameId,
    gameSeed,
    whiteDifficulty,
    blackDifficulty,
    result,
    reason,
    boardStates,
    activeColors,
    movesPlayed,
    evaluations,
    plyCount,
  };
}

// ---------------------------------------------------------------------------
// Position extraction
// ---------------------------------------------------------------------------

/**
 * Extracts candidate puzzle positions from instrumented game records.
 * Identifies tactical moments via evaluation swings.
 * Deduplicates by boardState + activeColor.
 */
export function extractCandidates(games: InstrumentedGameRecord[]): CandidatePuzzle[] {
  const candidateMap = new Map<string, CandidatePuzzle>();

  for (const game of games) {
    for (let n = 2; n < game.plyCount; n++) {
      const evalCurrent = game.evaluations[n];
      const evalPrevious = game.evaluations[n - 2];
      if (evalCurrent === undefined || evalPrevious === undefined) continue;

      const swing = evalCurrent - evalPrevious;
      if (swing < EVAL_SWING_THRESHOLD_CP) continue;

      const boardState = game.boardStates[n];
      const activeColor = game.activeColors[n];
      const tentativeFirstMove = game.movesPlayed[n];
      if (!boardState || !activeColor || !tentativeFirstMove) continue;

      const pieceCount = countPiecesFromSerialized(boardState);
      if (pieceCount < MIN_PIECE_COUNT || pieceCount > MAX_PIECE_COUNT) continue;

      const key = `${boardState}:${activeColor}`;
      const existing = candidateMap.get(key);
      if (!existing || swing > existing.evalSwing) {
        candidateMap.set(key, {
          boardState,
          activeColor,
          sourceGameId: game.gameId,
          sourcePly: n,
          evalSwing: swing,
          pieceCount,
          tentativeFirstMove,
        });
      }
    }
  }

  return Array.from(candidateMap.values());
}

// ---------------------------------------------------------------------------
// Solution path extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the forced solution line from a position.
 * Alternates best-move for each side until the position is clearly decided
 * or max depth is reached.
 */
export function extractSolutionPath(
  state: GameState,
  config: SearchConfig,
  maxPlies: number = SOLUTION_PATH_MAX_DEPTH,
): Move[] {
  const path: Move[] = [];
  let current = state;

  for (let i = 0; i < maxPlies; i++) {
    if (current.status !== GameStatus.InProgress) break;

    const legalMoves = getCurrentLegalMoves(current);
    if (legalMoves.length === 0) break;

    const result = iterativeSearch(current, config);
    if (result.move === null) break;

    path.push(result.move);
    current = makeMove(current, result.move);
    current = checkForStalemate(current);
  }

  return path;
}

/**
 * Counts the number of player half-moves in a solution path.
 * Even indices (0, 2, 4...) are the puzzle solver's moves.
 */
export function countPlayerMoves(path: Move[] | string[]): number {
  return Math.ceil(path.length / 2);
}

// ---------------------------------------------------------------------------
// Solution validation
// ---------------------------------------------------------------------------

/**
 * Verifies that a solution path is executable from a given state.
 * Every move in the path must be legal.
 */
export function verifySolutionExecutable(state: GameState, solutionPath: string[]): boolean {
  let current = state;

  for (const notation of solutionPath) {
    if (current.status !== GameStatus.InProgress) return false;

    try {
      const move = stringToMove(notation, current.board);
      const legalMoves = getCurrentLegalMoves(current);
      const isLegal = legalMoves.some(
        (lm) =>
          (lm.from as number) === (move.from as number) &&
          lm.path.length === move.path.length &&
          lm.path.every((sq, idx) => (sq as number) === (move.path[idx] as number)),
      );
      if (!isLegal) return false;

      current = makeMove(current, move);
      current = checkForStalemate(current);
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Validates a single candidate puzzle position.
 * Returns a ValidatedPuzzle if the position has a unique, decisive optimal solution.
 * Returns null if the position is rejected.
 */
export function validateCandidate(candidate: CandidatePuzzle): ValidatedPuzzle | null {
  const board = deserializeBoardState(candidate.boardState);
  const state = createGameStateFromBoard(board, candidate.activeColor);

  const searchConfig: SearchConfig = {
    maxDepth: VALIDATION_SEARCH_DEPTH,
    timeLimitMs: VALIDATION_TIME_LIMIT_MS,
    quiescenceEnabled: true,
    quiescenceMaxDepth: 4,
  };

  const result = iterativeSearch(state, searchConfig);

  // Check 1: Best move must exist
  if (result.move === null) return null;

  // Check 2: Solution uniqueness — need at least 2 legal moves
  const rootScores = [...result.rootMoveScores].sort((a, b) => b.score - a.score);
  if (rootScores.length < 2) return null; // trivial single-move position

  const bestScore = rootScores[0]!.score;
  const secondBestScore = rootScores[1]!.score;
  const margin = bestScore - secondBestScore;

  if (margin < SOLUTION_UNIQUENESS_MARGIN_CP) return null; // ambiguous

  // Check 3: Extract the full solution path
  const solutionMoves = extractSolutionPath(state, searchConfig);
  if (solutionMoves.length === 0) return null;

  // Check 4: Solution terminates in a clearly won position
  let finalState = state;
  for (const move of solutionMoves) {
    finalState = makeMove(finalState, move);
    finalState = checkForStalemate(finalState);
  }

  // For positions where the game ended (checkmate equivalent), consider it decisive
  if (finalState.status !== GameStatus.InProgress) {
    // Game over — check if the puzzle solver won
    if (finalState.result) {
      const solverWins =
        (candidate.activeColor === PieceColor.White && finalState.result.type === 'WHITE_WIN') ||
        (candidate.activeColor === PieceColor.Black && finalState.result.type === 'BLACK_WIN');
      if (!solverWins) return null;
    }
  } else {
    // Still in progress — check evaluation advantage
    const finalEval = evaluate(finalState.board, candidate.activeColor);
    if (finalEval < DECISIVE_ADVANTAGE_CP) return null;
  }

  // Check 5: Verify solution path is executable
  const solutionNotation = solutionMoves.map(moveToString);
  if (!verifySolutionExecutable(state, solutionNotation)) return null;

  return {
    ...candidate,
    solutionPath: solutionNotation,
    solutionDepth: countPlayerMoves(solutionMoves),
    bestScore,
    margin,
    rootMoveScores: rootScores.map((s) => ({ move: s.move, score: s.score })),
  };
}

// ---------------------------------------------------------------------------
// Puzzle type classification
// ---------------------------------------------------------------------------

/**
 * Classifies a puzzle based on its solution characteristics.
 */
export function classifyPuzzleType(
  validated: ValidatedPuzzle,
): PuzzleType {
  const board = deserializeBoardState(validated.boardState);
  const state = createGameStateFromBoard(board, validated.activeColor);

  // Replay solution to analyze
  const moves: Move[] = [];
  let current = state;
  for (const notation of validated.solutionPath) {
    try {
      const move = stringToMove(notation, current.board);
      moves.push(move);
      current = makeMove(current, move);
      current = checkForStalemate(current);
    } catch {
      break;
    }
  }

  // Check: consecutive captures by the player (even indices)
  let consecutiveCaptures = 0;
  for (let i = 0; i < moves.length; i += 2) {
    const m = moves[i];
    if (m && m.captured.length > 0) {
      consecutiveCaptures++;
    } else {
      consecutiveCaptures = 0;
    }
  }
  if (consecutiveCaptures >= 2) return 'forced_capture_chain';

  // Check: last player move is a promotion
  const lastPlayerMoveIdx = moves.length % 2 === 0 ? moves.length - 2 : moves.length - 1;
  const lastPlayerMove = moves[lastPlayerMoveIdx];
  if (lastPlayerMove) {
    const lastLanding = lastPlayerMove.path[lastPlayerMove.path.length - 1];
    if (lastLanding !== undefined) {
      const landingNum = lastLanding as number;
      const isWhitePromotion = validated.activeColor === PieceColor.White && landingNum >= 1 && landingNum <= 4;
      const isBlackPromotion = validated.activeColor === PieceColor.Black && landingNum >= 29 && landingNum <= 32;
      if (isWhitePromotion || isBlackPromotion) return 'promotion_forcing';
    }
  }

  // Check: sacrifice and recapture
  if (moves.length >= 3) {
    const firstMove = moves[0];
    const thirdMove = moves[2];
    if (firstMove && thirdMove) {
      // First move is non-capture or loses material; third move captures more
      if (firstMove.captured.length === 0 && thirdMove.captured.length > 0) {
        return 'sacrifice_and_recapture';
      }
    }
  }

  // Check: positional squeeze (opponent has no legal moves but pieces remain)
  if (current.status === GameStatus.InProgress || current.result?.reason === 'NO_LEGAL_MOVES') {
    if (current.result?.reason === 'NO_LEGAL_MOVES') return 'positional_squeeze';
  }

  // Check: king vs pawns endgame
  const pieces = countPieces(board);
  const solverIsWhite = validated.activeColor === PieceColor.White;
  const solverKings = solverIsWhite ? pieces.white.kings : pieces.black.kings;
  const solverPawns = solverIsWhite ? pieces.white.pawns : pieces.black.pawns;
  const opponentPawns = solverIsWhite ? pieces.black.pawns : pieces.white.pawns;
  const opponentKings = solverIsWhite ? pieces.black.kings : pieces.white.kings;

  if (solverKings > 0 && solverPawns === 0 && opponentPawns > 0 && opponentKings === 0) {
    return 'king_vs_pawns_endgame';
  }

  return 'winning_combination';
}

// ---------------------------------------------------------------------------
// Goal text generation
// ---------------------------------------------------------------------------

const GOAL_TEXT: Record<PuzzleType, string | ((depth: number) => string)> = {
  forced_capture_chain: 'Find the winning capture sequence',
  promotion_forcing: (depth: number) => `Force a king in ${String(depth)} moves`,
  sacrifice_and_recapture: 'Sacrifice to win',
  positional_squeeze: 'Leave your opponent with no legal moves',
  king_vs_pawns_endgame: 'Find the winning king maneuver',
  winning_combination: 'Find the best move',
};

export function generateGoalText(puzzleType: PuzzleType, solutionDepth: number): string {
  const template = GOAL_TEXT[puzzleType];
  if (typeof template === 'function') return template(solutionDepth);
  return template;
}

// ---------------------------------------------------------------------------
// Difficulty scoring
// ---------------------------------------------------------------------------

/**
 * Computes a composite difficulty score in [0, 1] for a validated puzzle.
 */
export function computeDifficultyScore(validated: ValidatedPuzzle): number {
  // Factor 1: Solution Depth (40% weight)
  const depthScore = Math.min(validated.solutionDepth / 8, 1.0);

  // Factor 2: Branching Factor (35% weight)
  const board = deserializeBoardState(validated.boardState);
  let tempState = createGameStateFromBoard(board, validated.activeColor);
  const branchingScores: number[] = [];

  for (const notation of validated.solutionPath) {
    const legalCount = getCurrentLegalMoves(tempState).length;
    branchingScores.push(legalCount);
    try {
      const move = stringToMove(notation, tempState.board);
      tempState = makeMove(tempState, move);
      tempState = checkForStalemate(tempState);
    } catch {
      break;
    }
  }

  let branchingScore = 0;
  if (branchingScores.length > 0) {
    const len = branchingScores.length;
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < len; i++) {
      const weight = len - i;
      weightedSum += (branchingScores[i] ?? 0) * weight;
      totalWeight += weight;
    }
    const avgBranching = totalWeight > 0 ? weightedSum / totalWeight : 0;
    branchingScore = Math.min(avgBranching / 8, 1.0);
  }

  // Factor 3: Positional Complexity (25% weight)
  const pieceCount = validated.pieceCount;
  const kingCount = countKings(board);
  const centerPieceCount = countPiecesInCenter(board);

  const complexityScore =
    (pieceCount / MAX_PIECE_COUNT) * 0.5 +
    (pieceCount > 0 ? (kingCount / pieceCount) * 0.3 : 0) +
    (pieceCount > 0 ? (centerPieceCount / pieceCount) * 0.2 : 0);

  return (
    depthScore * DIFFICULTY_WEIGHTS.depth +
    branchingScore * DIFFICULTY_WEIGHTS.branching +
    complexityScore * DIFFICULTY_WEIGHTS.complexity
  );
}

// ---------------------------------------------------------------------------
// Time threshold calculation
// ---------------------------------------------------------------------------

/**
 * Computes T₁ (3-star) and T₂ (1-star) time thresholds for a puzzle.
 */
export function computeTimeThresholds(
  puzzleIndex: number,
  solutionDepth: number,
  branchingScore: number,
): { thresholdFastMs: number; thresholdSlowMs: number } {
  // Interpolate base time per move based on difficulty position (1–100)
  const timePerMove =
    BASE_TIME_PER_MOVE_MS +
    (EXPERT_TIME_PER_MOVE_MS - BASE_TIME_PER_MOVE_MS) * ((puzzleIndex - 1) / 99);

  // difficultyMultiplier from branching factor (1.0 for trivial, up to 2.0 for complex)
  const difficultyMultiplier = 1.0 + branchingScore;

  const thresholdFastMs = Math.round(solutionDepth * timePerMove * difficultyMultiplier);
  const thresholdSlowMs = Math.round(thresholdFastMs * SLOW_THRESHOLD_MULTIPLIER);

  return { thresholdFastMs, thresholdSlowMs };
}

/**
 * Computes the branching score for a puzzle (needed for time threshold calc).
 */
export function computeBranchingScore(validated: ValidatedPuzzle): number {
  const board = deserializeBoardState(validated.boardState);
  let tempState = createGameStateFromBoard(board, validated.activeColor);
  const branchingScores: number[] = [];

  for (const notation of validated.solutionPath) {
    const legalCount = getCurrentLegalMoves(tempState).length;
    branchingScores.push(legalCount);
    try {
      const move = stringToMove(notation, tempState.board);
      tempState = makeMove(tempState, move);
      tempState = checkForStalemate(tempState);
    } catch {
      break;
    }
  }

  if (branchingScores.length === 0) return 0;

  const len = branchingScores.length;
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < len; i++) {
    const weight = len - i;
    weightedSum += (branchingScores[i] ?? 0) * weight;
    totalWeight += weight;
  }

  const avgBranching = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return Math.min(avgBranching / 8, 1.0);
}

// ---------------------------------------------------------------------------
// QA checks
// ---------------------------------------------------------------------------

/**
 * Runs automated QA checks on a set of puzzles.
 * Returns an array of error messages (empty = all passed).
 */
export function runQAChecks(puzzles: RatedPuzzle[]): string[] {
  const errors: string[] = [];

  // 1. Legality check
  for (let i = 0; i < puzzles.length; i++) {
    const p = puzzles[i]!;
    try {
      const board = deserializeBoardState(p.boardState);
      const legal = getLegalMoves(board, p.activeColor);
      if (legal.length === 0) {
        errors.push(`Puzzle ${String(i + 1)}: no legal moves from starting position`);
      }
    } catch (e) {
      errors.push(`Puzzle ${String(i + 1)}: board deserialization failed: ${String(e)}`);
    }
  }

  // 2. Solution executability
  for (let i = 0; i < puzzles.length; i++) {
    const p = puzzles[i]!;
    const board = deserializeBoardState(p.boardState);
    const state = createGameStateFromBoard(board, p.activeColor);
    if (!verifySolutionExecutable(state, p.solutionPath)) {
      errors.push(`Puzzle ${String(i + 1)}: solution path is not executable`);
    }
  }

  // 3. Uniqueness
  const seen = new Set<string>();
  for (let i = 0; i < puzzles.length; i++) {
    const p = puzzles[i]!;
    const key = `${p.boardState}:${p.activeColor}`;
    if (seen.has(key)) {
      errors.push(`Puzzle ${String(i + 1)}: duplicate board position`);
    }
    seen.add(key);
  }

  // 4. Monotonic difficulty
  for (let i = 0; i < puzzles.length - 1; i++) {
    if (puzzles[i]!.difficultyRating > puzzles[i + 1]!.difficultyRating) {
      errors.push(
        `Puzzle ${String(i + 1)}: difficulty not monotonic (${String(puzzles[i]!.difficultyRating)} > ${String(puzzles[i + 1]!.difficultyRating)})`,
      );
    }
  }

  // 5. Threshold sanity
  for (let i = 0; i < puzzles.length; i++) {
    const p = puzzles[i]!;
    if (p.thresholdFastMs <= 0) {
      errors.push(`Puzzle ${String(i + 1)}: thresholdFastMs <= 0`);
    }
    if (p.thresholdSlowMs <= p.thresholdFastMs) {
      errors.push(`Puzzle ${String(i + 1)}: thresholdSlowMs <= thresholdFastMs`);
    }
  }

  // 6. Balanced color representation
  const whiteCount = puzzles.filter((p) => p.activeColor === PieceColor.White).length;
  const blackCount = puzzles.filter((p) => p.activeColor === PieceColor.Black).length;
  if (whiteCount < puzzles.length * 0.35) {
    errors.push(`Color imbalance: only ${String(whiteCount)} white puzzles (need >= 35%)`);
  }
  if (blackCount < puzzles.length * 0.35) {
    errors.push(`Color imbalance: only ${String(blackCount)} black puzzles (need >= 35%)`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Difficulty tier assignment
// ---------------------------------------------------------------------------

/**
 * Assigns difficulty tiers based on position in sorted sequence.
 * Puzzles 1–20 → easy, 21–60 → medium, 61–100 → hard.
 */
export function assignDifficultyTier(index1Based: number): 'easy' | 'medium' | 'hard' {
  if (index1Based <= 20) return 'easy';
  if (index1Based <= 60) return 'medium';
  return 'hard';
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { createSeededRandom } from '../src/ai/validation/selfPlay.ts';
export { serializeBoard } from '../src/persistence/serialization.ts';
export { moveToString } from '../src/utils/notation.ts';
export { getLegalMoves } from '../src/engine/moves.ts';
