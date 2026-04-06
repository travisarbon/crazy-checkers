/**
 * Forced March — comprehensive test suite (Event 27).
 */

import { describe, it, expect } from 'vitest';
import { ForcedMarchDecorator, getMostAdvancedPieceSquare } from './forcedMarch';
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
} from '../types';
import type { ActiveEvent, BoardState, GameState, Move, PlayerSetup } from '../types';
import { W, B, P, buildBoard } from '../test-utils';

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

function createFMEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.ForcedMarch, triggeredBy, 0);
}

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  if (moves[0] === undefined) throw new Error('No legal moves');
  return moves[0];
}

describe('getMostAdvancedPieceSquare', () => {
  it('White: closest to row 0 is most advanced', () => {
    // sq 10 (row 2) vs sq 22 (row 5) — sq 10 is more advanced for White
    const board = buildBoard([
      { sq: 10, color: W, type: P },
      { sq: 22, color: W, type: P },
    ]);
    const result = getMostAdvancedPieceSquare(board, W);
    expect(result as number).toBe(10);
  });

  it('Black: closest to row 7 is most advanced', () => {
    // sq 22 (row 5) vs sq 10 (row 2) — sq 22 is more advanced for Black
    const board = buildBoard([
      { sq: 10, color: B, type: P },
      { sq: 22, color: B, type: P },
    ]);
    const result = getMostAdvancedPieceSquare(board, B);
    expect(result as number).toBe(22);
  });

  it('tiebreaker: leftmost column wins', () => {
    // sq 9 (row 2, col 0) vs sq 10 (row 2, col 2) — sq 9 has lower col
    const board = buildBoard([
      { sq: 10, color: W, type: P },
      { sq: 9, color: W, type: P },
    ]);
    const result = getMostAdvancedPieceSquare(board, W);
    expect(result as number).toBe(9);
  });

  it('returns null for empty board', () => {
    expect(getMostAdvancedPieceSquare(buildBoard([]), W)).toBeNull();
  });
});

describe('ForcedMarchDecorator', () => {
  it('getEventType returns CrazyEvent.ForcedMarch', () => {
    const d = new ForcedMarchDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.ForcedMarch);
  });

  it('forces most advanced piece to move (simple moves)', () => {
    // White: sq 10 (row 2) is more advanced than sq 22 (row 5)
    const board = buildBoard([
      { sq: 10, color: W, type: P },
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createFMEvent()]);
    const moves = getCurrentLegalMoves(state);
    // All moves should be from sq 10 (most advanced)
    expect(moves.every(m => (m.from as number) === 10)).toBe(true);
  });

  it('fallback: blocked most-advanced piece allows any piece to move', () => {
    // White pawn at sq 5 (row 1, col 0) is most advanced but blocked
    // (no forward moves from col 0 at row 1: forward-left off-board, forward-right = sq 1 occupied)
    const board = buildBoard([
      { sq: 5, color: W, type: P },
      { sq: 1, color: W, type: P },
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createFMEvent()]);
    const moves = getCurrentLegalMoves(state);
    // Most advanced (sq 5) is blocked — fallback to other pieces
    expect(moves.length).toBeGreaterThan(0);
  });

  it('mandatory capture overrides forced march', () => {
    // White pawn at 22 (least advanced) can capture. Most advanced is at 10.
    const board = buildBoard([
      { sq: 10, color: W, type: P },
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createFMEvent()]);
    const moves = getCurrentLegalMoves(state);
    // Mandatory capture: jumps only. If most-advanced has jumps use them, else any.
    expect(moves.every(m => m.captured.length > 0)).toBe(true);
  });

  it('event expires after 4 plies', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 6, color: B, type: P },
    ]);
    let state = crazyState(board, W, [createFMEvent()]);
    for (let i = 0; i < 4; i++) state = makeMove(state, firstMove(state));
    expect(state.activeEvents.some(e => e.type === CrazyEvent.ForcedMarch)).toBe(false);
  });

  it('is registered', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.ForcedMarch)).toBe(true);
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.ForcedMarch);
  });
});
