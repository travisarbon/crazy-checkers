/**
 * Marching Orders — comprehensive test suite (Event 10).
 */

import { describe, it, expect } from 'vitest';
import {
  MarchingOrdersDecorator,
  gridToExtSquare,
  extSquareToGrid,
  projectGridToBoard,
} from './marchingOrders';
import type { MarchingOrdersMetadata } from './marchingOrders';
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
} from '../types';
import type {
  ActiveEvent,
  BoardState,
  GameState,
  PlayerSetup,
} from '../types';
import { W, B, P, buildBoard } from '../test-utils';

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

function makeGrid(
  placements: Array<{ row: number; col: number; color: PieceColor; type: PieceType }>,
): (null | { color: PieceColor; type: PieceType })[] {
  const grid: (null | { color: PieceColor; type: PieceType })[] = new Array<null | { color: PieceColor; type: PieceType }>(64).fill(null);
  for (const { row, col, color, type } of placements) {
    grid[row * 8 + col] = { color, type };
  }
  return grid;
}

function createMOEvent(
  grid: readonly (null | { color: PieceColor; type: PieceType })[],
  applied = true,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.MarchingOrders, W, 0, {
    orthogonalGrid: grid,
    applied,
  });
}

// ===========================================================================
// Unit Tests — Extended Square Mapping
// ===========================================================================

describe('Extended Square Mapping', () => {
  it('dark squares (standard 1-32) map correctly', () => {
    // sq 1 = row 0, col 1 (dark square)
    expect(gridToExtSquare(0, 1)).toBe(1);
    // sq 32 = row 7, col 6 (dark square)
    expect(gridToExtSquare(7, 6)).toBe(32);
  });

  it('light squares map to 33-64 range', () => {
    // Light square at row 0, col 0
    const sq = gridToExtSquare(0, 0);
    expect(sq).toBeGreaterThan(32);
    expect(sq).toBeLessThanOrEqual(64);
  });

  it('extSquareToGrid inverts gridToExtSquare for dark squares', () => {
    for (let sq = 1; sq <= 32; sq++) {
      const { row, col } = extSquareToGrid(sq);
      expect(gridToExtSquare(row, col)).toBe(sq);
    }
  });

  it('extSquareToGrid inverts gridToExtSquare for light squares', () => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = gridToExtSquare(row, col);
        const grid = extSquareToGrid(sq);
        expect(grid.row).toBe(row);
        expect(grid.col).toBe(col);
      }
    }
  });

  it('64 unique extended squares cover all 64 grid positions', () => {
    const seen = new Set<number>();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        seen.add(gridToExtSquare(row, col));
      }
    }
    expect(seen.size).toBe(64);
  });
});

// ===========================================================================
// Unit Tests — Grid ↔ Board Projection
// ===========================================================================

