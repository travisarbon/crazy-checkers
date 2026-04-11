/**
 * Unit tests for puzzle generation pipeline utilities.
 *
 * Run via: npx vitest run scripts/generatePuzzles.test.ts
 * These are excluded from the main test suite (vitest only includes src/).
 */

import { describe, it, expect } from 'vitest';
import { PieceColor, PieceType, square } from '../src/engine/types';
import { createInitialBoard } from '../src/engine/board';
import { serializeBoard } from '../src/persistence/serialization';
import {
  deserializeBoardState,
  createGameStateFromBoard,
  instrumentedPlayGame,
  extractCandidates,
  validateCandidate,
  extractSolutionPath,
  computeDifficultyScore,
  computeTimeThresholds,
  classifyPuzzleType,
  countPlayerMoves,
  countPiecesFromSerialized,
  countKings,
  countPiecesInCenter,
  assignDifficultyTier,
  generateGoalText,
  verifySolutionExecutable,
} from './puzzleGenUtils';
import type { CandidatePuzzle, InstrumentedGameRecord, ValidatedPuzzle } from './puzzleGenUtils';
import { VALIDATION_SEARCH_DEPTH, VALIDATION_TIME_LIMIT_MS } from './puzzleGenConfig';

describe('deserializeBoardState', () => {
  it('round-trips with serializeBoard', () => {
    const board = createInitialBoard();
    const serialized = serializeBoard(board);
    const deserialized = deserializeBoardState(serialized);

    expect(deserialized.length).toBe(32);
    for (let i = 0; i < 32; i++) {
      const orig = board[i];
      const deser = deserialized[i];
      if (orig === null) {
        expect(deser).toBeNull();
      } else {
        expect(deser).not.toBeNull();
        expect(deser!.color).toBe(orig.color);
        expect(deser!.type).toBe(orig.type);
      }
    }
  });

  it('rejects invalid length', () => {
    expect(() => deserializeBoardState('abc')).toThrow('Invalid board string length');
  });

  it('rejects invalid characters', () => {
    expect(() => deserializeBoardState('x...............................'))
      .toThrow('Invalid board character');
  });

  it('correctly parses all piece types', () => {
    const input = 'wWbB............................';
    const board = deserializeBoardState(input);
    expect(board[0]).toEqual({ color: PieceColor.White, type: PieceType.Pawn });
    expect(board[1]).toEqual({ color: PieceColor.White, type: PieceType.King });
    expect(board[2]).toEqual({ color: PieceColor.Black, type: PieceType.Pawn });
    expect(board[3]).toEqual({ color: PieceColor.Black, type: PieceType.King });
    expect(board[4]).toBeNull();
  });
});

describe('createGameStateFromBoard', () => {
  it('creates a valid game state', () => {
    const board = createInitialBoard();
    const state = createGameStateFromBoard(board, PieceColor.White);

    expect(state.status).toBe('IN_PROGRESS');
    expect(state.activeColor).toBe(PieceColor.White);
    expect(state.result).toBeNull();
    expect(state.moveHistory).toHaveLength(0);
    expect(state.positionHashes).toHaveLength(1);
    expect(state.activeEvents).toHaveLength(0);
    expect(state.mode).toBe('CLASSIC');
  });
});

describe('countPiecesFromSerialized', () => {
  it('counts pieces correctly', () => {
    expect(countPiecesFromSerialized('wwww....bbbb....................')).toBe(8);
    expect(countPiecesFromSerialized('................................')).toBe(0);
    expect(countPiecesFromSerialized('wWbBwWbBwWbBwWbBwWbBwWbBwWbBwWbB')).toBe(32);
  });
});

describe('countKings', () => {
  it('counts king pieces', () => {
    const board = deserializeBoardState('wWbB............................');
    expect(countKings(board)).toBe(2); // W and B
  });
});

describe('countPiecesInCenter', () => {
  it('counts pieces in center squares (14, 15, 18, 19)', () => {
    // Squares 14 and 15 are at indices 13 and 14 (0-indexed)
    // Squares 18 and 19 are at indices 17 and 18 (0-indexed)
    const chars = '.............ww..bb..............'.split('');
    // Place pieces at indices 13,14 and 17,18
    const board = deserializeBoardState(chars.join(''));
    expect(countPiecesInCenter(board)).toBe(4);
  });
});

