/**
 * Demotion — comprehensive test suite (Event 25).
 */

import { describe, it, expect } from 'vitest';
import { DemotionDecorator } from './demotion';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves, getEffectiveBoard } from '../game';
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

function createDemEvent(triggeredBy: PieceColor = W): ActiveEvent {
  return createActiveEvent(CrazyEvent.Demotion, triggeredBy, 0);
}

describe('DemotionDecorator', () => {
  it('getEventType returns CrazyEvent.Demotion', () => {
    const d = new DemotionDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.Demotion);
  });

  it('all kings are demoted on onTurnStart via getEffectiveBoard', () => {
    // White king at 14, Black king at 3
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 3, color: B, type: K },
      { sq: 22, color: W, type: P },
      { sq: 30, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createDemEvent()]);
    const effective = getEffectiveBoard(state);

    // Both kings should now be pawns
    const piece14 = getBoardSquare(effective, square(14));
    expect(piece14).not.toBeNull();
    expect(piece14?.type).toBe(PieceType.Pawn);

    const piece3 = getBoardSquare(effective, square(3));
    expect(piece3).not.toBeNull();
    expect(piece3?.type).toBe(PieceType.Pawn);
  });

  it('demoted piece on promotion row does NOT re-promote on same ply', () => {
    // White king at sq 2 (row 0 = White's promotion row). After demotion,
    // it becomes a pawn on row 0. shouldPromote should suppress re-promotion.
    const board = buildBoard([
      { sq: 2, color: W, type: K },
      { sq: 22, color: W, type: P },
      { sq: 30, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createDemEvent()]);

    // After makeMove, the piece at sq 2 should be a pawn (demoted and suppressed)
    // First verify it appears as pawn on the effective board
    const effective = getEffectiveBoard(state);
    const piece2 = getBoardSquare(effective, square(2));
    expect(piece2?.type).toBe(PieceType.Pawn);

    // Make a move with a different piece (pawn at 22)
    const moves = getCurrentLegalMoves(state);
    const nonKingRowMove = moves.find(m => (m.from as number) === 22);
    if (nonKingRowMove !== undefined) {
      const newState = makeMove(state, nonKingRowMove);
      // The piece at sq 2 should still be a pawn (suppressed)
      const piece2After = getBoardSquare(newState.board, square(2));
      expect(piece2After?.type).toBe(PieceType.Pawn);
    }
  });

  it('event is instant (duration 0) — removed after ply', () => {
    // Duration 0 events are resolved immediately
    const event = createDemEvent();
    expect(event.remainingPlies).toBe(0);
  });

  it('no kings on board — no effect', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 6, color: B, type: P },
    ]);
    const state = crazyState(board, W, [createDemEvent()]);
    const effective = getEffectiveBoard(state);
    // Board unchanged
    const piece22 = getBoardSquare(effective, square(22));
    expect(piece22?.type).toBe(PieceType.Pawn);
  });

  it('is registered', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Demotion)).toBe(true);
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Demotion);
  });
});
