/**
 * Ricochet — comprehensive test suite (Event 28).
 */

import { describe, it, expect } from 'vitest';
import { RicochetDecorator, computeBounceSquare } from './ricochet';
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

function createRicochetEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.Ricochet, triggeredBy, 0);
}

describe('RicochetDecorator', () => {
  it('getEventType returns CrazyEvent.Ricochet', () => {
    const d = new RicochetDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.Ricochet);
  });

  it('withInner returns a new RicochetDecorator', () => {
    const d = new RicochetDecorator(createAmericanRules());
    const d2 = d.withInner(createAmericanRules());
    expect(d2).toBeInstanceOf(RicochetDecorator);
    expect(d2).not.toBe(d);
  });

  it('computeBounceSquare returns correct square for diagonal movement', () => {
    // Move from sq 22 (row 5, col 2) to sq 18 (row 4, col 3) — direction: row-1, col+1
    // Bounce continues: row 3, col 4 = sq 15
    const result = computeBounceSquare(square(22), [square(18)]);
    expect(result).toBe(square(15));
  });

  it('computeBounceSquare returns correct square for jump movement', () => {
    // Jump from sq 22 (row 5, col 2) over something to sq 15 (row 3, col 4)
    // Direction from 22->15: row-2, col+2, normalized: row-1, col+1
    // Bounce: row 2, col 5 = sq 11
    const result = computeBounceSquare(square(22), [square(15)]);
    expect(result).toBe(square(11));
  });

  it('computeBounceSquare returns null for edge of board', () => {
    // Move to sq 4 (row 0, col 7). Bounce would be row -1, col 8 — off board
    const result = computeBounceSquare(square(8), [square(4)]);
    expect(result).toBeNull();
  });

  it('computeBounceSquare returns null for empty path', () => {
    const result = computeBounceSquare(square(14), []);
    expect(result).toBeNull();
  });

  it('no bounce on simple moves (non-captures)', () => {
    // White pawn at sq 22, no black to capture. Simple move to 18.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createRicochetEvent()]);

    const moves = getCurrentLegalMoves(state);
    const simpleMove = moves.find(m => m.captured.length === 0 && m.path[0] === square(18));
    if (simpleMove) {
      const newState = makeMove(state, simpleMove);
      // Piece at 18 (no bounce because no capture)
      const at18 = getBoardSquare(newState.board, square(18));
      expect(at18).not.toBeNull();
      expect(at18?.color).toBe(W);
    }
  });

  it('bounce after capture lands piece on next diagonal square', () => {
    // White at sq 22 (row 5, col 2), Black at sq 18 (row 4, col 3)
    // Capture lands on sq 15 (row 3, col 4). Bounce continues to sq 11 (row 2, col 5).
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createRicochetEvent()]);

    const moves = getCurrentLegalMoves(state);
    const captureMove = moves.find(m => m.captured.length > 0);
    expect(captureMove).toBeDefined();

    if (captureMove === undefined) throw new Error('expected captureMove');
    const newState = makeMove(state, captureMove);
    // Piece should bounce to sq 11
    const at11 = getBoardSquare(newState.board, square(11));
    expect(at11).not.toBeNull();
    expect(at11?.color).toBe(W);

    // Original capture landing should be empty
    const at15 = getBoardSquare(newState.board, square(15));
    expect(at15).toBeNull();
  });

  it('bounce square occupied — no bounce, piece stays at landing', () => {
    // White at sq 22, Black at sq 18. Capture lands at 15. But sq 11 occupied.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 11, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createRicochetEvent()]);

    const moves = getCurrentLegalMoves(state);
    const captureMove = moves.find(m => m.captured.length > 0 && m.path[m.path.length - 1] === square(15));
    if (captureMove) {
      const newState = makeMove(state, captureMove);
      // Piece stays at landing sq 15
      const at15 = getBoardSquare(newState.board, square(15));
      expect(at15).not.toBeNull();
      expect(at15?.color).toBe(W);
    }
  });

  it('event has duration of 2 plies', () => {
    const event = createRicochetEvent();
    expect(event.remainingPlies).toBe(2);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Ricochet)).toBe(true);
  });

  it('is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Ricochet);
  });

  it('metadata factory returns undefined (no metadata needed)', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.Ricochet);
    expect(factory).toBeDefined();
    const board = buildBoard([{ sq: 14, color: W, type: P }]);
    if (factory === undefined) throw new Error('expected factory');
    const meta = factory(board, W);
    expect(meta).toBeUndefined();
  });
});
