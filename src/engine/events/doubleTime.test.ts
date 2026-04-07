/**
 * Double Time — comprehensive test suite (Event 19).
 */

import { describe, it, expect } from 'vitest';
import { DoubleTimeDecorator } from './doubleTime';
import type { DoubleTimeMetadata } from './doubleTime';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { computeZobristHash } from '../zobrist';
import {
  createActiveEvent,
  IMPLEMENTED_EVENTS,
  EVENT_DECORATOR_REGISTRY,
  EVENT_METADATA_FACTORIES,
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
  PlayerSetup,
} from '../types';
import { W, B, P, buildBoard } from '../test-utils';

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

function createDTEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
  metadata?: Record<string, unknown>,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.DoubleTime, triggeredBy, triggeredAtPly, metadata);
}

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('DoubleTimeDecorator', () => {
  it('getEventType returns CrazyEvent.DoubleTime', () => {
    const base = createAmericanRules();
    const decorator = new DoubleTimeDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.DoubleTime);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new DoubleTimeDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(DoubleTimeDecorator);
  });

  it('metadata factory initializes with phase first', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.DoubleTime);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('no factory');

    const board = buildBoard([{ sq: 22, color: W, type: P }]);
    const metadata = factory(board, PieceColor.White) as unknown as DoubleTimeMetadata;
    expect(metadata.phase).toBe('first');
  });

  it('duration is 2 plies', () => {
    const event = createDTEvent();
    expect(event.remainingPlies).toBe(2);
  });

  it('after first sub-move, active color stays the same (turn not switched)', () => {
    // White pawn at sq 22, Black pawn at sq 5 (out of the way).
    // With Double Time active (phase: first), after White's first move,
    // the turn should NOT switch — White moves again.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 26, color: W, type: P },
      { sq: 5, color: B, type: P },
      { sq: 6, color: B, type: P },
    ]);
    const event = createDTEvent(W, 0, { phase: 'first' });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);

    const firstMove = moves[0];
    if (firstMove === undefined) throw new Error('expected move');
    const newState = makeMove(state, firstMove);

    // After first sub-move, active color should still be White
    expect(newState.activeColor).toBe(PieceColor.White);
  });

  it('after first sub-move, metadata phase becomes second', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 26, color: W, type: P },
      { sq: 5, color: B, type: P },
      { sq: 6, color: B, type: P },
    ]);
    const event = createDTEvent(W, 0, { phase: 'first' });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);
    const firstMove = moves[0];
    if (firstMove === undefined) throw new Error('expected move');

    const newState = makeMove(state, firstMove);

    // Find the Double Time event in the new state
    const dtEvent = newState.activeEvents.find(e => e.type === CrazyEvent.DoubleTime);
    expect(dtEvent).toBeDefined();
    const metadata = dtEvent?.metadata as unknown as DoubleTimeMetadata;
    expect(metadata.phase).toBe('second');
  });

  it('after second sub-move, metadata phase resets to first', () => {
    // Start with phase 'second' — simulating the second sub-move.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 26, color: W, type: P },
      { sq: 5, color: B, type: P },
      { sq: 6, color: B, type: P },
    ]);
    const event = createDTEvent(W, 0, { phase: 'second' });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);
    const secondMove = moves[0];
    if (secondMove === undefined) throw new Error('expected move');

    const newState = makeMove(state, secondMove);

    // After second sub-move, turn should switch to Black
    expect(newState.activeColor).toBe(PieceColor.Black);

    // If the event is still active, phase should be reset to 'first'
    const dtEvent = newState.activeEvents.find(e => e.type === CrazyEvent.DoubleTime);
    if (dtEvent) {
      const metadata = dtEvent.metadata as unknown as DoubleTimeMetadata;
      expect(metadata.phase).toBe('first');
    }
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.DoubleTime)).toBe(true);
  });

  it('CrazyEvent.DoubleTime is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.DoubleTime);
  });
});
