/**
 * Reinforcements — comprehensive test suite (Event 23).
 */

import { describe, it, expect } from 'vitest';
import { ReinforcementsDecorator, WHITE_BACK_ROW, BLACK_BACK_ROW } from './reinforcements';
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
import { W, B, P, buildBoard } from '../test-utils';
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

function createReinforcementsEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.Reinforcements, triggeredBy, 0);
}

describe('ReinforcementsDecorator', () => {
  it('getEventType returns CrazyEvent.Reinforcements', () => {
    const d = new ReinforcementsDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.Reinforcements);
  });

  it('withInner returns a new ReinforcementsDecorator', () => {
    const d = new ReinforcementsDecorator(createAmericanRules());
    const d2 = d.withInner(createAmericanRules());
    expect(d2).toBeInstanceOf(ReinforcementsDecorator);
    expect(d2).not.toBe(d);
  });

  it('exported back row constants are correct', () => {
    expect(WHITE_BACK_ROW).toEqual([29, 30, 31, 32]);
    expect(BLACK_BACK_ROW).toEqual([1, 2, 3, 4]);
  });

  it('spawns pawns on empty back-row squares for both players', () => {
    // Minimal board: one piece each, back rows empty
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 19, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createReinforcementsEvent()]);
    const effective = getEffectiveBoard(state);

    // White should get 2 pawns on back row (29, 30)
    const w29 = getBoardSquare(effective, square(29));
    expect(w29).not.toBeNull();
    expect(w29?.color).toBe(W);
    expect(w29?.type).toBe(PieceType.Pawn);

    const w30 = getBoardSquare(effective, square(30));
    expect(w30).not.toBeNull();
    expect(w30?.color).toBe(W);

    // Black should get 2 pawns on back row (1, 2)
    const b1 = getBoardSquare(effective, square(1));
    expect(b1).not.toBeNull();
    expect(b1?.color).toBe(B);
  });

  it('does not exceed 12 piece limit per player', () => {
    // Place 11 white pieces and 1 black piece
    const placements: Array<{ sq: number; color: PieceColor; type: PieceType }> = [];
    // White: 11 pawns at squares 5-15 (non-back-row)
    for (let i = 5; i <= 15; i++) {
      placements.push({ sq: i, color: W, type: P });
    }
    placements.push({ sq: 19, color: B, type: P });
    const board = buildBoard(placements);
    const state = crazyStateWithBoard(board, W, [createReinforcementsEvent()]);
    const effective = getEffectiveBoard(state);

    // White had 11 pieces, should gain at most 1 (limit 12)
    const whiteCount = getSquaresWithColor(effective, W).length;
    expect(whiteCount).toBeLessThanOrEqual(12);
  });

  it('back row squares that are already occupied are skipped', () => {
    // White back row squares 29 and 30 occupied, 31 and 32 empty
    const board = buildBoard([
      { sq: 29, color: W, type: P },
      { sq: 30, color: B, type: P },
      { sq: 14, color: W, type: P },
      { sq: 19, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createReinforcementsEvent()]);
    const effective = getEffectiveBoard(state);

    // sq 29 and 30 unchanged; new pawns at 31 and 32
    const w31 = getBoardSquare(effective, square(31));
    expect(w31).not.toBeNull();
    expect(w31?.color).toBe(W);

    const w32 = getBoardSquare(effective, square(32));
    expect(w32).not.toBeNull();
    expect(w32?.color).toBe(W);
  });

  it('event is instant (duration 0) — removed after ply', () => {
    const event = createReinforcementsEvent();
    expect(event.remainingPlies).toBe(0);
  });

  it('no empty back-row squares — no pieces spawned', () => {
    // All white back row occupied
    const board = buildBoard([
      { sq: 29, color: W, type: P },
      { sq: 30, color: W, type: P },
      { sq: 31, color: W, type: P },
      { sq: 32, color: W, type: P },
      { sq: 14, color: W, type: P },
      { sq: 19, color: B, type: P },
    ]);
    const state = crazyStateWithBoard(board, W, [createReinforcementsEvent()]);
    const effective = getEffectiveBoard(state);

    // White count should be the same (5 white pieces, no new ones on back row since full)
    const whiteBefore = getSquaresWithColor(board, W).length;
    // Black may gain pieces on its back row
    const whiteAfter = getSquaresWithColor(effective, W).length;
    expect(whiteAfter).toBe(whiteBefore);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Reinforcements)).toBe(true);
  });

  it('is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Reinforcements);
  });

  it('metadata factory produces a seed', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.Reinforcements);
    expect(factory).toBeDefined();
    const board = buildBoard([{ sq: 14, color: W, type: P }]);
    if (factory === undefined) throw new Error('expected factory');
    const meta = factory(board, W, () => 0.5);
    expect(meta).toHaveProperty('seed');
  });
});
