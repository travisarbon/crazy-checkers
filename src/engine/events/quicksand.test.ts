/**
 * Quicksand — comprehensive test suite (Event 13).
 */

import { describe, it, expect } from 'vitest';
import { QuicksandDecorator, isEdgeSquare, EDGE_SQUARES } from './quicksand';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { computeZobristHash } from '../zobrist';
import {
  createActiveEvent,
  IMPLEMENTED_EVENTS,
  EVENT_DECORATOR_REGISTRY,
  EVENT_METADATA_FACTORIES,
  tickAllEvents,
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

function createQSEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
  metadata?: Record<string, unknown>,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.Quicksand, triggeredBy, triggeredAtPly, metadata);
}

// ===========================================================================
// Edge Square Detection
// ===========================================================================

describe('isEdgeSquare', () => {
  it('row 0 squares (1-4) are edge', () => {
    expect(isEdgeSquare(1)).toBe(true);
    expect(isEdgeSquare(2)).toBe(true);
    expect(isEdgeSquare(3)).toBe(true);
    expect(isEdgeSquare(4)).toBe(true);
  });

  it('row 7 squares (29-32) are edge', () => {
    expect(isEdgeSquare(29)).toBe(true);
    expect(isEdgeSquare(30)).toBe(true);
    expect(isEdgeSquare(31)).toBe(true);
    expect(isEdgeSquare(32)).toBe(true);
  });

  it('col 0 squares are edge', () => {
    // col 0 on odd rows: sq 5 (row 1), 13 (row 3), 21 (row 5), 29 (row 7)
    expect(isEdgeSquare(5)).toBe(true);
    expect(isEdgeSquare(13)).toBe(true);
    expect(isEdgeSquare(21)).toBe(true);
  });

  it('col 7 squares are edge', () => {
    // col 7 on even rows: sq 4 (row 0), 12 (row 2), 20 (row 4), 28 (row 6)
    expect(isEdgeSquare(4)).toBe(true);
    expect(isEdgeSquare(12)).toBe(true);
    expect(isEdgeSquare(20)).toBe(true);
    expect(isEdgeSquare(28)).toBe(true);
  });

  it('center squares are not edge', () => {
    expect(isEdgeSquare(14)).toBe(false);
    expect(isEdgeSquare(15)).toBe(false);
    expect(isEdgeSquare(18)).toBe(false);
    expect(isEdgeSquare(19)).toBe(false);
  });

  it('EDGE_SQUARES has 14 squares', () => {
    expect(EDGE_SQUARES.size).toBe(14);
  });
});

// ===========================================================================
// Metadata Factory
// ===========================================================================

describe('Quicksand metadata factory', () => {
  it('records occupied edge squares at activation', () => {
    const board = buildBoard([
      { sq: 1, color: W, type: P },  // edge (row 0)
      { sq: 14, color: W, type: P }, // not edge
      { sq: 29, color: B, type: P }, // edge (row 7)
    ]);
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.Quicksand);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('factory missing');
    const metadata = factory(board, W);
    expect(metadata).toBeDefined();
    const exempt = (metadata as Record<string, unknown>)['exemptSquares'] as number[];
    expect(exempt).toContain(1);
    expect(exempt).toContain(29);
    expect(exempt).not.toContain(14);
  });
});

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('QuicksandDecorator', () => {
  it('getEventType returns CrazyEvent.Quicksand', () => {
    const base = createAmericanRules();
    const decorator = new QuicksandDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.Quicksand);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new QuicksandDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(QuicksandDecorator);
  });

  it('piece on non-exempt edge square cannot move', () => {
    // White pawn at sq 21 (col 0, edge). Not in exempt list.
    const board = buildBoard([
      { sq: 21, color: W, type: P },
      { sq: 14, color: W, type: P }, // center, can move
      { sq: 3, color: B, type: P },
    ]);
    const event = createQSEvent(W, 0, { exemptSquares: [] });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // No moves from edge sq 21
    expect(moves.every(m => (m.from as number) !== 21)).toBe(true);
    // Moves from center sq 14 should exist
    expect(moves.some(m => m.from === square(14))).toBe(true);
  });

  it('piece on exempt edge square can move', () => {
    // White pawn at sq 21 (edge), exempt
    const board = buildBoard([
      { sq: 21, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createQSEvent(W, 0, { exemptSquares: [21] });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    expect(moves.some(m => m.from === square(21))).toBe(true);
  });

  it('center pieces can always move', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createQSEvent(W, 0, { exemptSquares: [] });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    expect(moves.some(m => m.from === square(14))).toBe(true);
  });

  it('exempt piece loses exemption after moving (via metadata update)', () => {
    // White pawn at sq 21 (edge, exempt). After moving away, exemption is lost.
    const board = buildBoard([
      { sq: 21, color: W, type: P },
      { sq: 6, color: B, type: P },
    ]);
    const event = createQSEvent(W, 0, { exemptSquares: [21] });
    let state = crazyStateWithBoard(board, W, [event]);

    // White moves from 21 (exempt edge) to center
    const whiteMove = getCurrentLegalMoves(state).find(m => m.from === square(21));
    expect(whiteMove).toBeDefined();
    if (whiteMove === undefined) throw new Error('no move from 21');
    state = makeMove(state, whiteMove);

    // Check metadata was updated — exemptSquares should no longer include 21
    const qsEvent = state.activeEvents.find(e => e.type === CrazyEvent.Quicksand);
    if (qsEvent?.metadata) {
      const exempt = (qsEvent.metadata as Record<string, unknown>)['exemptSquares'] as number[];
      expect(exempt).not.toContain(21);
    }
  });

  it('event expires after 8 rounds (16 plies)', () => {
    // Duration-based: 16 plies = 8 rounds. Verify tick mechanism.
    const event = createActiveEvent(CrazyEvent.Quicksand, W, 0, { exemptSquares: [] });
    expect(event.remainingPlies).toBe(16);

    // Verify it ticks down correctly via tickAllEvents
    let events: readonly ActiveEvent[] = [event];
    events = tickAllEvents(events);
    expect(events[0]?.remainingPlies).toBe(15);

    // Tick remaining 15 times
    for (let i = 0; i < 14; i++) {
      events = tickAllEvents(events);
    }
    expect(events[0]?.remainingPlies).toBe(1);
    events = tickAllEvents(events); // ply 16: 0 remaining → removed
    expect(events).toHaveLength(0);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Quicksand)).toBe(true);
  });

  it('CrazyEvent.Quicksand is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Quicksand);
  });
});
