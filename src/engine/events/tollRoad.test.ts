/**
 * Toll Road — comprehensive test suite (Event 31).
 */

import { describe, it, expect } from 'vitest';
import { TollRoadDecorator, getLeastAdvancedPiece } from './tollRoad';
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
  square,
} from '../types';
import type {
  ActiveEvent,
  BoardState,
  GameState,
  PlayerSetup,
} from '../types';
import { W, B, P, buildBoard } from '../test-utils';
import { getBoardSquare } from '../board';

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

function createTollRoadEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.TollRoad, triggeredBy, 0);
}

describe('TollRoadDecorator', () => {
  it('getEventType returns CrazyEvent.TollRoad', () => {
    const d = new TollRoadDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.TollRoad);
  });

  it('withInner returns a new TollRoadDecorator', () => {
    const d = new TollRoadDecorator(createAmericanRules());
    const d2 = d.withInner(createAmericanRules());
    expect(d2).toBeInstanceOf(TollRoadDecorator);
    expect(d2).not.toBe(d);
  });

  it('getLeastAdvancedPiece returns correct square for White (highest row = least advanced)', () => {
    // White pieces at sq 14 (row 3) and sq 30 (row 7).
    // White advances toward row 0, so advancement = 7 - row.
    // sq 14: advancement = 7 - 3 = 4. sq 30: advancement = 7 - 7 = 0.
    // Least advanced = sq 30.
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 30, color: W, type: P },
    ]);
    const result = getLeastAdvancedPiece(board, W);
    expect(result).toBe(square(30));
  });

  it('getLeastAdvancedPiece returns correct square for Black (lowest row = least advanced)', () => {
    // Black pieces at sq 3 (row 0) and sq 19 (row 4).
    // Black advances toward row 7, so advancement = row.
    // sq 3: advancement = 0. sq 19: advancement = 4.
    // Least advanced = sq 3.
    const board = buildBoard([
      { sq: 3, color: B, type: P },
      { sq: 19, color: B, type: P },
    ]);
    const result = getLeastAdvancedPiece(board, B);
    expect(result).toBe(square(3));
  });

  it('getLeastAdvancedPiece returns null for single piece (can\'t toll last piece)', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
    ]);
    const result = getLeastAdvancedPiece(board, W);
    expect(result).toBeNull();
  });

  it('getLeastAdvancedPiece returns null when no pieces of that color', () => {
    const board = buildBoard([
      { sq: 14, color: B, type: P },
    ]);
    const result = getLeastAdvancedPiece(board, W);
    expect(result).toBeNull();
  });

  it('toll is paid on capture — least advanced piece removed', () => {
    // White: sq 22 (row 5, captures Black at sq 18 to land sq 15) and sq 30 (row 7, least advanced)
    // After capture, sq 30 should be removed as toll
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 30, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createTollRoadEvent()]);

    const moves = getCurrentLegalMoves(state);
    const captureMove = moves.find(m => m.captured.length > 0);
    expect(captureMove).toBeDefined();

    if (captureMove === undefined) throw new Error('expected captureMove');
    const newState = makeMove(state, captureMove);
    // Toll piece at sq 30 should be removed
    const at30 = getBoardSquare(newState.board, square(30));
    expect(at30).toBeNull();
  });

  it('no toll on simple moves (non-capture)', () => {
    // White: sq 22 and sq 30, no Black adjacent for capture
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 30, color: W, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createTollRoadEvent()]);

    const moves = getCurrentLegalMoves(state);
    const simpleMove = moves.find(m => m.captured.length === 0);
    expect(simpleMove).toBeDefined();

    if (simpleMove === undefined) throw new Error('expected simpleMove');
    const newState = makeMove(state, simpleMove);
    // Both white pieces should still exist (no toll on non-capture)
    const at30 = getBoardSquare(newState.board, square(30));
    expect(at30).not.toBeNull();
    expect(at30?.color).toBe(W);
  });

  it('event has duration of 4 plies', () => {
    const event = createTollRoadEvent();
    expect(event.remainingPlies).toBe(4);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.TollRoad)).toBe(true);
  });

  it('is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.TollRoad);
  });

  it('metadata factory returns undefined (no metadata needed)', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.TollRoad);
    expect(factory).toBeDefined();
    const board = buildBoard([{ sq: 14, color: W, type: P }]);
    if (factory === undefined) throw new Error('expected factory');
    const meta = factory(board, W);
    expect(meta).toBeUndefined();
  });
});
