/**
 * Wormhole — comprehensive test suite (Event 24).
 */

import { describe, it, expect } from 'vitest';
import { WormholeDecorator, getWormholeExit } from './wormhole';
import type { WormholeMetadata } from './wormhole';
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

function createWormholeEvent(
  triggeredBy: PieceColor = W,
  metadata?: Readonly<Record<string, unknown>>,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.Wormhole, triggeredBy, 0, metadata);
}

describe('WormholeDecorator', () => {
  it('getEventType returns CrazyEvent.Wormhole', () => {
    const d = new WormholeDecorator(createAmericanRules());
    expect(d.getEventType()).toBe(CrazyEvent.Wormhole);
  });

  it('withInner returns a new WormholeDecorator', () => {
    const d = new WormholeDecorator(createAmericanRules());
    const d2 = d.withInner(createAmericanRules());
    expect(d2).toBeInstanceOf(WormholeDecorator);
    expect(d2).not.toBe(d);
  });

  it('getWormholeExit returns correct exit for entry square', () => {
    const meta: WormholeMetadata = {
      wormholes: [{ a: 10, b: 23 }, { a: 5, b: 28 }],
    };
    expect(getWormholeExit(10, meta)).toBe(23);
    expect(getWormholeExit(5, meta)).toBe(28);
  });

  it('getWormholeExit returns null for non-wormhole square', () => {
    const meta: WormholeMetadata = {
      wormholes: [{ a: 10, b: 23 }],
    };
    expect(getWormholeExit(15, meta)).toBeNull();
    expect(getWormholeExit(1, meta)).toBeNull();
  });

  it('wormholes are bidirectional within pairs', () => {
    const meta: WormholeMetadata = {
      wormholes: [{ a: 10, b: 23 }],
    };
    expect(getWormholeExit(10, meta)).toBe(23);
    expect(getWormholeExit(23, meta)).toBe(10);
  });

  it('teleports piece to exit when landing on wormhole entry', () => {
    // White pawn at sq 22 (row 5, col 2). It can move to sq 18 (row 4, col 3).
    // Set wormhole: entry 18, exit 11 (row 2, col 4). Sq 11 empty.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const wormholeMeta = { wormholes: [{ a: 18, b: 11 }] } as unknown as Readonly<Record<string, unknown>>;
    const state = crazyStateWithBoard(board, W, [createWormholeEvent(W, wormholeMeta)]);

    const moves = getCurrentLegalMoves(state);
    const moveTo18 = moves.find(m => m.path[m.path.length - 1] === square(18));
    expect(moveTo18).toBeDefined();

    if (moveTo18 === undefined) throw new Error('expected moveTo18');
    const newState = makeMove(state, moveTo18);
    // Piece should be teleported to sq 11
    const at11 = getBoardSquare(newState.board, square(11));
    expect(at11).not.toBeNull();
    expect(at11?.color).toBe(W);

    // Original landing should be empty
    const at18 = getBoardSquare(newState.board, square(18));
    expect(at18).toBeNull();
  });

  it('no teleport when exit square is occupied', () => {
    // White pawn at sq 22, wormhole 18->11, but sq 11 is occupied
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 11, color: B, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const wormholeMeta = { wormholes: [{ a: 18, b: 11 }] } as unknown as Readonly<Record<string, unknown>>;
    const state = crazyStateWithBoard(board, W, [createWormholeEvent(W, wormholeMeta)]);

    const moves = getCurrentLegalMoves(state);
    const moveTo18 = moves.find(m => m.path[m.path.length - 1] === square(18));
    if (moveTo18) {
      const newState = makeMove(state, moveTo18);
      // No teleport — piece stays at 18
      const at18 = getBoardSquare(newState.board, square(18));
      expect(at18).not.toBeNull();
      expect(at18?.color).toBe(W);
    }
  });

  it('event has duration of 4 plies', () => {
    const event = createWormholeEvent();
    expect(event.remainingPlies).toBe(4);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Wormhole)).toBe(true);
  });

  it('is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Wormhole);
  });

  it('metadata factory produces wormhole pairs from empty squares', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.Wormhole);
    expect(factory).toBeDefined();
    const board = buildBoard([
      { sq: 1, color: W, type: P },
      { sq: 2, color: B, type: P },
    ]);
    if (factory === undefined) throw new Error('expected factory');
    const meta = factory(board, W, () => 0.5) as unknown as WormholeMetadata;
    expect(meta.wormholes).toBeDefined();
    expect(meta.wormholes.length).toBeGreaterThanOrEqual(1);
    // Each pair has a and b
    for (const pair of meta.wormholes) {
      expect(pair.a).toBeGreaterThan(0);
      expect(pair.b).toBeGreaterThan(0);
      expect(pair.a).not.toBe(pair.b);
    }
  });
});
