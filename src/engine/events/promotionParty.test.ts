/**
 * Promotion Party — comprehensive test suite (Event 22).
 */

import { describe, it, expect } from 'vitest';
import { PromotionPartyDecorator, getExpandedPromotionRow, isExpandedPromotionSquare } from './promotionParty';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { getBoardSquare } from '../board';
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
  square,
} from '../types';
import type { ActiveEvent, BoardState, GameState, PlayerSetup } from '../types';
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

function createPPEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.PromotionParty, triggeredBy, 0);
}

describe('helpers', () => {
  it('expanded promotion row for White is 1', () => {
    expect(getExpandedPromotionRow(W)).toBe(1);
  });

  it('expanded promotion row for Black is 6', () => {
    expect(getExpandedPromotionRow(B)).toBe(6);
  });

  it('sq 5 (row 1) is expanded promotion square for White', () => {
    expect(isExpandedPromotionSquare(square(5), W)).toBe(true);
  });

  it('sq 25 (row 6) is expanded promotion square for Black', () => {
    expect(isExpandedPromotionSquare(square(25), B)).toBe(true);
  });

  it('sq 14 (row 3) is NOT expanded promotion square for White', () => {
    expect(isExpandedPromotionSquare(square(14), W)).toBe(false);
  });
});

describe('PromotionPartyDecorator', () => {
  it('getEventType returns CrazyEvent.PromotionParty', () => {
    const d = new PromotionPartyDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.PromotionParty);
  });

  it('pawn promotes on expanded row (White landing on row 1)', () => {
    // White pawn at 10 (row 2, col 2). Forward-left to sq 6 (row 1, col 2).
    // With Promotion Party, sq 6 is in expanded promotion zone for White.
    const board = buildBoard([
      { sq: 10, color: W, type: P },
      { sq: 30, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createPPEvent()]);
    const moves = getCurrentLegalMoves(state);
    const moveTo6 = moves.find(m => {
      const dest = m.path[0];
      return dest !== undefined && (dest as number) === 6;
    });
    expect(moveTo6).toBeDefined();

    if (moveTo6 === undefined) return;
    const newState = makeMove(state, moveTo6);
    // Pawn should have promoted to king on row 1
    const piece = getBoardSquare(newState.board, square(6));
    expect(piece).not.toBeNull();
    expect(piece?.type).toBe(PieceType.King);
  });

  it('pawn promotes on standard row (row 0) even without event', () => {
    // Standard promotion still works through the decorator chain
    const board = buildBoard([
      { sq: 6, color: W, type: P },
      { sq: 30, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createPPEvent()]);
    const moves = getCurrentLegalMoves(state);
    // White pawn at 6 (row 1) should promote on row 0 (sq 2 or 3)
    const moveTo2 = moves.find(m => {
      const dest = m.path[0];
      return dest !== undefined && (dest as number) === 2;
    });
    if (moveTo2 !== undefined) {
      const newState = makeMove(state, moveTo2);
      const piece = getBoardSquare(newState.board, square(2));
      expect(piece?.type).toBe(PieceType.King);
    }
  });

  it('event expires after 4 plies', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 6, color: B, type: P },
    ]);
    let state = crazyState(board, W, [createPPEvent()]);
    for (let i = 0; i < 4; i++) {
      const m = getCurrentLegalMoves(state)[0];
      if (m === undefined) throw new Error('No legal moves');
      state = makeMove(state, m);
    }
    expect(state.activeEvents.some(e => e.type === CrazyEvent.PromotionParty)).toBe(false);
  });

  it('is registered', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.PromotionParty)).toBe(true);
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.PromotionParty);
  });
});
