/**
 * Sacrifice — comprehensive test suite (Event 38).
 */

import { describe, it, expect } from 'vitest';
import { SacrificeDecorator, getMostAdvancedPawnSquare } from './sacrifice';
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
  square,
} from '../types';
import type {
  ActiveEvent,
  BoardState,
  GameState,
  PlayerSetup,
} from '../types';
import { W, B, P, K, buildBoard } from '../test-utils';
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

function createSCEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.Sacrifice, triggeredBy, triggeredAtPly);
}

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('SacrificeDecorator', () => {
  it('getEventType returns CrazyEvent.Sacrifice', () => {
    const base = createAmericanRules();
    const decorator = new SacrificeDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.Sacrifice);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new SacrificeDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(SacrificeDecorator);
  });

  it('when opponent captures your piece, your most advanced pawn promotes to king', () => {
    // White pawn at 22 (row 5), Black pawn at 18 (row 4).
    // White jumps Black at 18, landing at 15 (row 3).
    // Black's piece is captured, so Black's most advanced pawn should promote.
    // Need Black pawns elsewhere: Black pawn at 9 (row 2) is Black's most advanced.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 9, color: B, type: P },  // Black pawn at row 2 (most advanced for Black = highest row)
      { sq: 12, color: B, type: P }, // Black pawn at row 2 (sq 12 = row 2, col 7)
    ]);
    const event = createSCEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const jumpMove = moves.find(m => m.captured.length > 0);
    expect(jumpMove).toBeDefined();
    if (jumpMove === undefined) throw new Error('no jump');

    const newState = makeMove(state, jumpMove);

    // Black's most advanced pawn should have been promoted.
    // Black moves toward row 7 so "most advanced" = highest row.
    // sq 9 = row 2, sq 12 = row 2. Tiebreaker: leftmost col.
    // sq 9 = row 2, col 0; sq 12 = row 2, col 7. So sq 9 wins tiebreaker.
    // But wait — Black advances toward row 7, so higher row = more advanced.
    // Both are row 2. sq 9 has col 0, sq 12 has col 7. sq 9 is leftmost → promoted.
    const promotedPiece = getBoardSquare(newState.board, square(9));
    expect(promotedPiece).not.toBeNull();
    if (promotedPiece === null) throw new Error('expected promotedPiece');
    expect(promotedPiece.color).toBe(PieceColor.Black);
    expect(promotedPiece.type).toBe(PieceType.King);
  });

  it('no-pawn edge case: if no pawns remain, nothing happens', () => {
    // White pawn at 22 captures Black pawn at 18.
    // Black has only kings remaining (no pawns to promote).
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 3, color: B, type: K },  // Black king, not a pawn
    ]);
    const event = createSCEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const jumpMove = moves.find(m => m.captured.length > 0);
    expect(jumpMove).toBeDefined();
    if (jumpMove === undefined) throw new Error('no jump');

    const newState = makeMove(state, jumpMove);

    // Black king at 3 should still be a king (nothing to promote)
    const kingPiece = getBoardSquare(newState.board, square(3));
    expect(kingPiece).not.toBeNull();
    if (kingPiece === null) throw new Error('expected kingPiece');
    expect(kingPiece.type).toBe(PieceType.King);
  });

  it('duration is 4 plies (2 rounds)', () => {
    const event = createSCEvent();
    expect(event.remainingPlies).toBe(4);
  });
});

// ===========================================================================
// getMostAdvancedPawnSquare Unit Tests
// ===========================================================================

describe('getMostAdvancedPawnSquare', () => {
  it('returns White pawn at lowest row (most advanced for White)', () => {
    // White pawns at sq 22 (row 5) and sq 10 (row 2). Row 2 < row 5, so sq 10 is most advanced.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 10, color: W, type: P },
    ]);
    const result = getMostAdvancedPawnSquare(board, W);
    expect(result).toBe(10);
  });

  it('returns Black pawn at highest row (most advanced for Black)', () => {
    // Black pawns at sq 5 (row 1) and sq 22 (row 5). Row 5 > row 1, so sq 22 is most advanced.
    const board = buildBoard([
      { sq: 5, color: B, type: P },
      { sq: 22, color: B, type: P },
    ]);
    const result = getMostAdvancedPawnSquare(board, B);
    expect(result).toBe(22);
  });

  it('uses leftmost column as tiebreaker for White', () => {
    // White pawns at sq 9 (row 2, col 0) and sq 12 (row 2, col 7).
    // Same row — tiebreaker is leftmost col → sq 9.
    const board = buildBoard([
      { sq: 9, color: W, type: P },
      { sq: 12, color: W, type: P },
    ]);
    const result = getMostAdvancedPawnSquare(board, W);
    expect(result).toBe(9);
  });

  it('uses leftmost column as tiebreaker for Black', () => {
    // Black pawns at sq 21 (row 5, col 0) and sq 24 (row 5, col 7).
    // Same row — tiebreaker is leftmost col → sq 21.
    const board = buildBoard([
      { sq: 21, color: B, type: P },
      { sq: 24, color: B, type: P },
    ]);
    const result = getMostAdvancedPawnSquare(board, B);
    expect(result).toBe(21);
  });

  it('returns null when no pawns exist (only kings)', () => {
    const board = buildBoard([
      { sq: 10, color: W, type: K },
      { sq: 22, color: W, type: K },
    ]);
    const result = getMostAdvancedPawnSquare(board, W);
    expect(result).toBeNull();
  });

  it('returns null when no pieces of that color exist', () => {
    const board = buildBoard([
      { sq: 10, color: B, type: P },
    ]);
    const result = getMostAdvancedPawnSquare(board, W);
    expect(result).toBeNull();
  });

  it('ignores kings and only considers pawns', () => {
    // White king at sq 5 (row 1, very advanced) and White pawn at sq 22 (row 5).
    // Should return sq 22 (the pawn), not sq 5 (the king).
    const board = buildBoard([
      { sq: 5, color: W, type: K },
      { sq: 22, color: W, type: P },
    ]);
    const result = getMostAdvancedPawnSquare(board, W);
    expect(result).toBe(22);
  });
});

// ===========================================================================
// Registration Tests
// ===========================================================================

describe('Sacrifice registration', () => {
  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Sacrifice)).toBe(true);
  });

  it('CrazyEvent.Sacrifice is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Sacrifice);
  });
});
