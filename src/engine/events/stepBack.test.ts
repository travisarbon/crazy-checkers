/**
 * Step-Back — comprehensive test suite (Event 8).
 */

import { describe, it, expect } from 'vitest';
import { StepBackDecorator, getAllDirectionJumpsForPawn } from './stepBack';
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
  Move,
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

function createSBEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.StepBack, triggeredBy, triggeredAtPly);
}

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  const first = moves[0];
  if (first === undefined) throw new Error('No legal moves');
  return first;
}

// ===========================================================================
// Unit Tests — getAllDirectionJumpsForPawn
// ===========================================================================

describe('getAllDirectionJumpsForPawn', () => {
  it('generates backward jump for White pawn', () => {
    // White pawn at 15 (row 3, col 4), Black pawn at 18 (row 4, col 3)
    // Backward-left jump: 15 → over 18 → 22 (row 5, col 2)
    const board = buildBoard([
      { sq: 15, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const jumps = getAllDirectionJumpsForPawn(board, square(15), W);
    const backwardJump = jumps.find(
      m => m.path.some(s => (s as number) === 22),
    );
    expect(backwardJump).toBeDefined();
  });

  it('generates forward jump normally', () => {
    // White pawn at 22 (row 5, col 2), Black pawn at 18 (row 4, col 3)
    // Forward-right jump: 22 → over 18 → 15 (row 3, col 4)
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const jumps = getAllDirectionJumpsForPawn(board, square(22), W);
    const forwardJump = jumps.find(m => m.path.some(s => (s as number) === 15));
    expect(forwardJump).toBeDefined();
  });

  it('mixes forward and backward in multi-jump chain', () => {
    // White pawn at 22, Black pawns at 18 and 19.
    // Forward: 22 over 18 to 15. Then backward: 15 over 19 to 22? No, 22 is starting square.
    // Actually let's try: 22 over 18 to 15, then 15 over 19 to 24 (backward-right).
    // sq 15 (row 3, col 4), backward-right = row 4, col 5 = sq 19 (row 4, col 4)?
    // sq 19 is row 4, col 4. Adjacent from 15 backward-right = row 4, col 5 -> need to check gridToSquare.
    // row 4, col 5: even row? No, row 4 is even. Even rows have playable squares at cols 1,3,5,7. col 5 is playable -> sq = 4*4 + (5-1)/2 + 1 = 16 + 2 + 1 = 19.
    // So sq 19 is at row 4, col 5. Jump target: row 5, col 6 = odd row, cols 0,2,4,6. col 6 -> sq = 5*4 + 6/2 + 1 = 20 + 3 + 1 = 24.
    // So the chain would be: 22 -> 15 (cap 18) -> 24 (cap 19).
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 19, color: B, type: P },
    ]);
    const jumps = getAllDirectionJumpsForPawn(board, square(22), W);
    const mixedChain = jumps.find(m => m.captured.length >= 2);
    expect(mixedChain).toBeDefined();
  });

  it('returns empty for non-pawn', () => {
    const board = buildBoard([
      { sq: 15, color: W, type: K },
      { sq: 18, color: B, type: P },
    ]);
    const jumps = getAllDirectionJumpsForPawn(board, square(15), W);
    expect(jumps).toHaveLength(0);
  });

  it('returns empty for empty square', () => {
    const board = buildBoard([]);
    const jumps = getAllDirectionJumpsForPawn(board, square(15), W);
    expect(jumps).toHaveLength(0);
  });

  it('promotion stop terminates chain', () => {
    // White pawn at 9 (row 2), Black pawn at 5 (row 1). Forward jump: 9 → 2 (row 0 = king row).
    // Chain should stop even if more captures are available from row 0.
    const board = buildBoard([
      { sq: 9, color: W, type: P },
      { sq: 5, color: B, type: P },
    ]);
    const jumps = getAllDirectionJumpsForPawn(board, square(9), W);
    // Jump should land on row 0 and stop
    for (const j of jumps) {
      const lastSq = j.path[j.path.length - 1] as number;
      // Should be row 0 (sq 1-4)
      expect(lastSq).toBeLessThanOrEqual(4);
    }
  });
});

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('StepBackDecorator', () => {
  it('getEventType returns CrazyEvent.StepBack', () => {
    const base = createAmericanRules();
    const decorator = new StepBackDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.StepBack);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new StepBackDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(StepBackDecorator);
  });

  it('backward capture available during active event', () => {
    // White pawn at 15, Black pawn at 18. Backward jump: 15 over 18 to 22.
    const board = buildBoard([
      { sq: 15, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createSBEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const backwardJumps = moves.filter(m =>
      m.captured.length > 0 && (m.from as number) === 15,
    );
    expect(backwardJumps.length).toBeGreaterThan(0);
    // Should include backward destination (22)
    expect(backwardJumps.some(m => m.path.some(s => (s as number) === 22))).toBe(true);
  });

  it('forward simple moves still work (no backward simple moves)', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createSBEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Should have forward simple moves only (no jumps available)
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.captured.length === 0)).toBe(true);
    // All moves should go forward (decreasing row for White)
    for (const m of moves) {
      expect((m.path[0] as number)).toBeLessThan(m.from as number);
    }
  });

  it('mandatory capture includes backward jumps', () => {
    // White pawn at 15 (row 3, col 4). Black pawn at 19 (row 4, col 4).
    // Backward-right from 15: adjacent = row 4, col 5 = sq 19? No.
    // Let me use a known backward jump: White pawn at 10 (row 2, col 2),
    // Black pawn at 14 (row 3, col 2). Backward-left from 10: row 3, col 1 = sq 13.
    // That's not 14. Backward-right from 10: row 3, col 3 = sq 14. Yes!
    // Jump target: row 4, col 4 = sq 19 (even row? No, row 4 is even -> cols 1,3,5,7 -> col 4 is not playable).
    // Hmm. Let me use a different setup.
    // White pawn at 11 (row 2, col 4). Black pawn at 15 (row 3, col 4).
    // Backward-right from 11: row 3, col 5 -> sq? Row 3 is odd -> cols 0,2,4,6 -> col 5 not playable.
    // Backward-left from 11: row 3, col 3 -> odd row -> col 3 not even, so not playable? Row 3 odd -> cols 0,2,4,6. col 3 not in set. Hmm.
    //
    // Use: White pawn at 14 (row 3, col 2). Black pawn at 17 (row 4, col 1).
    // Backward-left from 14: row 4, col 1 = sq 17 (even row, col 1 playable). Yes!
    // Jump target: row 5, col 0 = sq 21.
    // Also add White pawn at 22 (row 5, col 2) which can only make simple moves forward.
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 17, color: B, type: P },
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createSBEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Backward jump should be available → mandatory capture applies
    const jumps = moves.filter(m => m.captured.length > 0);
    expect(jumps.length).toBeGreaterThan(0);
    // If jumps exist, all returned moves should be jumps (mandatory capture)
    expect(moves.every(m => m.captured.length > 0)).toBe(true);
  });

  it('event expires after 2 rounds (4 plies)', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createSBEvent();
    let state = crazyStateWithBoard(board, W, [event]);

    for (let i = 0; i < 4; i++) {
      state = makeMove(state, firstMove(state));
    }

    expect(state.activeEvents.some(e => e.type === CrazyEvent.StepBack)).toBe(false);
  });

  it('king moves are unaffected', () => {
    // King already moves in all directions — Step-Back should not change anything
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 18, color: B, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createSBEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // King at 14 should be able to jump 18
    const kingJumps = moves.filter(
      m => m.captured.length > 0 && (m.from as number) === 14,
    );
    expect(kingJumps.length).toBeGreaterThan(0);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.StepBack)).toBe(true);
  });

  it('CrazyEvent.StepBack is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.StepBack);
  });
});
