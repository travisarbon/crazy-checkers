/**
 * Rush Hour — comprehensive test suite (Event 36).
 */

import { describe, it, expect } from 'vitest';
import { RushHourDecorator, getDoubleStepMoves } from './rushHour';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { computeZobristHash } from '../zobrist';
import { squareToGrid } from '../board';
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
} from '../types';
import type { ActiveEvent, BoardState, GameState, Move, PlayerSetup } from '../types';
import { W, B, P, K, buildBoard } from '../test-utils';

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

function createRHEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.RushHour, triggeredBy, 0);
}

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  if (moves[0] === undefined) throw new Error('No legal moves');
  return moves[0];
}

describe('getDoubleStepMoves', () => {
  it('generates double-step for White pawn with clear path', () => {
    // White pawn at 22 (row 5, col 2). Forward-left chain: 22 → 17 → 13.
    // Forward-right chain: 22 → 18 → 15.
    // Both intermediate and destination must be empty.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const doubles = getDoubleStepMoves(board, W);
    expect(doubles.length).toBeGreaterThan(0);
    // Each double-step should jump 2 rows for White (from row 5 to row 3)
    for (const m of doubles) {
      const fromGrid = squareToGrid(m.from);
      const toSq = m.path[0];
      if (toSq === undefined) continue;
      const toGrid = squareToGrid(toSq);
      expect(fromGrid.row - toGrid.row).toBe(2);
    }
  });

  it('blocked intermediate prevents double-step', () => {
    // White pawn at 22, friendly pawn at 17 blocks forward-left path
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 17, color: W, type: P }, // blocks intermediate
      { sq: 3, color: B, type: P },
    ]);
    const doubles = getDoubleStepMoves(board, W);
    // Only forward-right double-step should be available (if path clear)
    const fwdLeftDoubles = doubles.filter(m => {
      const toSq = m.path[0];
      return toSq !== undefined && squareToGrid(toSq).col < squareToGrid(m.from).col;
    });
    expect(fwdLeftDoubles).toHaveLength(0);
  });

  it('does not generate for kings', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 3, color: B, type: P },
    ]);
    const doubles = getDoubleStepMoves(board, W);
    const fromKing = doubles.filter(m => (m.from as number) === 14);
    expect(fromKing).toHaveLength(0);
  });

  it('returns empty for empty board', () => {
    expect(getDoubleStepMoves(buildBoard([]), W)).toHaveLength(0);
  });
});

describe('RushHourDecorator', () => {
  it('getEventType returns CrazyEvent.RushHour', () => {
    const d = new RushHourDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.RushHour);
  });

  it('double-step moves available when no jumps exist', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createRHEvent()]);
    const moves = getCurrentLegalMoves(state);
    // Should have both regular simple moves and double-step moves
    const doubleSteps = moves.filter(m => {
      if (m.captured.length > 0) return false;
      const fromGrid = squareToGrid(m.from);
      const toSq = m.path[0];
      if (toSq === undefined) return false;
      const toGrid = squareToGrid(toSq);
      return Math.abs(fromGrid.row - toGrid.row) === 2;
    });
    expect(doubleSteps.length).toBeGreaterThan(0);
  });

  it('double-steps suppressed when jumps exist', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createRHEvent()]);
    const moves = getCurrentLegalMoves(state);
    // Only jumps (mandatory capture) — no double-steps
    expect(moves.every(m => m.captured.length > 0)).toBe(true);
  });

  it('event expires after 2 plies (1 round)', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 6, color: B, type: P },
    ]);
    let state = crazyState(board, W, [createRHEvent()]);
    for (let i = 0; i < 2; i++) state = makeMove(state, firstMove(state));
    expect(state.activeEvents.some(e => e.type === CrazyEvent.RushHour)).toBe(false);
  });

  it('is registered', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.RushHour)).toBe(true);
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.RushHour);
  });
});
