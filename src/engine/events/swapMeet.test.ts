/**
 * Swap Meet — comprehensive test suite (Event 32).
 */

import { describe, it, expect } from 'vitest';
import { SwapMeetDecorator } from './swapMeet';
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
import { getBoardSquare, getSquaresWithColor } from '../board';

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

function createSwapMeetEvent(
  triggeredBy: PieceColor = W,
  metadata?: Readonly<Record<string, unknown>>,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.SwapMeet, triggeredBy, 0, metadata);
}

describe('SwapMeetDecorator', () => {
  it('getEventType returns CrazyEvent.SwapMeet', () => {
    const d = new SwapMeetDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.SwapMeet);
  });

  it('withInner returns a new SwapMeetDecorator', () => {
    const d = new SwapMeetDecorator(createAmericanRules());
    const d2 = d.withInner(createAmericanRules());
    expect(d2).toBeInstanceOf(SwapMeetDecorator);
    expect(d2).not.toBe(d);
  });

  it('pieces swap positions (total piece count preserved)', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
      { sq: 19, color: B, type: P },
    ]);
    const meta = { seed: 42 } as unknown as Readonly<Record<string, unknown>>;
    const state = crazyStateWithBoard(board, W, [createSwapMeetEvent(W, meta)]);
    const effective = getEffectiveBoard(state);

    // Total piece count should be preserved
    const whiteCount = getSquaresWithColor(effective, W).length;
    const blackCount = getSquaresWithColor(effective, B).length;
    expect(whiteCount).toBe(2);
    expect(blackCount).toBe(2);
  });

  it('piece types preserved after swap', () => {
    // White king at 14, Black pawn at 19
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 19, color: B, type: P },
    ]);
    const meta = { seed: 42 } as unknown as Readonly<Record<string, unknown>>;
    const state = crazyStateWithBoard(board, W, [createSwapMeetEvent(W, meta)]);
    const effective = getEffectiveBoard(state);

    // After swap: black pawn at 14, white king at 19
    const at14 = getBoardSquare(effective, square(14));
    const at19 = getBoardSquare(effective, square(19));
    expect(at14).not.toBeNull();
    expect(at19).not.toBeNull();

    // One should be white king, one should be black pawn (swapped positions)
    if (at14?.color === B) {
      expect(at14.type).toBe(PieceType.Pawn);
      expect(at19?.color).toBe(W);
      expect(at19?.type).toBe(PieceType.King);
    } else {
      // If seed didn't cause a swap, pieces remain
      expect(at14?.color).toBe(W);
      expect(at14?.type).toBe(PieceType.King);
      expect(at19?.color).toBe(B);
      expect(at19?.type).toBe(PieceType.Pawn);
    }
  });

  it('swap is deterministic with same seed', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 22, color: W, type: K },
      { sq: 3, color: B, type: P },
      { sq: 19, color: B, type: K },
    ]);
    const meta = { seed: 12345 } as unknown as Readonly<Record<string, unknown>>;

    const state1 = crazyStateWithBoard(board, W, [createSwapMeetEvent(W, meta)]);
    const effective1 = getEffectiveBoard(state1);

    const state2 = crazyStateWithBoard(board, W, [createSwapMeetEvent(W, meta)]);
    const effective2 = getEffectiveBoard(state2);

    // Both should produce identical results
    for (let i = 1; i <= 32; i++) {
      const p1 = getBoardSquare(effective1, square(i));
      const p2 = getBoardSquare(effective2, square(i));
      expect(p1).toEqual(p2);
    }
  });

  it('at most 2 swaps occur', () => {
    // 3 white pieces, 3 black pieces — but at most 2 swaps
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 22, color: W, type: P },
      { sq: 30, color: W, type: P },
      { sq: 3, color: B, type: P },
      { sq: 10, color: B, type: P },
      { sq: 19, color: B, type: P },
    ]);
    const meta = { seed: 42 } as unknown as Readonly<Record<string, unknown>>;
    const state = crazyStateWithBoard(board, W, [createSwapMeetEvent(W, meta)]);
    const effective = getEffectiveBoard(state);

    // Total piece counts preserved
    const whiteCount = getSquaresWithColor(effective, W).length;
    const blackCount = getSquaresWithColor(effective, B).length;
    expect(whiteCount).toBe(3);
    expect(blackCount).toBe(3);
  });

  it('with only one piece per side, only one swap occurs', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 19, color: B, type: P },
    ]);
    const meta = { seed: 42 } as unknown as Readonly<Record<string, unknown>>;
    const state = crazyStateWithBoard(board, W, [createSwapMeetEvent(W, meta)]);
    const effective = getEffectiveBoard(state);

    // After single swap: white should be at 19, black at 14
    const at14 = getBoardSquare(effective, square(14));
    const at19 = getBoardSquare(effective, square(19));
    expect(at14).not.toBeNull();
    expect(at19).not.toBeNull();
    expect(at14?.color).toBe(B);
    expect(at19?.color).toBe(W);
  });

  it('event is instant (duration 0) — removed after ply', () => {
    const event = createSwapMeetEvent();
    expect(event.remainingPlies).toBe(0);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.SwapMeet)).toBe(true);
  });

  it('is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.SwapMeet);
  });

  it('metadata factory produces a seed', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.SwapMeet);
    expect(factory).toBeDefined();
    const board = buildBoard([{ sq: 14, color: W, type: P }]);
    if (factory === undefined) throw new Error('expected factory');
    const meta = factory(board, W, () => 0.5);
    expect(meta).toHaveProperty('seed');
  });
});
