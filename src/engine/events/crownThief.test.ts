/**
 * Crown Thief — comprehensive test suite (Event 29).
 */

import { describe, it, expect } from 'vitest';
import { CrownThiefDecorator } from './crownThief';
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
  PieceType,
  PlayerType,
} from '../types';
import type {
  ActiveEvent,
  BoardState,
  GameState,
  PlayerSetup,
} from '../types';
import { W, B, P, K, buildBoard } from '../test-utils';
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

function createCrownThiefEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.CrownThief, triggeredBy, 0);
}

describe('CrownThiefDecorator', () => {
  it('getEventType returns CrazyEvent.CrownThief', () => {
    const d = new CrownThiefDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.CrownThief);
  });

  it('withInner returns a new CrownThiefDecorator', () => {
    const d = new CrownThiefDecorator(createAmericanRules());
    const d2 = d.withInner(createAmericanRules());
    expect(d2).toBeInstanceOf(CrownThiefDecorator);
    expect(d2).not.toBe(d);
  });

  it('pawn captures king → pawn promoted to king at landing square', () => {
    // White pawn at sq 22 (row 5, col 2), Black king at sq 18 (row 4, col 3)
    // White captures to sq 15 (row 3, col 4) — not a promotion row for White
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: K },
    ]);
    const state = crazyStateWithBoard(board, W, [createCrownThiefEvent()]);

    const moves = getCurrentLegalMoves(state);
    const captureMove = moves.find(m => m.captured.length > 0);
    expect(captureMove).toBeDefined();

    if (captureMove === undefined) throw new Error('expected captureMove');
    const newState = makeMove(state, captureMove);
    const landing = captureMove.path[captureMove.path.length - 1];
    if (landing === undefined) throw new Error('expected landing');
    const piece = getBoardSquare(newState.board, landing);
    expect(piece).not.toBeNull();
    expect(piece?.color).toBe(W);
    // Pawn should be promoted to king via Crown Thief
    expect(piece?.type).toBe(PieceType.King);
  });

  it('pawn captures pawn → no promotion (only pawn-captures-king triggers)', () => {
    // White pawn at sq 22, Black pawn at sq 18
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createCrownThiefEvent()]);

    const moves = getCurrentLegalMoves(state);
    const captureMove = moves.find(m => m.captured.length > 0);
    expect(captureMove).toBeDefined();
    if (captureMove === undefined) throw new Error('expected captureMove');

    const newState = makeMove(state, captureMove);
    const landing = captureMove.path[captureMove.path.length - 1];
    if (landing === undefined) throw new Error('expected landing');
    const piece = getBoardSquare(newState.board, landing);
    expect(piece).not.toBeNull();
    // Should NOT be promoted — target was a pawn, not a king
    expect(piece?.type).toBe(PieceType.Pawn);
  });

  it('king captures king → no extra promotion (only pawns trigger)', () => {
    // White king at sq 22, Black king at sq 18
    const board = buildBoard([
      { sq: 22, color: W, type: K },
      { sq: 18, color: B, type: K },
    ]);
    const state = crazyStateWithBoard(board, W, [createCrownThiefEvent()]);

    const moves = getCurrentLegalMoves(state);
    const captureMove = moves.find(m => m.captured.length > 0);
    expect(captureMove).toBeDefined();
    if (captureMove === undefined) throw new Error('expected captureMove');

    const newState = makeMove(state, captureMove);
    const landing = captureMove.path[captureMove.path.length - 1];
    if (landing === undefined) throw new Error('expected landing');
    const piece = getBoardSquare(newState.board, landing);
    expect(piece).not.toBeNull();
    // King remains king — Crown Thief only triggers for pawns capturing kings
    expect(piece?.type).toBe(PieceType.King);
  });

  it('simple move (no capture) — no promotion effect', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 10, color: B, type: K },
    ]);
    const state = crazyStateWithBoard(board, W, [createCrownThiefEvent()]);

    const moves = getCurrentLegalMoves(state);
    const simpleMove = moves.find(m => m.captured.length === 0);
    expect(simpleMove).toBeDefined();
    if (simpleMove === undefined) throw new Error('expected simpleMove');

    const newState = makeMove(state, simpleMove);
    const landing = simpleMove.path[simpleMove.path.length - 1];
    if (landing === undefined) throw new Error('expected landing');
    const piece = getBoardSquare(newState.board, landing);
    expect(piece).not.toBeNull();
    expect(piece?.type).toBe(PieceType.Pawn);
  });

  it('event has duration of 4 plies', () => {
    const event = createCrownThiefEvent();
    expect(event.remainingPlies).toBe(4);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.CrownThief)).toBe(true);
  });

  it('is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.CrownThief);
  });

  it('metadata factory returns undefined (no metadata needed)', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.CrownThief);
    expect(factory).toBeDefined();
    const board = buildBoard([{ sq: 14, color: W, type: P }]);
    if (factory === undefined) throw new Error('expected factory');
    const meta = factory(board, W);
    expect(meta).toBeUndefined();
  });
});