describe('projectGridToBoard', () => {
  it('projects dark-square pieces to 32-element board', () => {
    const grid = makeGrid([
      { row: 0, col: 1, color: W, type: P }, // dark sq 1
      { row: 7, col: 6, color: B, type: P }, // dark sq 32
    ]);
    const board = projectGridToBoard(grid);
    expect(board).toHaveLength(32);
    expect(board[0]).toEqual({ color: W, type: PieceType.Pawn });
    expect(board[31]).toEqual({ color: B, type: PieceType.Pawn });
  });

  it('light-square pieces are invisible in 32-element board', () => {
    const grid = makeGrid([
      { row: 0, col: 0, color: W, type: P }, // light square
    ]);
    const board = projectGridToBoard(grid);
    // All 32 dark squares should be null since the piece is on a light square
    for (let i = 0; i < 32; i++) {
      expect(board[i]).toBeNull();
    }
  });
});

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('MarchingOrdersDecorator', () => {
  it('getEventType returns CrazyEvent.MarchingOrders', () => {
    const base = createAmericanRules();
    const decorator = new MarchingOrdersDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.MarchingOrders);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new MarchingOrdersDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(MarchingOrdersDecorator);
  });

  it('generates orthogonal simple moves (up/left/right for White pawn)', () => {
    const grid = makeGrid([
      { row: 4, col: 4, color: W, type: PieceType.Pawn },
      { row: 0, col: 0, color: B, type: PieceType.Pawn }, // keep opponent alive
    ]);
    const board = projectGridToBoard(grid);
    const event = createMOEvent(grid);
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // White pawn should have moves: up (3,4), left (4,3), right (4,5)
    expect(moves.length).toBeGreaterThanOrEqual(3);

    // All moves should be simple (no captures)
    expect(moves.every(m => m.captured.length === 0)).toBe(true);
  });

  it('generates orthogonal simple moves (down/left/right for Black pawn)', () => {
    const grid = makeGrid([
      { row: 4, col: 4, color: B, type: PieceType.Pawn },
      { row: 7, col: 7, color: W, type: PieceType.Pawn },
    ]);
    const board = projectGridToBoard(grid);
    const event = createMOEvent(grid);
    const state = crazyStateWithBoard(board, B, [event]);
    const moves = getCurrentLegalMoves(state);

    expect(moves.length).toBeGreaterThanOrEqual(3);
    expect(moves.every(m => m.captured.length === 0)).toBe(true);
  });

  it('king moves in all 4 orthogonal directions', () => {
    const grid = makeGrid([
      { row: 4, col: 4, color: W, type: PieceType.King },
      { row: 0, col: 0, color: B, type: PieceType.Pawn },
    ]);
    const board = projectGridToBoard(grid);
    const event = createMOEvent(grid);
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // King should have moves in 4 directions
    expect(moves.length).toBe(4);
  });

  it('orthogonal jump captures enemy piece', () => {
    // White pawn at (4,4), Black pawn at (3,4) — White jumps up over Black to (2,4)
    const grid = makeGrid([
      { row: 4, col: 4, color: W, type: PieceType.Pawn },
      { row: 3, col: 4, color: B, type: PieceType.Pawn },
    ]);
    const board = projectGridToBoard(grid);
    const event = createMOEvent(grid);
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const jumps = moves.filter(m => m.captured.length > 0);
    expect(jumps.length).toBeGreaterThan(0);
  });

  it('mandatory capture applies with orthogonal moves', () => {
    // White pawn at (4,4) with adjacent enemy at (3,4) and landing at (2,4) empty
    const grid = makeGrid([
      { row: 4, col: 4, color: W, type: PieceType.Pawn },
      { row: 3, col: 4, color: B, type: PieceType.Pawn },
    ]);
    const board = projectGridToBoard(grid);
    const event = createMOEvent(grid);
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // All returned moves should be jumps (mandatory capture)
    expect(moves.every(m => m.captured.length > 0)).toBe(true);
  });

  it('applyMove updates grid metadata', () => {
    const grid = makeGrid([
      { row: 4, col: 4, color: W, type: PieceType.Pawn },
      { row: 0, col: 0, color: B, type: PieceType.Pawn },
    ]);
    const board = projectGridToBoard(grid);
    const event = createMOEvent(grid);
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
    const move = moves[0];
    if (move === undefined) throw new Error('no move');
    const newState = makeMove(state, move);

    const moEvent = newState.activeEvents.find(e => e.type === CrazyEvent.MarchingOrders);
    expect(moEvent).toBeDefined();
    const metadata = moEvent?.metadata as unknown as MarchingOrdersMetadata | undefined;
    expect(metadata?.applied).toBe(true);
  });

  it('is a permanent event (remainingPlies === -1)', () => {
    const event = createActiveEvent(CrazyEvent.MarchingOrders, W, 0);
    expect(event.remainingPlies).toBe(-1);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.MarchingOrders)).toBe(true);
  });

  it('CrazyEvent.MarchingOrders is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.MarchingOrders);
  });

  it('metadata factory initializes 64-element grid from board', () => {
    const board = buildBoard([
      { sq: 1, color: W, type: P },
      { sq: 32, color: B, type: P },
    ]);
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.MarchingOrders);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('factory missing');
    const metadata = factory(board, W) as { orthogonalGrid: unknown[]; applied: boolean };
    expect(metadata.orthogonalGrid).toHaveLength(64);
    expect(metadata.applied).toBe(false);
  });
});
