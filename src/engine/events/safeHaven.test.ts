/**
 * Safe Haven — comprehensive test suite (Event 20).
 */

import { describe, it, expect } from 'vitest';
import { SafeHavenDecorator, SAFE_HAVEN_SQUARES, filterSafeHavenCaptures } from './safeHaven';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { computeZobristHash } from '../zobrist';
import {
  createActiveEvent,
  IMPLEMENTED_EVENTS,
  EVENT_DECORATOR_REGISTRY,
} from '../events';
import { createCompositeRuleSet } from '../compositeRuleSet';
import {
  CrazyEvent,
  GameMode,
  GameStatus,
  PieceColor,
  PlayerType,
  square,
} from '../types';
import type {
  ActiveEvent,
  BoardState,
  GameState,
  Move,
  PlayerSetup,
} from '../types';
import { W, B, P, K, buildBoard } from '../test-utils';

const HUMAN_VS_HUMAN: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.Human,
};

function move(from: number, path: number[], captured: number[] = []): Move {
  return {
    from: square(from),
    path: path.map(square),
    captured: captured.map(square),
  };
}

function crazyStateWithBoard(
  board: BoardState,
  activeColor: PieceColor = PieceColor.White,
  activeEvents: readonly ActiveEvent[] = [],
  plyCount = 0,
): GameState {
  const base = createAmericanRules();
  const ruleSet = createCompositeRuleSet(base);
  return {
    board,
    activeColor,
    status: GameStatus.InProgress,
    result: null,
    ruleSet,
    players: HUMAN_VS_HUMAN,
    moveHistory: [],
    positionHashes: [computeZobristHash(board, activeColor)],
    halfMoveClock: 0,
    plyCount,
    mode: GameMode.Crazy,
    activeEvents,
  };
}

function createSHEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.SafeHaven, triggeredBy, triggeredAtPly);
}

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  const first = moves[0];
  if (first === undefined) throw new Error('No legal moves');
  return first;
}

// ===========================================================================
// Constants
// ===========================================================================

describe('SAFE_HAVEN_SQUARES', () => {
  it('contains exactly squares 5, 8, 25, 28', () => {
    expect(SAFE_HAVEN_SQUARES.size).toBe(4);
    expect(SAFE_HAVEN_SQUARES.has(5)).toBe(true);
    expect(SAFE_HAVEN_SQUARES.has(8)).toBe(true);
    expect(SAFE_HAVEN_SQUARES.has(25)).toBe(true);
    expect(SAFE_HAVEN_SQUARES.has(28)).toBe(true);
  });
});

// ===========================================================================
// Unit Tests — filterSafeHavenCaptures
// ===========================================================================

describe('filterSafeHavenCaptures', () => {
  it('jump capturing piece on safe haven square is blocked', () => {
    // Black pawn at sq 5 (safe haven). White pawn at 9 jumps to 2 capturing 5.
    // sq 9 (row 2, col 0), sq 5 (row 1, col 0), sq 2 (row 0, col 1)?
    // Actually: sq 9 forward-left -> row 1, col -1 = off board.
    // sq 9 forward-right -> sq 5? Let's check: sq 9 (row 2, col 0). Forward-right = row 1, col 1 = sq 5.
    // Jump target = row 0, col 2 = sq 2. So jump: 9 → 2 capturing 5.
    const board = buildBoard([
      { sq: 9, color: W, type: P },
      { sq: 5, color: B, type: P },
      { sq: 30, color: B, type: P },
    ]);
    const moves: Move[] = [move(9, [2], [5])];
    const result = filterSafeHavenCaptures(board, moves, W);
    // Jump capturing safe haven piece should be blocked
    expect(result.every(m => m.captured.length === 0)).toBe(true);
  });

  it('jump capturing piece NOT on safe haven square is allowed', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const moves: Move[] = [move(22, [15], [18])]; // sq 18 is not safe haven
    const result = filterSafeHavenCaptures(board, moves, W);
    expect(result).toHaveLength(1);
    expect(result[0]?.captured).toHaveLength(1);
  });

  it('no jumps → moves unchanged', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const simples: Move[] = [move(22, [17]), move(22, [18])];
    const result = filterSafeHavenCaptures(board, simples, W);
    expect(result).toEqual(simples);
  });
});

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('SafeHavenDecorator', () => {
  it('getEventType returns CrazyEvent.SafeHaven', () => {
    const base = createAmericanRules();
    const decorator = new SafeHavenDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.SafeHaven);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new SafeHavenDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(SafeHavenDecorator);
  });

  it('piece on safe haven square cannot be captured', () => {
    // Black pawn at sq 25 (safe haven). White king at 22 jumps to 29 capturing 25.
    // sq 22 (row 5, col 2). Backward-left = row 6, col 1 = sq 25. Jump target = row 7, col 0 = sq 29.
    const board = buildBoard([
      { sq: 22, color: W, type: K },
      { sq: 25, color: B, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createSHEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const captureOfSH = moves.filter(
      m => m.captured.some(c => (c as number) === 25),
    );
    expect(captureOfSH).toHaveLength(0);
  });

  it('pieces NOT on safe haven squares can be captured normally', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createSHEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const jumps = moves.filter(m => m.captured.length > 0);
    expect(jumps.length).toBeGreaterThan(0);
  });

  it('event expires after 2 rounds (4 plies)', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createSHEvent();
    let state = crazyStateWithBoard(board, W, [event]);

    for (let i = 0; i < 4; i++) {
      state = makeMove(state, firstMove(state));
    }

    expect(state.activeEvents.some(e => e.type === CrazyEvent.SafeHaven)).toBe(false);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.SafeHaven)).toBe(true);
  });

  it('CrazyEvent.SafeHaven is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.SafeHaven);
  });
});
