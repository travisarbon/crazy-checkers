/**
 * Royal Decree — comprehensive test suite (Event 33).
 */

import { describe, it, expect } from 'vitest';
import { RoyalDecreeDecorator } from './royalDecree';
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
  PieceType,
  PlayerType,
} from '../types';
import type { ActiveEvent, BoardState, GameState, Move, PlayerSetup } from '../types';
import { W, B, P, K, buildBoard } from '../test-utils';
import { getBoardSquare } from '../board';

const HUMAN_VS_HUMAN: PlayerSetup = { white: PlayerType.Human, black: PlayerType.Human };

function crazyState(
  board: BoardState,
  activeColor: PieceColor = PieceColor.White,
  activeEvents: readonly ActiveEvent[] = [],
): GameState {
  const base = createAmericanRules();
  const ruleSet = createCompositeRuleSet(base);
  return {
    board, activeColor, status: GameStatus.InProgress, result: null,
    ruleSet, players: HUMAN_VS_HUMAN, moveHistory: [],
    positionHashes: [computeZobristHash(board, activeColor)],
    halfMoveClock: 0, plyCount: 0, mode: GameMode.Crazy, activeEvents,
  };
}

function createRDEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.RoyalDecree, triggeredBy, 0);
}

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  if (moves[0] === undefined) throw new Error('No legal moves');
  return moves[0];
}

describe('RoyalDecreeDecorator', () => {
  it('getEventType returns CrazyEvent.RoyalDecree', () => {
    const d = new RoyalDecreeDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.RoyalDecree);
  });

  it('withInner produces a new instance', () => {
    const d = new RoyalDecreeDecorator(createAmericanRules());
    expect(d.withInner(createAmericanRules())).toBeInstanceOf(RoyalDecreeDecorator);
  });

  it('only kings can move when player has kings', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createRDEvent()]);
    const moves = getCurrentLegalMoves(state);
    expect(moves.every(m => {
      const p = getBoardSquare(board, m.from);
      return p !== null && p.type === PieceType.King;
    })).toBe(true);
  });

  it('safety valve: pawns move when no kings exist', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createRDEvent()]);
    const moves = getCurrentLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.captured.length === 0)).toBe(true);
  });

  it('cancels out with Frozen Assets — all pieces move normally', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const rdEvent = createRDEvent();
    const faEvent = createActiveEvent(CrazyEvent.FrozenAssets, W, 0);
    const state = crazyState(board, W, [rdEvent, faEvent]);
    const moves = getCurrentLegalMoves(state);
    // Both king and pawn should have moves (cancel out)
    expect(moves.some(m => (m.from as number) === 14)).toBe(true);
    expect(moves.some(m => (m.from as number) === 22)).toBe(true);
  });

  it('event expires after 4 plies', () => {
    // Kings far enough apart to not capture each other in 4 plies
    const board = buildBoard([
      { sq: 23, color: W, type: K },
      { sq: 10, color: B, type: K },
    ]);
    let state = crazyState(board, W, [createRDEvent()]);
    for (let i = 0; i < 4; i++) state = makeMove(state, firstMove(state));
    expect(state.activeEvents.some(e => e.type === CrazyEvent.RoyalDecree)).toBe(false);
  });

  it('is registered', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.RoyalDecree)).toBe(true);
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.RoyalDecree);
  });

  it('pawn jumps blocked → king simple moves regenerated', () => {
    // Only available jump is from a pawn; king far away has only simple moves
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 32, color: W, type: K }, // far corner, no captures available
      { sq: 3, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createRDEvent()]);
    const moves = getCurrentLegalMoves(state);
    // Pawn jump blocked by Royal Decree → king simple moves regenerated
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => (m.from as number) === 32)).toBe(true);
    expect(moves.every(m => m.captured.length === 0)).toBe(true);
  });
});