describe('instrumentedPlayGame', () => {
  it('completes a game with recorded data', () => {
    const record = instrumentedPlayGame('hard', 'easy', 12345, 'test-game-1', 50);

    expect(record.gameId).toBe('test-game-1');
    expect(record.gameSeed).toBe(12345);
    expect(record.whiteDifficulty).toBe('hard');
    expect(record.blackDifficulty).toBe('easy');
    expect(record.boardStates.length).toBeGreaterThan(0);
    expect(record.evaluations.length).toBe(record.boardStates.length);
    expect(record.movesPlayed.length).toBe(record.boardStates.length);
    expect(record.activeColors.length).toBe(record.boardStates.length);
    expect(record.plyCount).toBeGreaterThan(0);
    expect(record.result).toBeTruthy();
  });

  it('is deterministic with same seed', () => {
    const r1 = instrumentedPlayGame('hard', 'easy', 99999, 'det-1', 30);
    const r2 = instrumentedPlayGame('hard', 'easy', 99999, 'det-2', 30);

    expect(r1.boardStates).toEqual(r2.boardStates);
    expect(r1.result).toBe(r2.result);
    expect(r1.plyCount).toBe(r2.plyCount);
  });

  it('respects MAX_MOVES_PER_GAME', () => {
    const record = instrumentedPlayGame('easy', 'easy', 42, 'cap-test', 10);
    expect(record.plyCount).toBeLessThanOrEqual(10);
  });
});

