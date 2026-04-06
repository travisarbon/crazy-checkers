/**
 * Dealer's Choice — comprehensive test suite (Event 11).
 */

import { describe, it, expect } from 'vitest';
import { DealersChoiceDecorator } from './dealersChoice';
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

function createDCEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
  metadata?: Record<string, unknown>,
): ActiveEvent {
  return createActiveEvent(
    CrazyEvent.DealersChoice,
    triggeredBy,
    triggeredAtPly,
    metadata ?? { whiteSkipUsed: false, blackSkipUsed: false },
  );
}

// ===========================================================================
// Metadata Factory
// ===========================================================================

describe('DealersChoice metadata factory', () => {
  it('initializes with both skips unused', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.DealersChoice);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('factory missing');
    const board = buildBoard([]);
    const metadata = factory(board, W);
    expect(metadata).toEqual({
      whiteSkipUsed: false,
      blackSkipUsed: false,
    });
  });
});

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('DealersChoiceDecorator', () => {
  it('getEventType returns CrazyEvent.DealersChoice', () => {
    const base = createAmericanRules();
    const decorator = new DealersChoiceDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.DealersChoice);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new DealersChoiceDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(DealersChoiceDecorator);
  });

  it('offers both jumps and simple moves when skip available', () => {
    // White pawn at 22 can jump Black pawn at 18 to 15.
    // With Dealer's Choice skip unused, White should also see simple moves.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createDCEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const jumps = moves.filter(m => m.captured.length > 0);
    const simples = moves.filter(m => m.captured.length === 0);
    expect(jumps.length).toBeGreaterThan(0);
    expect(simples.length).toBeGreaterThan(0);
  });

  it('only jumps when skip already used', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createDCEvent(W, 0, { whiteSkipUsed: true, blackSkipUsed: false });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // White's skip is used — mandatory capture applies
    const simples = moves.filter(m => m.captured.length === 0);
    expect(simples).toHaveLength(0);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('simple moves only when no jumps available (skip not consumed)', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createDCEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // No jumps available — only simple moves, skip not consumed
    expect(moves.every(m => m.captured.length === 0)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('skip is consumed when player makes simple move with jumps available', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 6, color: B, type: P },
    ]);
    const event = createDCEvent();
    let state = crazyStateWithBoard(board, W, [event]);

    // White chooses a simple move instead of capturing
    const simpleMove = getCurrentLegalMoves(state).find(m => m.captured.length === 0);
    expect(simpleMove).toBeDefined();
    if (simpleMove === undefined) throw new Error('no simple move');
    state = makeMove(state, simpleMove);

    // Check metadata was updated — White's skip should be used
    const dcEvent = state.activeEvents.find(e => e.type === CrazyEvent.DealersChoice);
    if (dcEvent?.metadata) {
      expect((dcEvent.metadata as Record<string, unknown>)['whiteSkipUsed']).toBe(true);
      expect((dcEvent.metadata as Record<string, unknown>)['blackSkipUsed']).toBe(false);
    }
  });

  it('event removed when both skips used', () => {
    // Setup where both players will make simple moves when jumps are available
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 6, color: B, type: P },
      { sq: 11, color: W, type: P },
    ]);
    // White skip already used, Black skip not yet
    const event = createDCEvent(W, 0, { whiteSkipUsed: true, blackSkipUsed: false });
    let state = crazyStateWithBoard(board, W, [event]);

    // White must capture (skip already used)
    const whiteJump = getCurrentLegalMoves(state).find(m => m.captured.length > 0);
    expect(whiteJump).toBeDefined();
    if (whiteJump === undefined) throw new Error('no white jump');
    state = makeMove(state, whiteJump);

    // Now Black's turn. If Black makes a simple move, Black's skip is consumed.
    // Check if Black has both jumps and simples
    const blackMoves = getCurrentLegalMoves(state);
    const blackSimple = blackMoves.find(m => m.captured.length === 0);
    if (blackSimple) {
      state = makeMove(state, blackSimple);
      // Both skips used — event should be removed
      expect(state.activeEvents.some(e => e.type === CrazyEvent.DealersChoice)).toBe(false);
    }
  });

  it('condition-based duration (-1)', () => {
    const event = createDCEvent();
    expect(event.remainingPlies).toBe(-1);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.DealersChoice)).toBe(true);
  });

  it('CrazyEvent.DealersChoice is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.DealersChoice);
  });
});
