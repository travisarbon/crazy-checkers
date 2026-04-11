/**
 * Content validation suite for generated puzzle data.
 *
 * Validates the auto-generated puzzleData.ts against all content requirements.
 * Per Playbook §17.4, runs as part of the standard vitest test suite.
 */

import { describe, it, expect } from 'vitest';
import { PUZZLE_DATA, PUZZLE_GENERATION_META } from './puzzleData';
import { getLegalMoves } from '../engine/moves';
import type { BoardState, PieceColor, SquareState, GameState } from '../engine/types';
import { PieceColor as PC, PieceType, GameMode, GameStatus, PlayerType } from '../engine/types';
import { createAmericanRules } from '../engine/rules';
import { computeZobristHash } from '../engine/zobrist';
import { makeMove, checkForStalemate, getCurrentLegalMoves } from '../engine/game';
import { stringToMove } from '../utils/notation';

function deserializeBoard(serialized: string): BoardState {
  return serialized.split('').map((ch): SquareState => {
    switch (ch) {
      case '.': return null;
      case 'w': return { color: PC.White, type: PieceType.Pawn };
      case 'W': return { color: PC.White, type: PieceType.King };
      case 'b': return { color: PC.Black, type: PieceType.Pawn };
      case 'B': return { color: PC.Black, type: PieceType.King };
      default: throw new Error(`Invalid character: ${ch}`);
    }
  });
}

function toEngineColor(color: 'white' | 'black'): PieceColor {
  return color === 'white' ? PC.White : PC.Black;
}

function createStateFromBoard(board: BoardState, activeColor: PieceColor): GameState {
  return {
    board,
    activeColor,
    status: GameStatus.InProgress,
    result: null,
    ruleSet: createAmericanRules(),
    players: { white: PlayerType.CpuHard, black: PlayerType.CpuHard },
    moveHistory: [],
    positionHashes: [computeZobristHash(board, activeColor)],
    halfMoveClock: 0,
    plyCount: 0,
    mode: GameMode.Classic,
    activeEvents: [],
  };
}

