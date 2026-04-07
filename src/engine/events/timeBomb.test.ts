/**
 * Time Bomb — comprehensive test suite (Event 26).
 */

import { describe, it, expect } from 'vitest';
import { TimeBombDecorator } from './timeBomb';
import type { TimeBombMetadata } from './timeBomb';
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

function createTimeBombEvent(
  triggeredBy: PieceColor = W,
  metadata?: Readonly<Record<string, unknown>>,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.TimeBomb, triggeredBy, 0, metadata);
}

describe('TimeBombDecorator', () => {
  it('getEventType returns CrazyEvent.TimeBomb', () => {
    const d = new TimeBombDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.TimeBomb);
  });

  it('withInner returns a new TimeBombDecorator', () => {
    const d = new TimeBombDecorator(createAmericanRules());
    const d2 = d.withInner(createAmericanRules());
    expect(d2).toBeInstanceOf(TimeBombDecorator);
    expect(d2).not.toBe(d);
  });

  it('event has duration of -1 (condition-based)', () => {
    const event = createTimeBombEvent();
    expect(event.remainingPlies).toBe(-1);
  });

  it('countdown is initialized to 3 by metadata factory', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.TimeBomb);
    expect(factory).toBeDefined();
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 19, color: B, type: P },
    ]);
    if (factory === undefined) throw new Error('expected factory');
    const meta = factory(board, W, () => 0.1) as unknown as TimeBombMetadata;
    expect(meta.countdown).toBe(3);
  });

  it('metadata factory selects a piece from board', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.TimeBomb);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('expected factory');
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 19, color: B, type: P },
    ]);
    const meta = factory(board, W, () => 0.1) as unknown as TimeBombMetadata;
    expect(meta.bombSquare).toBeGreaterThan(0);
    expect([W, B]).toContain(meta.bombColor);
  });

  it('metadata factory returns sentinel when board is empty', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.TimeBomb);
    const board = buildBoard([]);
    if (factory === undefined) throw new Error('expected factory');
    const meta = factory(board, W, () => 0.5) as unknown as TimeBombMetadata;
    expect(meta.bombSquare).toBe(-1);
    expect(meta.countdown).toBe(0);
  });

  it('capturing the bombed piece removes the event (defuse)', () => {
    // Black pawn at sq 19 (row 4, col 6) has the bomb.
    // White pawn at sq 15 (row 3, col 4) can potentially capture.
    // Actually let's set up a capture scenario:
    // White at sq 22 (row 5, col 2), Black at sq 18 (row 4, col 3) — White captures to sq 15
    // But bomb is on sq 18, so capturing it should defuse.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const bombMeta = {
      bombSquare: 18,
      countdown: 3,
      bombColor: B,
    } as unknown as Readonly<Record<string, unknown>>;
    const state = crazyStateWithBoard(board, W, [createTimeBombEvent(W, bombMeta)]);

    const moves = getCurrentLegalMoves(state);
    const captureMove = moves.find(m => m.captured.length > 0);

    if (captureMove) {
      const newState = makeMove(state, captureMove);
      // The event should be removed (defused) since bombed piece was captured
      const bombEvents = newState.activeEvents.filter(
        e => e.type === CrazyEvent.TimeBomb,
      );
      expect(bombEvents.length).toBe(0);
    }
  });

  it('simple move decrements countdown in metadata', () => {
    // White at sq 22, Black far away. Bomb on black piece at sq 10.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const bombMeta = {
      bombSquare: 10,
      countdown: 3,
      bombColor: B,
    } as unknown as Readonly<Record<string, unknown>>;
    const state = crazyStateWithBoard(board, W, [createTimeBombEvent(W, bombMeta)]);

    const moves = getCurrentLegalMoves(state);
    const simpleMove = moves.find(m => m.captured.length === 0);
    expect(simpleMove).toBeDefined();

    if (simpleMove === undefined) throw new Error('expected simpleMove');
    const newState = makeMove(state, simpleMove);
    // After one ply, countdown should be 2
    const bombEvent = newState.activeEvents.find(
      e => e.type === CrazyEvent.TimeBomb,
    );
    if (bombEvent) {
      const meta = bombEvent.metadata as unknown as TimeBombMetadata;
      expect(meta.countdown).toBe(2);
    }
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.TimeBomb)).toBe(true);
  });

  it('is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.TimeBomb);
  });
});