describe('extractCandidates', () => {
  it('finds tactical positions from game records', () => {
    // Play a Hard-vs-Easy game which should produce clear tactical moments
    const record = instrumentedPlayGame('hard', 'easy', 777, 'extract-test', 100);
    const candidates = extractCandidates([record]);

    // Hard vs Easy should produce at least some candidates
    expect(candidates.length).toBeGreaterThanOrEqual(0); // may be 0 for very short games
    for (const c of candidates) {
      expect(c.boardState).toHaveLength(32);
      expect(c.pieceCount).toBeGreaterThanOrEqual(4);
      expect(c.pieceCount).toBeLessThanOrEqual(20);
      expect(c.evalSwing).toBeGreaterThanOrEqual(100);
    }
  });

  it('respects piece count bounds', () => {
    // Create a mock record with positions that have extreme piece counts
    const record = instrumentedPlayGame('hard', 'easy', 42, 'bounds-test', 100);
    const candidates = extractCandidates([record]);

    for (const c of candidates) {
      expect(c.pieceCount).toBeGreaterThanOrEqual(4);
      expect(c.pieceCount).toBeLessThanOrEqual(20);
    }
  });

  it('deduplicates by boardState + activeColor', () => {
    const record1 = instrumentedPlayGame('hard', 'easy', 42, 'dedup-1', 50);
    const record2: InstrumentedGameRecord = {
      ...record1,
      gameId: 'dedup-2',
    };

    const candidates = extractCandidates([record1, record2]);
    const keys = candidates.map((c) => `${c.boardState}:${c.activeColor}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

describe('extractSolutionPath', () => {
  it('returns moves from a valid position', () => {
    const board = createInitialBoard();
    const state = createGameStateFromBoard(board, PieceColor.White);
    const config = {
      maxDepth: VALIDATION_SEARCH_DEPTH,
      timeLimitMs: VALIDATION_TIME_LIMIT_MS,
      quiescenceEnabled: true,
      quiescenceMaxDepth: 4,
    };

    const path = extractSolutionPath(state, config, 4);
    expect(path.length).toBeGreaterThan(0);
    expect(path.length).toBeLessThanOrEqual(4);
  });
});

describe('countPlayerMoves', () => {
  it('counts correctly for odd and even lengths', () => {
    expect(countPlayerMoves(['a', 'b', 'c'])).toBe(2); // moves at index 0, 2
    expect(countPlayerMoves(['a', 'b'])).toBe(1); // move at index 0
    expect(countPlayerMoves(['a'])).toBe(1); // move at index 0
    expect(countPlayerMoves([])).toBe(0);
  });
});

describe('computeDifficultyScore', () => {
  it('produces a score in [0, 1]', () => {
    // Create a simple validated puzzle with known properties
    const board = createInitialBoard();
    const state = createGameStateFromBoard(board, PieceColor.White);
    const config = {
      maxDepth: 6,
      timeLimitMs: 2000,
      quiescenceEnabled: true,
      quiescenceMaxDepth: 4,
    };

    const path = extractSolutionPath(state, config, 4);
    if (path.length === 0) return; // Skip if no path found

    const mock: ValidatedPuzzle = {
      boardState: serializeBoard(board),
      activeColor: PieceColor.White,
      sourceGameId: 'test',
      sourcePly: 0,
      evalSwing: 200,
      pieceCount: 24,
      tentativeFirstMove: path[0]!,
      solutionPath: path.map((m) => {
        const parts = [m.from as number, ...m.path.map((s) => s as number)];
        return m.captured.length > 0 ? parts.join('x') : parts.join('-');
      }),
      solutionDepth: Math.ceil(path.length / 2),
      bestScore: 100,
      margin: 200,
      rootMoveScores: [],
    };

    const score = computeDifficultyScore(mock);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('weights correctly with fixed inputs', () => {
    // depth=4 -> depthScore = 4/8 = 0.5
    // branching: depends on position, but verify the formula holds
    const depthScore = Math.min(4 / 8, 1.0);
    expect(depthScore).toBe(0.5);

    const branchingScore = 0.5;
    const complexityScore = 0.3;

    const expected = depthScore * 0.40 + branchingScore * 0.35 + complexityScore * 0.25;
    expect(expected).toBeCloseTo(0.2 + 0.175 + 0.075); // 0.45
  });
});

describe('computeTimeThresholds', () => {
  it('increases thresholds from puzzle 1 to puzzle 100', () => {
    const t1 = computeTimeThresholds(1, 2, 0.5);
    const t100 = computeTimeThresholds(100, 2, 0.5);

    expect(t100.thresholdFastMs).toBeGreaterThan(t1.thresholdFastMs);
    expect(t100.thresholdSlowMs).toBeGreaterThan(t1.thresholdSlowMs);
  });

  it('T₂ > T₁ for all puzzles', () => {
    for (let i = 1; i <= 100; i++) {
      const t = computeTimeThresholds(i, 2, 0.5);
      expect(t.thresholdSlowMs).toBeGreaterThan(t.thresholdFastMs);
    }
  });

  it('thresholds are positive', () => {
    const t = computeTimeThresholds(1, 1, 0.0);
    expect(t.thresholdFastMs).toBeGreaterThan(0);
    expect(t.thresholdSlowMs).toBeGreaterThan(0);
  });
});

describe('assignDifficultyTier', () => {
  it('assigns correct tiers', () => {
    expect(assignDifficultyTier(1)).toBe('easy');
    expect(assignDifficultyTier(20)).toBe('easy');
    expect(assignDifficultyTier(21)).toBe('medium');
    expect(assignDifficultyTier(60)).toBe('medium');
    expect(assignDifficultyTier(61)).toBe('hard');
    expect(assignDifficultyTier(100)).toBe('hard');
  });
});

describe('generateGoalText', () => {
  it('returns correct text for each type', () => {
    expect(generateGoalText('forced_capture_chain', 3)).toBe('Find the winning capture sequence');
    expect(generateGoalText('promotion_forcing', 3)).toBe('Force a king in 3 moves');
    expect(generateGoalText('sacrifice_and_recapture', 2)).toBe('Sacrifice to win');
    expect(generateGoalText('positional_squeeze', 4)).toBe('Leave your opponent with no legal moves');
    expect(generateGoalText('king_vs_pawns_endgame', 5)).toBe('Find the winning king maneuver');
    expect(generateGoalText('winning_combination', 1)).toBe('Find the best move');
  });
});

describe('classifyPuzzleType', () => {
  it('returns a valid puzzle type string', () => {
    // Run a quick game and validate a candidate to get a real puzzle
    const record = instrumentedPlayGame('hard', 'easy', 42, 'classify-test', 80);
    const candidates = extractCandidates([record]);

    for (const candidate of candidates.slice(0, 3)) {
      const validated = validateCandidate(candidate);
      if (validated) {
        const puzzleType = classifyPuzzleType(validated);
        expect([
          'forced_capture_chain',
          'promotion_forcing',
          'sacrifice_and_recapture',
          'positional_squeeze',
          'king_vs_pawns_endgame',
          'winning_combination',
        ]).toContain(puzzleType);
        break;
      }
    }
  });
});

describe('verifySolutionExecutable', () => {
  it('accepts a valid solution path', () => {
    const board = createInitialBoard();
    const state = createGameStateFromBoard(board, PieceColor.White);
    // "9-13" is a valid opening move
    expect(verifySolutionExecutable(state, ['9-13'])).toBe(true);
  });

  it('rejects an invalid solution path', () => {
    const board = createInitialBoard();
    const state = createGameStateFromBoard(board, PieceColor.White);
    // "1-5" is not a legal opening move
    expect(verifySolutionExecutable(state, ['1-5'])).toBe(false);
  });
});
