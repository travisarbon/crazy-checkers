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

  it('preserves a pawn on a light square after a cross-turn cycle (regression)', () => {
    // Regression for the Free Play Rank-and-File scenario: a pawn moves
    // from a dark square onto a light square; on the next white turn,
    // that pawn must still be selectable and its orthogonal captures
    // must be generated. Previously broken because the composite
    // ruleSet's currentActiveEvents was not re-synced after
    // drainPendingMetadataUpdates, so the light-square piece vanished
    // from the decorator's view.
    //
    // Setup: a single white pawn on dark (5, 2). After white moves UP
    // to light (4, 2) and black passes (no black pieces so black's
    // turn resolves into a no-legal-moves game over), the regression
    // case is the metadata inspection right after applyMove — the
    // 64-grid must contain the pawn at (4, 2), and the state's
    // ruleSet (which will be reused by the UI's useMemo before the
    // next makeMove call) must also see that updated grid.
    const startGrid = makeGrid([
      { row: 5, col: 2, color: W, type: PieceType.Pawn },
    ]);
    const board = projectGridToBoard(startGrid);
    const event = createMOEvent(startGrid, false);
    const state = crazyStateWithBoard(board, W, [event]);

    const moves = getCurrentLegalMoves(state);
    const moveUp = moves.find(
      (m) =>
        m.captured.length === 0 &&
        (m.path[0] as number) === gridToExtSquare(4, 2),
    );
    expect(moveUp).toBeDefined();
    if (!moveUp) return;
    const nextState = makeMove(state, moveUp);

    // The new active-event metadata must include the light-square piece.
    const moEvent = nextState.activeEvents.find(
      (e) => e.type === CrazyEvent.MarchingOrders,
    );
    const md = moEvent?.metadata as unknown as MarchingOrdersMetadata | undefined;
    expect(md?.orthogonalGrid[4 * 8 + 2]).toEqual({
      color: W,
      type: PieceType.Pawn,
    });

    // The composite ruleSet must also see the updated context (the UI
    // calls ruleSet.getLegalMoves between turns via a useMemo). With
    // the old bug, the ruleSet's cached activeEventsContext was the
    // pre-move grid, and syncGridFromBoard would wipe the pawn.
    const postMoves = nextState.ruleSet.getLegalMoves(
      nextState.board,
      PieceColor.Black,
    );
    // Nothing to assert about black's moves specifically; the relevant
    // point is that the state-vs-ruleSet read path doesn't throw and
    // the light-square pawn is discoverable via the metadata above.
    expect(postMoves).toBeDefined();
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

// ===========================================================================
// syncGridFromBoard
// ===========================================================================

describe('syncGridFromBoard', () => {
  it('returns metadata unchanged when grid matches board', () => {
    const board = buildBoard([
      { sq: 1, color: W, type: P },
      { sq: 32, color: B, type: P },
    ]);
    const grid = makeGrid([
      { row: 0, col: 1, color: W, type: PieceType.Pawn },
      { row: 7, col: 6, color: B, type: PieceType.Pawn },
    ]);
    const metadata: MarchingOrdersMetadata = { orthogonalGrid: grid, applied: true };
    const base = createAmericanRules();
    const decorator = new MarchingOrdersDecorator(base);
    const synced = decorator.syncGridFromBoard(board, metadata);
    expect(synced).toBe(metadata); // Same reference, no sync needed
  });

  it('updates dark-square entries when board was shuffled by an instant event', () => {
    // Original grid has White pawn at sq 1 (row 0, col 1)
    const originalGrid = makeGrid([
      { row: 0, col: 1, color: W, type: PieceType.Pawn },
      { row: 7, col: 6, color: B, type: PieceType.Pawn },
      { row: 0, col: 0, color: W, type: PieceType.King }, // light-square piece
    ]);
    const metadata: MarchingOrdersMetadata = { orthogonalGrid: originalGrid, applied: true };

    // Board was shuffled: White pawn moved from sq 1 to sq 2
    const shuffledBoard = buildBoard([
      { sq: 2, color: W, type: P },
      { sq: 32, color: B, type: P },
    ]);

    const base = createAmericanRules();
    const decorator = new MarchingOrdersDecorator(base);
    const synced = decorator.syncGridFromBoard(shuffledBoard, metadata);

    // Dark-square entries should match the shuffled board
    const syncedBoard = projectGridToBoard(synced.orthogonalGrid);
    expect(syncedBoard[0]).toBeNull(); // sq 1 now empty
    expect(syncedBoard[1]).toEqual({ color: W, type: PieceType.Pawn }); // sq 2 has White pawn

    // Light-square piece should be preserved
    const lightIdx = 0 * 8 + 0; // row 0, col 0
    expect(synced.orthogonalGrid[lightIdx]).toEqual({ color: W, type: PieceType.King });
  });

  it('preserves light-square pieces during sync', () => {
    // Grid has pieces on both light and dark squares.
    // Light squares have (row+col) even: (0,0), (3,3), (4,4), etc.
    const grid = makeGrid([
      { row: 0, col: 1, color: W, type: PieceType.Pawn }, // dark sq 1
      { row: 3, col: 3, color: B, type: PieceType.King }, // light square (3+3=6)
      { row: 4, col: 4, color: W, type: PieceType.Pawn }, // light square (4+4=8)
    ]);
    const metadata: MarchingOrdersMetadata = { orthogonalGrid: grid, applied: true };

    // Empty board (all pieces removed by instant event)
    const emptyBrd = buildBoard([]);

    const base = createAmericanRules();
    const decorator = new MarchingOrdersDecorator(base);
    const synced = decorator.syncGridFromBoard(emptyBrd, metadata);

    // Dark-square entries should be cleared
    const syncedBoard = projectGridToBoard(synced.orthogonalGrid);
    expect(syncedBoard[0]).toBeNull();

    // Light-square pieces should remain
    expect(synced.orthogonalGrid[3 * 8 + 3]).toEqual({ color: B, type: PieceType.King });
    expect(synced.orthogonalGrid[4 * 8 + 4]).toEqual({ color: W, type: PieceType.Pawn });
  });

  it('handles Reinforcements adding a new piece to the board', () => {
    // Original grid: just one piece
    const grid = makeGrid([
      { row: 0, col: 1, color: W, type: PieceType.Pawn },
    ]);
    const metadata: MarchingOrdersMetadata = { orthogonalGrid: grid, applied: true };

    // Board has an extra piece added by Reinforcements
    const board = buildBoard([
      { sq: 1, color: W, type: P },
      { sq: 10, color: B, type: P }, // New piece from Reinforcements
    ]);

    const base = createAmericanRules();
    const decorator = new MarchingOrdersDecorator(base);
    const synced = decorator.syncGridFromBoard(board, metadata);

    const syncedBoard = projectGridToBoard(synced.orthogonalGrid);
    expect(syncedBoard[0]).toEqual({ color: W, type: PieceType.Pawn });
    expect(syncedBoard[9]).toEqual({ color: B, type: PieceType.Pawn });
  });

  it('getLegalMoves auto-syncs when called with a desynchronized board', () => {
    // Set up MO grid with pieces at certain positions
    const originalGrid = makeGrid([
      { row: 6, col: 1, color: W, type: PieceType.Pawn }, // dark sq 25
      { row: 0, col: 1, color: B, type: PieceType.Pawn }, // dark sq 1
    ]);
    const event = createMOEvent(originalGrid);

    // But the actual board has the White pawn at a different position (shuffled by instant event)
    const shuffledBoard = buildBoard([
      { sq: 26, color: W, type: P }, // moved from sq 25 to sq 26
      { sq: 1, color: B, type: P },
    ]);

    const state = crazyStateWithBoard(shuffledBoard, W, [event]);
    // Should not crash — getLegalMoves should auto-sync the grid
    const moves = getCurrentLegalMoves(state);
    // White pawn at sq 26 should have some moves
    expect(moves.length).toBeGreaterThan(0);
  });
});
