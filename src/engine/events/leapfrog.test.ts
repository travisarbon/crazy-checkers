/**
 * Leapfrog — comprehensive test suite (Event 17).
 */

import { describe, it, expect } from 'vitest';
import { LeapfrogDecorator, getLeapfrogJumpChains } from './leapfrog';
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

function createLFEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.Leapfrog, triggeredBy, triggeredAtPly);
}

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('LeapfrogDecorator', () => {
  it('getEventType returns CrazyEvent.Leapfrog', () => {
    const base = createAmericanRules();
    const decorator = new LeapfrogDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.Leapfrog);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new LeapfrogDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(LeapfrogDecorator);
  });

  it('friendly jump over adjacent friendly lands on empty square', () => {
    // White pawn at sq 22 (r5,c2), friendly at sq 18 (r4,c3), empty at sq 15 (r3,c4).
    // Leapfrog should allow jumping over friendly to sq 15.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 5, color: B, type: P },
    ]);
    const event = createLFEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const leapMove = moves.find(
      m => (m.from as number) === 22 && m.path.some(s => (s as number) === 15),
    );
    expect(leapMove).toBeDefined();
  });

  it('captured array does NOT include friendly piece (non-capturing jump)', () => {
    // Same setup: jump from 22 over friendly at 18 to 15.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 5, color: B, type: P },
    ]);
    const event = createLFEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    const leapMove = moves.find(
      m => (m.from as number) === 22 && m.path.some(s => (s as number) === 15),
    );
    expect(leapMove).toBeDefined();
    // Friendly piece at 18 should NOT be in captured array
    expect(leapMove?.captured.some(s => (s as number) === 18)).toBe(false);
    expect(leapMove?.captured).toHaveLength(0);
  });

  it('mandatory capture: enemy jumps take priority over pure leapfrogs', () => {
    // White pawn at sq 22 (r5,c2).
    // Enemy Black at sq 18 (r4,c3) — can capture, jumping to sq 15 (r3,c4).
    // Friendly at sq 17 (r4,c1) — could leapfrog to sq 13 (r3,c0).
    // Mandatory capture means only capture moves should be available.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 17, color: W, type: P },
      { sq: 5, color: B, type: P },
    ]);
    const event = createLFEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // All moves should include at least one capture
    for (const m of moves) {
      expect(m.captured.length).toBeGreaterThan(0);
    }
  });

  it('pure leapfrogs available when no enemy captures exist', () => {
    // White pawn at sq 22, friendly at sq 18, no enemies in jumping range.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 5, color: B, type: P }, // far away enemy
    ]);
    const event = createLFEvent();
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Should include leapfrog from 22 to 15
    const leapMove = moves.find(
      m => (m.from as number) === 22 && m.path.some(s => (s as number) === 15),
    );
    expect(leapMove).toBeDefined();
    expect(leapMove?.captured).toHaveLength(0);
  });

  it('duration is 2 plies', () => {
    const event = createLFEvent();
    expect(event.remainingPlies).toBe(2);
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Leapfrog)).toBe(true);
  });

  it('CrazyEvent.Leapfrog is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Leapfrog);
  });

  it('no metadata needed — factory returns undefined', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.Leapfrog);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('no factory');

    const board = buildBoard([{ sq: 22, color: W, type: P }]);
    expect(factory(board, PieceColor.White)).toBeUndefined();
  });
});

// ===========================================================================
// getLeapfrogJumpChains unit tests
// ===========================================================================

describe('getLeapfrogJumpChains', () => {
  it('returns chain for friendly leapfrog', () => {
    // White pawn at sq 22, friendly at sq 18, empty at sq 15
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
    ]);
    const chains = getLeapfrogJumpChains(board, square(22), PieceColor.White, PieceType.Pawn);
    const chainTo15 = chains.find(c => c.path.some(s => (s as number) === 15));
    expect(chainTo15).toBeDefined();
    // Friendly piece should NOT be captured
    expect(chainTo15?.captured).toHaveLength(0);
  });

  it('returns chain for enemy capture', () => {
    // White pawn at sq 22, enemy at sq 18, empty at sq 15
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
    ]);
    const chains = getLeapfrogJumpChains(board, square(22), PieceColor.White, PieceType.Pawn);
    const captureChain = chains.find(c => c.captured.length > 0);
    expect(captureChain).toBeDefined();
    expect(captureChain?.captured.some(s => (s as number) === 18)).toBe(true);
  });

  it('returns empty when no jumps possible', () => {
    // White pawn at sq 22, no adjacent pieces to jump over
    const board = buildBoard([
      { sq: 22, color: W, type: P },
    ]);
    const chains = getLeapfrogJumpChains(board, square(22), PieceColor.White, PieceType.Pawn);
    expect(chains).toHaveLength(0);
  });

  it('chains friendly leapfrog followed by enemy capture', () => {
    // White pawn at sq 22 (r5,c2)
    // Friendly white at sq 18 (r4,c3) — ForwardRight adjacent
    // Landing at sq 15 (r3,c4) — empty
    // Enemy black at sq 11 (r2,c5) — ForwardRight from sq 15
    // Landing at sq 8 (r1,c6) — empty
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 11, color: B, type: P },
    ]);
    const chains = getLeapfrogJumpChains(board, square(22), PieceColor.White, PieceType.Pawn);
    // Should find a chain: 22 → 15 (leapfrog friendly 18) → 8 (capture enemy 11)
    const mixedChain = chains.find(
      c => c.captured.length > 0 && c.path.length === 2,
    );
    expect(mixedChain).toBeDefined();
    expect(mixedChain?.path.map(s => s as number)).toEqual([15, 8]);
    expect(mixedChain?.captured.map(s => s as number)).toEqual([11]);
  });

  it('does not jump when landing square is occupied', () => {
    // White pawn at sq 22, friendly at sq 18, but sq 15 is occupied
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: W, type: P },
      { sq: 15, color: B, type: P },
    ]);
    const chains = getLeapfrogJumpChains(board, square(22), PieceColor.White, PieceType.Pawn);
    // Should not have a pure leapfrog to 15 (blocked)
    // But might have a capture chain if enemy at 15 is jumpable from 18. Check:
    // From 18 (r4,c3), ForwardRight → adjacent=15(r3,c4), jump target=11(r2,c5).
    // But pawn at 22 jumps to 15, then from 15 the chain can jump over 11? No, 15 is occupied.
    // Actually the initial jump from 22 over 18 to 15 can't land because 15 is occupied.
    const friendlyLeap = chains.find(
      c => c.captured.length === 0 && c.path.some(s => (s as number) === 15),
    );
    expect(friendlyLeap).toBeUndefined();
  });
});
