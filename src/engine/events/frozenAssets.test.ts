/**
 * Frozen Assets — comprehensive test suite (Event 18).
 */

import { describe, it, expect } from 'vitest';
import { FrozenAssetsDecorator, filterKingMoves } from './frozenAssets';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { computeZobristHash } from '../zobrist';
import {
  createActiveEvent,
  IMPLEMENTED_EVENTS,
  EVENT_DECORATOR_REGISTRY,
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
  Move,
  PlayerSetup,
} from '../types';
import { W, B, P, K, buildBoard } from '../test-utils';

const HUMAN_VS_HUMAN: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.Human,
};

function move(from: number, path: number[], captured: number[] = []): Move {
  return {
    from: square(from),
    path: path.map(square),
    captured: captured.map(square),
  };
}

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

function createFAEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.FrozenAssets, triggeredBy, triggeredAtPly);
}

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  const first = moves[0];
  if (first === undefined) throw new Error('No legal moves');
  return first;
}

// ===========================================================================
// Unit Tests — Pure Helper Function (filterKingMoves)
// ===========================================================================

describe('filterKingMoves', () => {
  it('king simple moves are removed', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 3, color: B, type: P },
    ]);
    const moves: Move[] = [
      move(14, [10]), move(14, [9]), move(14, [18]), move(14, [17]),
    ];
    const result = filterKingMoves(board, moves, W);
    expect(result).toHaveLength(0);
  });

  it('pawn simple moves are preserved', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const moves: Move[] = [move(22, [17]), move(22, [18])];
    const result = filterKingMoves(board, moves, W);
    expect(result).toHaveLength(2);
  });

  it('king jumps are removed, pawn simple moves regenerated', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 10, color: B, type: P },
      { sq: 22, color: W, type: P },
    ]);
    const moves: Move[] = [move(14, [7], [10])]; // king jump
    const result = filterKingMoves(board, moves, W);
    // King jump removed → pawn simple moves regenerated
    expect(result.every(m => m.captured.length === 0)).toBe(true);
    expect(result.some(m => (m.from as number) === 22)).toBe(true);
  });

  it('pawn jumps are preserved', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const moves: Move[] = [move(22, [15], [18])];
    const result = filterKingMoves(board, moves, W);
    expect(result).toHaveLength(1);
    expect(result[0]?.captured).toHaveLength(1);
  });
});

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('FrozenAssetsDecorator', () => {
  it('getEventType returns CrazyEvent.FrozenAssets', () => {
    const base = createAmericanRules();
    const decorator = new FrozenAssetsDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.FrozenAssets);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new FrozenAssetsDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(FrozenAssetsDecorator);
  });

  it('kings cannot move during active event', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createFAEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);
    // No moves from king at sq 14
    expect(moves.every(m => (m.from as number) !== 14)).toBe(true);
    // Pawn at 22 can still move
    expect(moves.some(m => (m.from as number) === 22)).toBe(true);
  });

  it('event expires after 2 rounds (4 plies)', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createFAEvent();
    let state = crazyStateWithBoard(board, W, [event]);

    expect(state.activeEvents.some(e => e.type === CrazyEvent.FrozenAssets)).toBe(true);

    for (let i = 0; i < 4; i++) {
      state = makeMove(state, firstMove(state));
    }

    expect(state.activeEvents.some(e => e.type === CrazyEvent.FrozenAssets)).toBe(false);
  });

  it('KingForADay takes precedence — kings move normally', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 3, color: B, type: P },
    ]);
    const kfadEvent = createActiveEvent(CrazyEvent.KingForADay, W, 0, {
      originalKingSquares: [14],
    });
    const faEvent = createFAEvent();
    const state = crazyStateWithBoard(board, W, [kfadEvent, faEvent]);
    const moves = getCurrentLegalMoves(state);

    // King at 14 should be able to move (KfaD nullifies Frozen Assets)
    expect(moves.some(m => (m.from as number) === 14)).toBe(true);
  });

  it('only-kings player has no legal moves → game over', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 3, color: B, type: P },
    ]);
    const event = createFAEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);
    expect(moves).toHaveLength(0);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.FrozenAssets)).toBe(true);
  });

  it('CrazyEvent.FrozenAssets is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.FrozenAssets);
  });
});
