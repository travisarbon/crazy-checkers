/**
 * Stampede — comprehensive test suite (Event 30).
 */

import { describe, it, expect } from 'vitest';
import { StampedeDecorator } from './stampede';
import { createAmericanRules } from '../rules';
import { getEffectiveBoard } from '../game';
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
  square,
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

function createStampedeEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.Stampede, triggeredBy, 0);
}

describe('StampedeDecorator', () => {
  it('getEventType returns CrazyEvent.Stampede', () => {
    const d = new StampedeDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.Stampede);
  });

  it('withInner returns a new StampedeDecorator', () => {
    const d = new StampedeDecorator(createAmericanRules());
    const d2 = d.withInner(createAmericanRules());
    expect(d2).toBeInstanceOf(StampedeDecorator);
    expect(d2).not.toBe(d);
  });

  it('white pawns advance one diagonal square forward (toward row 0)', () => {
    // White pawn at sq 22 (row 5, col 2). Forward = row 4.
    // Possible destinations: (4,1) = sq 17 or (4,3) = sq 18
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createStampedeEvent()]);
    const effective = getEffectiveBoard(state);

    // sq 22 should be empty now (pawn moved)
    const at22 = getBoardSquare(effective, square(22));
    expect(at22).toBeNull();

    // Pawn should be at 17 or 18
    const at17 = getBoardSquare(effective, square(17));
    const at18 = getBoardSquare(effective, square(18));
    const movedWhite = at17 !== null ? at17 : at18;
    expect(movedWhite).not.toBeNull();
    expect(movedWhite?.color).toBe(W);
    expect(movedWhite?.type).toBe(PieceType.Pawn);
  });

  it('black pawns advance one diagonal square forward (toward row 7)', () => {
    // Black pawn at sq 10 (row 2, col 2). Forward = row 3.
    // Possible destinations: (3,1) not playable on odd row... let me recalculate.
    // Row 3 (odd): dark squares at cols 0,2,4,6. So (3,1)=not playable, (3,3)=not playable.
    // Wait: gridToSquare(3,1) — row 3 is odd, col must be even. col 1 is odd, not playable.
    // col-1=1 (not playable), col+1=3 (not playable)
    // So let's use a different square. Black pawn at sq 14 (row 3, col 2).
    // Forward = row 4 (even): dark at cols 1,3,5,7.
    // (4,1) = sq 17, (4,3) = sq 18. Both playable.
    const board = buildBoard([
      { sq: 14, color: B, type: P },
      { sq: 22, color: W, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createStampedeEvent()]);
    const effective = getEffectiveBoard(state);

    // sq 14 should be empty (pawn moved forward)
    const at14 = getBoardSquare(effective, square(14));
    expect(at14).toBeNull();

    // Pawn should be at 17 or 18
    const at17 = getBoardSquare(effective, square(17));
    const at18 = getBoardSquare(effective, square(18));
    const movedBlack = at17?.color === B ? at17 : at18?.color === B ? at18 : null;
    expect(movedBlack).not.toBeNull();
    expect(movedBlack?.color).toBe(B);
  });

  it('kings are unaffected by stampede', () => {
    // White king at sq 14, no pawns
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 10, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createStampedeEvent()]);
    const effective = getEffectiveBoard(state);

    // King should still be at sq 14
    const at14 = getBoardSquare(effective, square(14));
    expect(at14).not.toBeNull();
    expect(at14?.type).toBe(PieceType.King);
    expect(at14?.color).toBe(W);
  });

  it('occupied destination squares are skipped', () => {
    // White pawn at sq 22 (row 5, col 2). Both forward diags occupied by kings
    // (kings are unaffected by stampede so they stay put).
    // sq 17 (row 4, col 1) and sq 18 (row 4, col 3) occupied by kings
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 17, color: W, type: K },
      { sq: 18, color: W, type: K },
      { sq: 10, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createStampedeEvent()]);
    const effective = getEffectiveBoard(state);

    // White pawn should still be at 22 (nowhere to go, kings block both diags)
    const at22 = getBoardSquare(effective, square(22));
    expect(at22).not.toBeNull();
    expect(at22?.color).toBe(W);
    expect(at22?.type).toBe(PieceType.Pawn);
  });

  it('pawns promote when reaching promotion row', () => {
    // White pawn at sq 5 (row 1, col 0). Forward = row 0.
    // (0, -1) = off board, (0, 1) = sq 1. Row 0 is White's promotion row.
    const board = buildBoard([
      { sq: 5, color: W, type: P },
      { sq: 28, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createStampedeEvent()]);
    const effective = getEffectiveBoard(state);

    // Pawn should have promoted to king at sq 1
    const at1 = getBoardSquare(effective, square(1));
    expect(at1).not.toBeNull();
    expect(at1?.color).toBe(W);
    expect(at1?.type).toBe(PieceType.King);

    // Original square should be empty
    const at5 = getBoardSquare(effective, square(5));
    expect(at5).toBeNull();
  });

  it('event is instant (duration 0) — removed after ply', () => {
    const event = createStampedeEvent();
    expect(event.remainingPlies).toBe(0);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Stampede)).toBe(true);
  });

  it('is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Stampede);
  });

  it('metadata factory produces a seed', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.Stampede);
    expect(factory).toBeDefined();
    const board = buildBoard([{ sq: 14, color: W, type: P }]);
    if (factory === undefined) throw new Error('expected factory');
    const meta = factory(board, W, () => 0.5);
    expect(meta).toHaveProperty('seed');
  });
});
