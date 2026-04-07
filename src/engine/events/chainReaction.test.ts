/**
 * Chain Reaction — comprehensive test suite (Event 21).
 */

import { describe, it, expect } from 'vitest';
import { ChainReactionDecorator, cascadeCapture } from './chainReaction';
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
  PlayerSetup,
} from '../types';
import { W, B, P, buildBoard } from '../test-utils';
import { getBoardSquare } from '../board';

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

function createCREvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.ChainReaction, triggeredBy, triggeredAtPly);
}

// ===========================================================================
// Unit Tests — cascadeCapture
// ===========================================================================

describe('cascadeCapture', () => {
  it('removes diagonally adjacent pieces of target color', () => {
    // cascadeCapture does NOT remove seed squares — it only removes
    // adjacent same-color pieces found via BFS from the seed positions.
    // Seed at 14, adjacent Black pawn at 10 (diag adj) should be removed.
    const board = buildBoard([
      { sq: 14, color: B, type: P },
      { sq: 10, color: B, type: P },
      { sq: 22, color: W, type: P },
    ]);
    const result = cascadeCapture(board, [square(14)], PieceColor.Black);
    // Adjacent Black piece at 10 should be removed by cascade
    expect(getBoardSquare(result, square(10))).toBeNull();
    // White piece untouched
    expect(getBoardSquare(result, square(22))).not.toBeNull();
  });

  it('does not cascade through different-color pieces', () => {
    // Seed at 14 (Black). White at 10 blocks cascade to Black at 6.
    const board = buildBoard([
      { sq: 14, color: B, type: P },
      { sq: 10, color: W, type: P },
      { sq: 6, color: B, type: P },
    ]);
    const result = cascadeCapture(board, [square(14)], PieceColor.Black);
    expect(getBoardSquare(result, square(10))).not.toBeNull(); // White not affected
    expect(getBoardSquare(result, square(6))).not.toBeNull(); // Not reached — blocked by White
  });

  it('cascades recursively through chains of adjacent same-color pieces', () => {
    // BFS visits adjacent squares from seeds. Seed 22 visits adj of 22.
    // 18 is diag adj to 22 and is Black → removed, then visit adj of 18.
    // 14 is diag adj to 18 and is Black → removed, then visit adj of 14.
    // 10 is diag adj to 14 and is Black → removed.
    const board = buildBoard([
      { sq: 22, color: B, type: P },
      { sq: 18, color: B, type: P },
      { sq: 14, color: B, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const result = cascadeCapture(board, [square(22)], PieceColor.Black);
    // Adjacent chain should be removed
    expect(getBoardSquare(result, square(18))).toBeNull();
    expect(getBoardSquare(result, square(14))).toBeNull();
    expect(getBoardSquare(result, square(10))).toBeNull();
  });

  it('empty seed returns board unchanged', () => {
    const board = buildBoard([{ sq: 14, color: B, type: P }]);
    const result = cascadeCapture(board, [], PieceColor.Black);
    expect(getBoardSquare(result, square(14))).not.toBeNull();
  });
});

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('ChainReactionDecorator', () => {
  it('getEventType returns CrazyEvent.ChainReaction', () => {
    const base = createAmericanRules();
    const decorator = new ChainReactionDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.ChainReaction);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new ChainReactionDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(ChainReactionDecorator);
  });

  it('capture triggers cascade and removes event', () => {
    // White at 22 jumps Black at 18, landing at 15.
    // Black at 14 is diag adjacent to 18 — should be cascade-captured.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 14, color: B, type: P },
    ]);
    const event = createCREvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const jumpMove = moves.find(m => m.captured.length > 0);
    expect(jumpMove).toBeDefined();
    if (jumpMove === undefined) throw new Error('no jump');

    const newState = makeMove(state, jumpMove);

    // sq 18 was captured normally (or by cascade seed)
    // sq 14 should also be removed by cascade
    expect(getBoardSquare(newState.board, square(14))).toBeNull();

    // Event should be removed after detonation
    expect(newState.activeEvents.some(e => e.type === CrazyEvent.ChainReaction)).toBe(false);
  });

  it('is a condition-based event (remainingPlies === -1)', () => {
    const event = createActiveEvent(CrazyEvent.ChainReaction, W, 0);
    expect(event.remainingPlies).toBe(-1);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.ChainReaction)).toBe(true);
  });

  it('CrazyEvent.ChainReaction is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.ChainReaction);
  });
});
