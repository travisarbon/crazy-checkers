/**
 * Ghost Walk — comprehensive test suite (Event 15).
 */

import { describe, it, expect } from 'vitest';
import { GhostWalkDecorator, getGhostWalkMoves } from './ghostWalk';
import { createAmericanRules } from '../rules';
import { getCurrentLegalMoves } from '../game';
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
import { W, B, P, K, buildBoard } from '../test-utils';

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

function createGWEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.GhostWalk, triggeredBy, triggeredAtPly);
}

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('GhostWalkDecorator', () => {
  it('getEventType returns CrazyEvent.GhostWalk', () => {
    const base = createAmericanRules();
    const decorator = new GhostWalkDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.GhostWalk);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new GhostWalkDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(GhostWalkDecorator);
  });

  it('pawn phases through adjacent friendly to empty square beyond', () => {
    // White pawn at sq 22 (r5,c2), friendly White pawn at sq 18 (r4,c3).
    // Ghost walk should allow phasing through to sq 15 (r3,c4).
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 5, color: B, type: P }, // keep game alive
    ]);
    const event = createGWEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Should have a move from 22 to 15 (ghost walk through 18)
    const ghostMove = moves.find(
      m => (m.from as number) === 22 && (m.path[m.path.length - 1] as number) === 15,
    );
    expect(ghostMove).toBeDefined();
    expect(ghostMove?.captured).toHaveLength(0);
  });

  it('king phases through multiple consecutive friendlies', () => {
    // White king at sq 26 (r6,c3), friendly at sq 22 (r5,c2), friendly at sq 17 (r4,c1).
    // King should phase through both to sq 13 (r3,c0).
    const board = buildBoard([
      { sq: 26, color: W, type: K },
      { sq: 22, color: W, type: P },
      { sq: 17, color: W, type: P },
      { sq: 5, color: B, type: P },
    ]);
    const event = createGWEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Should have a ghost walk from 26 to 13
    const ghostMove = moves.find(
      m => (m.from as number) === 26 && (m.path[m.path.length - 1] as number) === 13,
    );
    expect(ghostMove).toBeDefined();
  });

  it('ghost walk suppressed when captures are available (mandatory capture)', () => {
    // White pawn at sq 22, enemy Black at sq 18 (can capture), friendly at sq 17.
    // Jump from 22 over 18 to 15 is a capture. Ghost walk from 22 through 17 to 13
    // should NOT appear because mandatory capture applies.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 17, color: W, type: P },
      { sq: 5, color: B, type: P },
    ]);
    const event = createGWEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // All moves should be captures
    const nonCaptures = moves.filter(m => m.captured.length === 0);
    const captures = moves.filter(m => m.captured.length > 0);
    expect(captures.length).toBeGreaterThan(0);
    // Ghost walk simple moves should be suppressed
    const ghostWalkTo13 = nonCaptures.find(
      m => (m.from as number) === 22 && (m.path[m.path.length - 1] as number) === 13,
    );
    expect(ghostWalkTo13).toBeUndefined();
  });

  it('no phasing through enemy pieces', () => {
    // White pawn at sq 22, Black pawn at sq 18 blocking the diagonal.
    // Without a jump (no empty landing for jump), ghost walk should NOT allow phasing.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 15, color: B, type: P }, // blocks jump landing too
      { sq: 5, color: B, type: P },
    ]);
    const event = createGWEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // No ghost walk through enemy at 18
    const ghostThrough18 = moves.find(
      m =>
        (m.from as number) === 22 &&
        m.captured.length === 0 &&
        (m.path[m.path.length - 1] as number) === 15,
    );
    expect(ghostThrough18).toBeUndefined();
  });

  it('duration is 2 plies', () => {
    const event = createGWEvent();
    expect(event.remainingPlies).toBe(2);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.GhostWalk)).toBe(true);
  });

  it('CrazyEvent.GhostWalk is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.GhostWalk);
  });

  it('no metadata needed — factory returns undefined', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.GhostWalk);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('no factory');

    const board = buildBoard([{ sq: 22, color: W, type: P }]);
    expect(factory(board, PieceColor.White)).toBeUndefined();
  });
});

// ===========================================================================
// getGhostWalkMoves unit tests
// ===========================================================================

describe('getGhostWalkMoves', () => {
  it('returns ghost walk move when friendly adjacent and empty beyond', () => {
    // White pawn at sq 22, friendly at sq 18, empty at sq 15
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
    ]);
    const moves = getGhostWalkMoves(board, square(22), PieceColor.White, PieceType.Pawn);
    const moveTo15 = moves.find(m => (m.path[0] as number) === 15);
    expect(moveTo15).toBeDefined();
    expect(moveTo15?.captured).toHaveLength(0);
  });

  it('does not return move when phasing through enemy piece', () => {
    // White pawn at sq 22, enemy at sq 18, empty at sq 15
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const moves = getGhostWalkMoves(board, square(22), PieceColor.White, PieceType.Pawn);
    expect(moves).toHaveLength(0);
  });

  it('returns empty when adjacent square is empty (no ghost walk needed)', () => {
    // White pawn at sq 22, nothing at sq 18 — normal move, not ghost walk
    const board = buildBoard([
      { sq: 22, color: W, type: P },
    ]);
    const moves = getGhostWalkMoves(board, square(22), PieceColor.White, PieceType.Pawn);
    expect(moves).toHaveLength(0);
  });

  it('does not return move when square beyond friendly is also occupied', () => {
    // White pawn at sq 22, friendly at sq 18, another piece at sq 15 (blocked)
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 15, color: B, type: P },
    ]);
    const moves = getGhostWalkMoves(board, square(22), PieceColor.White, PieceType.Pawn);
    // The forward-right direction (22→18→15) is blocked. Check forward-left too (22→17).
    const moveTo15 = moves.find(m => (m.path[0] as number) === 15);
    expect(moveTo15).toBeUndefined();
  });
});
