/**
 * Backfire — comprehensive test suite (Event 34).
 */

import { describe, it, expect } from 'vitest';
import { BackfireDecorator, getBackfireJumpsForPiece } from './backfire';
import { createAmericanRules } from '../rules';
import { getCurrentLegalMoves } from '../game';
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

function createBFEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.Backfire, triggeredBy, triggeredAtPly);
}

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('BackfireDecorator', () => {
  it('getEventType returns CrazyEvent.Backfire', () => {
    const base = createAmericanRules();
    const decorator = new BackfireDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.Backfire);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new BackfireDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(BackfireDecorator);
  });

  it('friendly-fire jump is generated when event is active', () => {
    // White pawn at 22 (row 5), another White pawn at 18 (row 4).
    // With Backfire, White should be able to jump over its own piece at 18 to land at 15 (row 3).
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 1, color: B, type: P }, // Black piece to keep game valid
    ]);
    const event = createBFEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const friendlyJump = moves.find(
      m => m.from === 22 && m.captured.length > 0 && m.captured.includes(square(18)),
    );
    expect(friendlyJump).toBeDefined();
  });

  it('captured array includes the friendly piece square', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const event = createBFEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const friendlyJump = moves.find(
      m => m.from === 22 && m.captured.some(c => c === square(18)),
    );
    expect(friendlyJump).toBeDefined();
    if (friendlyJump === undefined) throw new Error('expected friendlyJump');
    expect(friendlyJump.captured).toContain(18);
  });

  it('friendly jumps are mandatory when available (no enemy jumps)', () => {
    // Only friendly pieces to jump — no enemies nearby.
    // White pawn at 22, White pawn at 18. No enemy pieces adjacent.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 1, color: B, type: P }, // Far-away Black piece
    ]);
    const event = createBFEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // All moves from sq 22 should be jumps (mandatory capture)
    const movesFrom22 = moves.filter(m => m.from === 22);
    expect(movesFrom22.length).toBeGreaterThan(0);
    expect(movesFrom22.every(m => m.captured.length > 0)).toBe(true);
  });

  it('when both friendly and enemy jumps available, all are returned', () => {
    // White pawn at 22, White pawn at 18 (friendly), Black pawn at 17 (enemy).
    // sq 22 can jump 18 -> 15 (friendly) and jump 17 -> 13 (enemy, if geometry works).
    // Let's use a king for more flexibility:
    // White king at 22, friendly White pawn at 18, enemy Black pawn at 17.
    // King at 22: jump 18 -> 15 or jump 17 -> 13.
    const board = buildBoard([
      { sq: 22, color: W, type: K },
      { sq: 18, color: W, type: P },
      { sq: 17, color: B, type: P },
    ]);
    const event = createBFEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const jumps = moves.filter(m => m.captured.length > 0);
    expect(jumps.length).toBeGreaterThanOrEqual(2);

    // Should have a friendly jump (over 18) and an enemy jump (over 17)
    const hasFriendlyJump = jumps.some(m => m.captured.some(c => c === square(18)));
    const hasEnemyJump = jumps.some(m => m.captured.some(c => c === square(17)));
    expect(hasFriendlyJump).toBe(true);
    expect(hasEnemyJump).toBe(true);
  });

  it('when event is inactive, no friendly jumps are generated', () => {
    // Same board as friendly jump test, but NO active event.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, []); // no events
    const moves = getCurrentLegalMoves(state);

    // No jump should be available (can't jump own pieces normally)
    const friendlyJump = moves.find(
      m => m.from === 22 && m.captured.some(c => c === square(18)),
    );
    expect(friendlyJump).toBeUndefined();
  });

  it('duration is 2 plies (1 round)', () => {
    const event = createBFEvent();
    expect(event.remainingPlies).toBe(2);
  });
});

// ===========================================================================
// getBackfireJumpsForPiece Unit Tests
// ===========================================================================

describe('getBackfireJumpsForPiece', () => {
  it('returns friendly jump for a pawn jumping over own piece', () => {
    // White pawn at 22, White pawn at 18 (friendly target). Landing at 15.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
    ]);
    const jumps = getBackfireJumpsForPiece(board, square(22), W, P, false);

    expect(jumps.length).toBeGreaterThan(0);
    const jump = jumps.find(m => m.captured.some(c => c === square(18)));
    expect(jump).toBeDefined();
    if (jump === undefined) throw new Error('expected jump');
    expect(jump.path).toContain(15);
  });

  it('returns no jumps when no adjacent pieces exist', () => {
    const board = buildBoard([{ sq: 22, color: W, type: P }]);
    const jumps = getBackfireJumpsForPiece(board, square(22), W, P, false);
    expect(jumps.length).toBe(0);
  });

  it('includes enemy jumps as well', () => {
    // White pawn at 22, Black pawn at 18. Standard enemy jump.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const jumps = getBackfireJumpsForPiece(board, square(22), W, P, false);

    expect(jumps.length).toBeGreaterThan(0);
    const jump = jumps.find(m => m.captured.some(c => c === square(18)));
    expect(jump).toBeDefined();
  });
});

// ===========================================================================
// Registration Tests
// ===========================================================================

describe('Backfire registration', () => {
  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Backfire)).toBe(true);
  });

  it('CrazyEvent.Backfire is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Backfire);
  });
});
