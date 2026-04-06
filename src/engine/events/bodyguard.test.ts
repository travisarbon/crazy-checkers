/**
 * Bodyguard — comprehensive test suite (Event 12).
 */

import { describe, it, expect } from 'vitest';
import { BodyguardDecorator, getGuardedKings } from './bodyguard';
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

function createBGEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.Bodyguard, triggeredBy, triggeredAtPly);
}

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  const first = moves[0];
  if (first === undefined) throw new Error('No legal moves');
  return first;
}

// ===========================================================================
// Unit Tests — getGuardedKings
// ===========================================================================

describe('getGuardedKings', () => {
  it('king adjacent to friendly pawn is guarded', () => {
    // White king at 14, White pawn at 10 (adjacent)
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 10, color: W, type: P },
    ]);
    const guarded = getGuardedKings(board);
    expect(guarded.has(14)).toBe(true);
  });

  it('king with no adjacent friendly pawn is not guarded', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 22, color: W, type: P }, // not adjacent
    ]);
    const guarded = getGuardedKings(board);
    expect(guarded.has(14)).toBe(false);
  });

  it('king adjacent to enemy pawn is not guarded', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 10, color: B, type: P },
    ]);
    const guarded = getGuardedKings(board);
    expect(guarded.has(14)).toBe(false);
  });

  it('both colors kings can be guarded', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 10, color: W, type: P },
      { sq: 3, color: B, type: K },
      { sq: 7, color: B, type: P },
    ]);
    const guarded = getGuardedKings(board);
    expect(guarded.has(14)).toBe(true);
    expect(guarded.has(3)).toBe(true);
  });

  it('empty board returns empty set', () => {
    const board = buildBoard([]);
    const guarded = getGuardedKings(board);
    expect(guarded.size).toBe(0);
  });
});

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('BodyguardDecorator', () => {
  it('getEventType returns CrazyEvent.Bodyguard', () => {
    const base = createAmericanRules();
    const decorator = new BodyguardDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.Bodyguard);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new BodyguardDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(BodyguardDecorator);
  });

  it('jump capturing a guarded king is blocked', () => {
    // White pawn at 22 could jump Black king at 18 (guarded by Black pawn at 15)
    // 18 is adjacent to 15? Let's check: sq 18 (row 4, col 3), sq 15 (row 3, col 4)
    // Adjacent: forward-right from 18 is 15. Yes, adjacent.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: K },
      { sq: 15, color: B, type: P }, // guards king at 18
    ]);
    const event = createBGEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Jump over guarded king should be blocked
    const jumpOverKing = moves.filter(
      m => m.captured.some(c => (c as number) === 18),
    );
    expect(jumpOverKing).toHaveLength(0);
  });

  it('jump capturing unguarded king is allowed', () => {
    // Black king at 18 with no adjacent friendly pawns
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: K },
      { sq: 3, color: B, type: P }, // far away, not guarding
    ]);
    const event = createBGEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const jumpOverKing = moves.filter(
      m => m.captured.some(c => (c as number) === 18),
    );
    expect(jumpOverKing.length).toBeGreaterThan(0);
  });

  it('capturing unguarded pawn is always allowed', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createBGEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const jumps = moves.filter(m => m.captured.length > 0);
    expect(jumps.length).toBeGreaterThan(0);
  });

  it('all jumps blocked → simple moves regenerated', () => {
    // Only available capture is over a guarded king
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: K },
      { sq: 15, color: B, type: P }, // guards 18
      { sq: 3, color: B, type: P },
    ]);
    const event = createBGEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Should get simple moves instead
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.captured.length === 0)).toBe(true);
  });

  it('event expires after 2 rounds (4 plies)', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createBGEvent();
    let state = crazyStateWithBoard(board, W, [event]);

    for (let i = 0; i < 4; i++) {
      state = makeMove(state, firstMove(state));
    }

    expect(state.activeEvents.some(e => e.type === CrazyEvent.Bodyguard)).toBe(false);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Bodyguard)).toBe(true);
  });

  it('CrazyEvent.Bodyguard is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Bodyguard);
  });

  it('multi-jump chain with guarded king in middle is blocked', () => {
    // A chain that captures an unguarded pawn and then a guarded king
    // The entire chain should be blocked
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P }, // unguarded pawn
      { sq: 11, color: B, type: K }, // guarded king
      { sq: 8, color: B, type: P }, // guards king at 11 (adjacent)
      { sq: 30, color: B, type: P },
    ]);
    const event = createBGEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Multi-jump capturing king at 11 should be blocked
    const multiJumpWithKing = moves.filter(
      m => m.captured.length >= 2 && m.captured.some(c => (c as number) === 11),
    );
    expect(multiJumpWithKing).toHaveLength(0);
  });
});
