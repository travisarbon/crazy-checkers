/**
 * Sentry — comprehensive test suite (Event 35).
 */

import { describe, it, expect } from 'vitest';
import { SentryDecorator, getPinnedSquares } from './sentry';
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

function createSEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.Sentry, triggeredBy, 0);
}

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  if (moves[0] === undefined) throw new Error('No legal moves');
  return moves[0];
}

describe('getPinnedSquares', () => {
  it('pawn adjacent to enemy king is pinned', () => {
    // White pawn at 18, Black king at 14 (adjacent)
    const board = buildBoard([
      { sq: 18, color: W, type: P },
      { sq: 14, color: B, type: K },
    ]);
    const pinned = getPinnedSquares(board, W);
    expect(pinned.has(18)).toBe(true);
  });

  it('pawn NOT adjacent to enemy king is not pinned', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: K },
    ]);
    const pinned = getPinnedSquares(board, W);
    expect(pinned.has(22)).toBe(false);
  });

  it('king adjacent to enemy king is NOT pinned', () => {
    const board = buildBoard([
      { sq: 18, color: W, type: K },
      { sq: 14, color: B, type: K },
    ]);
    const pinned = getPinnedSquares(board, W);
    expect(pinned.has(18)).toBe(false);
  });

  it('empty board returns empty set', () => {
    expect(getPinnedSquares(buildBoard([]), W).size).toBe(0);
  });
});

describe('SentryDecorator', () => {
  it('getEventType returns CrazyEvent.Sentry', () => {
    const d = new SentryDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.Sentry);
  });

  it('pinned pawn simple moves are blocked', () => {
    // White pawn at 18, Black king at 14 (adjacent, pins 18)
    const board = buildBoard([
      { sq: 18, color: W, type: P },
      { sq: 14, color: B, type: K },
      { sq: 30, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createSEvent()]);
    const moves = getCurrentLegalMoves(state);
    // No simple moves from pinned sq 18
    const simpleMoves18 = moves.filter(m => (m.from as number) === 18 && m.captured.length === 0);
    expect(simpleMoves18).toHaveLength(0);
  });

  it('pinned pawn CAN still capture', () => {
    // White pawn at 18 (row 4, col 3), Black king at 14 (row 3, col 2) (adjacent, pins 18)
    // White can jump over Black king at 14 to sq 9 (row 2, col 1) or to sq 11 (row 2, col 3)?
    // sq 18 forward-left = sq 14 (Black king). Jump target = row 2, col 1 = sq 9.
    const board = buildBoard([
      { sq: 18, color: W, type: P },
      { sq: 14, color: B, type: K },
      { sq: 30, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createSEvent()]);
    const moves = getCurrentLegalMoves(state);
    const captures18 = moves.filter(m => (m.from as number) === 18 && m.captured.length > 0);
    expect(captures18.length).toBeGreaterThan(0);
  });

  it('unpinned pieces move normally', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: K },
      { sq: 6, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createSEvent()]);
    const moves = getCurrentLegalMoves(state);
    expect(moves.some(m => (m.from as number) === 22)).toBe(true);
  });

  it('event expires after 4 plies', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 6, color: B, type: P },
    ]);
    let state = crazyState(board, W, [createSEvent()]);
    for (let i = 0; i < 4; i++) state = makeMove(state, firstMove(state));
    expect(state.activeEvents.some(e => e.type === CrazyEvent.Sentry)).toBe(false);
  });

  it('is registered', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Sentry)).toBe(true);
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Sentry);
  });
});