describe('PUZZLE_DATA content validation', () => {
  it('contains exactly 100 puzzles', () => {
    expect(PUZZLE_DATA).toHaveLength(100);
  });

  it('all puzzles have sequential IDs 1–100', () => {
    for (let i = 0; i < PUZZLE_DATA.length; i++) {
      const puzzle = PUZZLE_DATA[i];
      expect(puzzle).toBeDefined();
      expect(puzzle?.id).toBe(i + 1);
    }
  });

  it('all board states are valid 32-character strings', () => {
    for (const puzzle of PUZZLE_DATA) {
      expect(puzzle.boardState).toHaveLength(32);
      expect(puzzle.boardState).toMatch(/^[.wWbB]{32}$/);
    }
  });

  it('all starting positions are legal', () => {
    for (const puzzle of PUZZLE_DATA) {
      const board = deserializeBoard(puzzle.boardState);
      const color = toEngineColor(puzzle.activeColor);
      const moves = getLegalMoves(board, color);
      expect(moves.length).toBeGreaterThan(0);
    }
  });

  it('all solution paths are executable', () => {
    for (const puzzle of PUZZLE_DATA) {
      const board = deserializeBoard(puzzle.boardState);
      const color = toEngineColor(puzzle.activeColor);
      let state = createStateFromBoard(board, color);

      for (const notation of puzzle.solutionPath) {
        expect(state.status).toBe(GameStatus.InProgress);
        const move = stringToMove(notation, state.board);
        const legalMoves = getCurrentLegalMoves(state);
        const isLegal = legalMoves.some(
          (lm) =>
            (lm.from as number) === (move.from as number) &&
            lm.path.length === move.path.length &&
            lm.path.every((sq, idx) => (sq as number) === (move.path[idx] as number)),
        );
        expect(isLegal).toBe(true);
        state = makeMove(state, move);
        state = checkForStalemate(state);
      }
    }
  });

  it('no duplicate starting positions', () => {
    const keys = PUZZLE_DATA.map((p) => `${p.boardState}:${p.activeColor}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('puzzles are sorted by ascending difficultyRating', () => {
    for (let i = 0; i < PUZZLE_DATA.length - 1; i++) {
      const current = PUZZLE_DATA[i];
      const next = PUZZLE_DATA[i + 1];
      expect(current).toBeDefined();
      expect(next).toBeDefined();
      if (current && next) {
        expect(current.difficultyRating).toBeLessThanOrEqual(next.difficultyRating);
      }
    }
  });

  it('difficulty tiers are correctly assigned', () => {
    for (let i = 0; i < PUZZLE_DATA.length; i++) {
      const puzzle = PUZZLE_DATA[i];
      expect(puzzle).toBeDefined();
      if (!puzzle) continue;
      if (i < 20) expect(puzzle.difficultyTier).toBe('easy');
      else if (i < 60) expect(puzzle.difficultyTier).toBe('medium');
      else expect(puzzle.difficultyTier).toBe('hard');
    }
  });

  it('all time thresholds are valid', () => {
    for (const puzzle of PUZZLE_DATA) {
      expect(puzzle.thresholdFastMs).toBeGreaterThan(0);
      expect(puzzle.thresholdSlowMs).toBeGreaterThan(puzzle.thresholdFastMs);
    }
  });

  it('all required fields are present and correctly typed', () => {
    for (const puzzle of PUZZLE_DATA) {
      expect(typeof puzzle.id).toBe('number');
      expect(typeof puzzle.boardState).toBe('string');
      expect(['white', 'black']).toContain(puzzle.activeColor);
      expect(typeof puzzle.goal).toBe('string');
      expect(Array.isArray(puzzle.solutionPath)).toBe(true);
      expect(puzzle.solutionPath.length).toBeGreaterThan(0);
      expect(typeof puzzle.solutionDepth).toBe('number');
      expect(typeof puzzle.difficultyRating).toBe('number');
      expect(['easy', 'medium', 'hard']).toContain(puzzle.difficultyTier);
      expect(typeof puzzle.pieceCount).toBe('number');
      expect(typeof puzzle.puzzleType).toBe('string');
      expect(typeof puzzle.sourceGameId).toBe('string');
      expect(typeof puzzle.sourcePly).toBe('number');
      expect(typeof puzzle.thresholdFastMs).toBe('number');
      expect(typeof puzzle.thresholdSlowMs).toBe('number');
    }
  });

  it('piece counts are within bounds', () => {
    for (const puzzle of PUZZLE_DATA) {
      expect(puzzle.pieceCount).toBeGreaterThanOrEqual(4);
      expect(puzzle.pieceCount).toBeLessThanOrEqual(20);
    }
  });

  it('solution depths are at least 1', () => {
    for (const puzzle of PUZZLE_DATA) {
      expect(puzzle.solutionDepth).toBeGreaterThanOrEqual(1);
    }
  });

  it('color balance', () => {
    const whiteCount = PUZZLE_DATA.filter((p) => p.activeColor === 'white').length;
    const blackCount = PUZZLE_DATA.filter((p) => p.activeColor === 'black').length;
    expect(whiteCount).toBeGreaterThanOrEqual(35);
    expect(blackCount).toBeGreaterThanOrEqual(35);
  });

  it('puzzle type distribution', () => {
    const types = new Set(PUZZLE_DATA.map((p) => p.puzzleType));
    expect(types.size).toBeGreaterThanOrEqual(3);
  });
});

describe('PUZZLE_GENERATION_META', () => {
  it('has valid fields', () => {
    expect(typeof PUZZLE_GENERATION_META.masterSeed).toBe('number');
    expect(typeof PUZZLE_GENERATION_META.generatedAt).toBe('string');
    // Verify ISO date format
    expect(new Date(PUZZLE_GENERATION_META.generatedAt).toISOString()).toBe(
      PUZZLE_GENERATION_META.generatedAt,
    );
    expect(typeof PUZZLE_GENERATION_META.totalGames).toBe('number');
    expect(PUZZLE_GENERATION_META.pipelineVersion).toBe('1.0.0');
  });
});
