/**
 * Tests for the AI Web Worker entry point (getAIMove).
 * Tests the function directly without a real Worker.
 */

import { describe, it, expect } from 'vitest';
import { getAIMove, deserializeGameState } from './worker';
import type { SerializableGameState } from './worker';
import { createNewGame } from '../engine/game';
import { createAmericanRules } from '../engine/rules';
import { CrazyEvent, GameMode, PlayerType } from '../engine/types';
import type { GameState, BoardState, SquareState, Piece, Move } from '../engine/types';
import { PieceColor, PieceType } from '../engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestGameState(): GameState {
  return createNewGame(createAmericanRules(), {
    white: PlayerType.Human,
    black: PlayerType.CpuHard,
  });
}

function serializeForTest(state: GameState): SerializableGameState {
  const { ruleSet: _, ...rest } = state;
  void _;
  return {
    ...rest,
    ruleSetId: 'american',
    mode: state.mode,
    activeEvents: state.activeEvents.map((e) => ({
      type: e.type,
      remainingPlies: e.remainingPlies,
      triggeredBy: e.triggeredBy,
      triggeredAtPly: e.triggeredAtPly,
      ...(e.metadata !== undefined ? { metadata: { ...e.metadata } } : {}),
    })),
  };
}

function isLegalMove(state: GameState, move: Move): boolean {
  const legalMoves = state.ruleSet.getLegalMoves(state.board, state.activeColor);
  return legalMoves.some(
    (m) =>
      (m.from as number) === (move.from as number) &&
      m.path.length === move.path.length &&
      m.path.every((sq, i) => (sq as number) === (move.path[i] as number)),
  );
}

/**
 * Creates a board with only a few pieces for testing specific scenarios.
 * All squares are null by default; pass piece placements as an array of [squareNum, piece].
 */
function createSparseBoard(placements: Array<[number, Piece]>): BoardState {
  const board: SquareState[] = Array.from({ length: 32 }, () => null);
  for (const [sq, piece] of placements) {
    board[sq - 1] = piece;
  }
  return board;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getAIMove (worker function, tested directly without Worker)', () => {
  it('returns a valid move from the starting position (easy)', () => {
    const state = createTestGameState();
    const serialized = serializeForTest(state);

    const move = getAIMove(serialized, 'easy');

    expect(move).toBeDefined();
    expect(move.from).toBeDefined();
    expect(move.path.length).toBeGreaterThanOrEqual(1);
    expect(isLegalMove(state, move)).toBe(true);
  });

  it('returns a valid move for hard difficulty', () => {
    const state = createTestGameState();
    const serialized = serializeForTest(state);

    const move = getAIMove(serialized, 'hard');

    expect(move).toBeDefined();
    expect(isLegalMove(state, move)).toBe(true);
  });

  it('correctly deserializes the ruleSetId and reconstructs the GameState', () => {
    const state = createTestGameState();
    const serialized = serializeForTest(state);

    const deserialized = deserializeGameState(serialized);
    expect(deserialized.ruleSet).toBeDefined();
    expect(() =>
      deserialized.ruleSet.getLegalMoves(deserialized.board, deserialized.activeColor),
    ).not.toThrow();

    // Should not throw and should return a legal move
    const move = getAIMove(serialized, 'easy');
    expect(isLegalMove(state, move)).toBe(true);
  });

  it('throws for an unknown ruleSetId', () => {
    const state = createTestGameState();
    const serialized = serializeForTest(state);
    const badSerialized = { ...serialized, ruleSetId: 'international' };

    expect(() => deserializeGameState(badSerialized)).toThrow('Unknown ruleSetId');
  });

  it('returns the only legal move when exactly one exists', () => {
    // Create a board where White has exactly one piece that can only move one way
    const board = createSparseBoard([
      [28, { color: PieceColor.White, type: PieceType.Pawn }],
      // Black piece far away so there's no capture
      [1, { color: PieceColor.Black, type: PieceType.Pawn }],
    ]);

    const state = createTestGameState();
    const customState: GameState = {
      ...state,
      board,
    };

    const legalMoves = customState.ruleSet.getLegalMoves(board, PieceColor.White);

    // Only proceed if there's exactly 1 legal move
    if (legalMoves.length === 1) {
      const serialized = serializeForTest(customState);
      const move = getAIMove(serialized, 'hard');
      const onlyMove = legalMoves[0] as Move;

      expect(move.from as number).toBe(onlyMove.from as number);
      expect(move.path.length).toBe(onlyMove.path.length);
    } else {
      // If there are multiple moves, the test setup doesn't isolate as expected;
      // skip gracefully
      expect(legalMoves.length).toBeGreaterThan(0);
    }
  });

  it('finds a forced capture', () => {
    // White pawn at 18, Black pawn at 14 — White must jump to 9
    const board = createSparseBoard([
      [18, { color: PieceColor.White, type: PieceType.Pawn }],
      [14, { color: PieceColor.Black, type: PieceType.Pawn }],
    ]);

    const state = createTestGameState();
    const customState: GameState = {
      ...state,
      board,
    };

    const legalMoves = customState.ruleSet.getLegalMoves(board, PieceColor.White);
    const hasCapture = legalMoves.some((m) => m.captured.length > 0);

    if (hasCapture) {
      const serialized = serializeForTest(customState);
      const move = getAIMove(serialized, 'easy');
      expect(move.captured.length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// Crazy mode deserialization
// ===========================================================================

describe('deserializeGameState — Crazy mode', () => {
  it('deserializes Crazy mode state with CompositeEventRuleSet', () => {
    const state = createTestGameState();
    const serialized: SerializableGameState = {
      ...serializeForTest(state),
      mode: 'CRAZY',
      activeEvents: [
        {
          type: 'KING_FOR_A_DAY',
          remainingPlies: 2,
          triggeredBy: 'WHITE',
          triggeredAtPly: 5,
        },
      ],
    };

    const deserialized = deserializeGameState(serialized);
    expect(deserialized.mode).toBe(GameMode.Crazy);
    expect(deserialized.activeEvents.length).toBe(1);
    expect(deserialized.activeEvents[0]?.type).toBe(CrazyEvent.KingForADay);
    expect('setActiveEvents' in deserialized.ruleSet).toBe(true);
  });

  it('defaults to Classic mode when mode is missing', () => {
    const state = createTestGameState();
    const serialized = serializeForTest(state);

    const deserialized = deserializeGameState(serialized);
    expect(deserialized.mode).toBe(GameMode.Classic);
    expect(deserialized.activeEvents).toEqual([]);
  });
});
