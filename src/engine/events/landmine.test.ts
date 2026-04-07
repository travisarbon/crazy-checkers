/**
 * Landmine — comprehensive test suite (Event 16).
 */

import { describe, it, expect } from 'vitest';
import { LandmineDecorator, LANDMINE_SQUARES } from './landmine';
import type { LandmineMetadata } from './landmine';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
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

function createLMEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
  metadata?: Record<string, unknown>,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.Landmine, triggeredBy, triggeredAtPly, metadata);
}

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('LandmineDecorator', () => {
  it('getEventType returns CrazyEvent.Landmine', () => {
    const base = createAmericanRules();
    const decorator = new LandmineDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.Landmine);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new LandmineDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(LandmineDecorator);
  });

  it('LANDMINE_SQUARES contains exactly 4 center squares (14, 15, 18, 19)', () => {
    expect(LANDMINE_SQUARES.size).toBe(4);
    expect(LANDMINE_SQUARES.has(14)).toBe(true);
    expect(LANDMINE_SQUARES.has(15)).toBe(true);
    expect(LANDMINE_SQUARES.has(18)).toBe(true);
    expect(LANDMINE_SQUARES.has(19)).toBe(true);
  });

  it('piece moving onto a mined square is destroyed', () => {
    // White pawn at sq 22 (r5,c2), moves forward-right to sq 18 (r4,c3) — a mined square.
    // No safe pieces in metadata → piece should be destroyed.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 29, color: B, type: P }, // Black piece to keep game going
    ]);
    const event = createLMEvent(W, 0, { safePieces: [] });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Find move to sq 18 (mined square)
    const moveToMine = moves.find(m => m.path[m.path.length - 1] === square(18));
    expect(moveToMine).toBeDefined();
    if (moveToMine === undefined) throw new Error('no move to mine');

    const newState = makeMove(state, moveToMine);

    // Piece should be destroyed (removed from board)
    const pieceAtMine = getBoardSquare(newState.board, square(18));
    expect(pieceAtMine).toBeNull();
  });

  it('grandfathered piece on center square is NOT destroyed', () => {
    // White pawn already on sq 18 at activation → safe.
    // White has another piece that can move, so we test that safe piece survives.
    const board = buildBoard([
      { sq: 18, color: W, type: P },
      { sq: 22, color: W, type: P },
      { sq: 29, color: B, type: P },
    ]);
    const safePieces = [{ square: 18, color: PieceColor.White, type: PieceType.Pawn }];
    const event = createLMEvent(W, 0, { safePieces });
    const state = crazyStateWithBoard(board, W, [event]);

    // Move a different piece (sq 22 → sq 17)
    const moves = getCurrentLegalMoves(state);
    const safeMove = moves.find(
      m => m.from === square(22) && m.path[m.path.length - 1] === square(17),
    );
    expect(safeMove).toBeDefined();
    if (safeMove === undefined) throw new Error('no safe move');

    const newState = makeMove(state, safeMove);

    // Grandfathered piece at sq 18 should still be there
    const pieceAt18 = getBoardSquare(newState.board, square(18));
    expect(pieceAt18).not.toBeNull();
    expect(pieceAt18?.color).toBe(PieceColor.White);
  });

  it('grandfathered piece loses safe status after moving off its square', () => {
    // White pawn on sq 18 (mined, safe). It moves off to sq 14 (also mined, no longer safe).
    // After moving, it should be destroyed at sq 14 because it lost its grandfathered status.
    const board = buildBoard([
      { sq: 18, color: W, type: P },
      { sq: 29, color: B, type: P },
    ]);
    const safePieces = [{ square: 18, color: PieceColor.White, type: PieceType.Pawn }];
    const event = createLMEvent(W, 0, { safePieces });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Move from 18 → 14 (both mined; sq 18 FL → sq 14)
    const moveOff = moves.find(
      m => m.from === square(18) && m.path[m.path.length - 1] === square(14),
    );
    expect(moveOff).toBeDefined();
    if (moveOff === undefined) throw new Error('no move off');

    const newState = makeMove(state, moveOff);

    // Piece moved to sq 14 (mined), but it's no longer safe → destroyed
    const pieceAt14 = getBoardSquare(newState.board, square(14));
    expect(pieceAt14).toBeNull();
  });

  it('metadata factory records pieces occupying center squares', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 19, color: B, type: P },
      { sq: 22, color: W, type: P }, // not on center
    ]);
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.Landmine);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('no factory');

    const metadata = factory(board, PieceColor.White) as unknown as LandmineMetadata;
    expect(metadata.safePieces).toHaveLength(2);
    expect(metadata.safePieces.some(sp => sp.square === 14)).toBe(true);
    expect(metadata.safePieces.some(sp => sp.square === 19)).toBe(true);
  });

  it('metadata factory returns empty safePieces when no pieces on center squares', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.Landmine);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('no factory');

    const metadata = factory(board, PieceColor.White) as unknown as LandmineMetadata;
    expect(metadata.safePieces).toHaveLength(0);
  });

  it('duration is 4 plies', () => {
    const event = createLMEvent();
    expect(event.remainingPlies).toBe(4);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Landmine)).toBe(true);
  });

  it('CrazyEvent.Landmine is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Landmine);
  });
});
