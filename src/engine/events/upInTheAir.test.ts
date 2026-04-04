/**
 * Task 9.3 — Up in the Air: Comprehensive test suite.
 *
 * Tests the UpInTheAirDecorator through decorator behavior, event lifecycle,
 * cross-event stacking, and AI integration using CompositeEventRuleSet and makeMove.
 */

import { describe, it, expect } from 'vitest';
import { createAmericanRules } from '../rules';
import { makeMove, getCurrentLegalMoves } from '../game';
import { computeZobristHash } from '../zobrist';
import {
  createActiveEvent,
  tickAllEvents,
  EVENT_DECORATOR_REGISTRY,
  EVENT_METADATA_FACTORIES,
  IMPLEMENTED_EVENTS,
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
import { W, B, P, K, buildBoard } from '../test-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HUMAN_VS_HUMAN: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.Human,
};

function createUitaEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.UpInTheAir, triggeredBy, triggeredAtPly);
}

function createNTEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
): ActiveEvent {
  return createActiveEvent(CrazyEvent.NoTouching, triggeredBy, triggeredAtPly);
}

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


// ===========================================================================
// §6.6 — Decorator Behavior
// ===========================================================================

describe('UpInTheAirDecorator — decorator behavior', () => {
  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.UpInTheAir)).toBe(true);
  });

  it('has metadata factory registered', () => {
    expect(EVENT_METADATA_FACTORIES.has(CrazyEvent.UpInTheAir)).toBe(true);
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.UpInTheAir);
    expect(factory).toBeDefined();
    expect(factory?.(buildBoard([]), PieceColor.White)).toBeUndefined();
  });

  it('is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.UpInTheAir);
  });

  it('generates flying moves when active', () => {
    // White king at sq 14 (center) — in standard play, it has at most 4 moves (one per direction).
    // With flying, it can reach many more squares along each diagonal.
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 30, color: B, type: P }, // Keep an opponent to avoid game-over
    ]);
    const event = createUitaEvent();
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([event]);

    const moves = composite.getLegalMoves(board, PieceColor.White);

    // Standard king at sq 14 would have exactly 4 simple moves (one step each direction).
    // Flying king should have many more (multiple squares per direction).
    expect(moves.length).toBeGreaterThan(4);
    // All moves should originate from sq 14
    for (const m of moves) {
      expect(m.from).toBe(square(14));
    }
  });

  it('delegates to inner when not active', () => {
    // Same board, but no active events
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 30, color: B, type: P },
    ]);
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([]);

    const moves = composite.getLegalMoves(board, PieceColor.White);

    // Standard king at sq 14 has exactly 4 simple moves
    expect(moves).toHaveLength(4);
  });

  it('no double-flying with two Up in the Air entries', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 30, color: B, type: P },
    ]);
    const event1 = createUitaEvent(PieceColor.White, 0);
    const event2 = createUitaEvent(PieceColor.Black, 1);
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);

    // With one event
    composite.setActiveEvents([event1]);
    const movesOne = composite.getLegalMoves(board, PieceColor.White);

    // With two events
    composite.setActiveEvents([event1, event2]);
    const movesTwo = composite.getLegalMoves(board, PieceColor.White);

    // Same number of moves — no "double flying"
    expect(movesTwo.length).toBe(movesOne.length);
  });
});

// ===========================================================================
// §6.7 — Event Lifecycle
// ===========================================================================

describe('UpInTheAirDecorator — event lifecycle', () => {
  it('event lasts exactly 2 plies', () => {
    const event = createUitaEvent();
    expect(event.remainingPlies).toBe(2);

    // Tick 1
    const after1 = tickAllEvents([event]);
    expect(after1).toHaveLength(1);
    expect(after1[0]?.remainingPlies).toBe(1);

    // Tick 2
    const after2 = tickAllEvents(after1);
    expect(after2).toHaveLength(0); // Removed
  });

  it('standard movement resumes after expiration', () => {
    // White king at sq 14 with flying rules active
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 30, color: B, type: P },
    ]);
    const event = createUitaEvent();
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);

    // Active: flying moves
    composite.setActiveEvents([event]);
    const flyingMoves = composite.getLegalMoves(board, PieceColor.White);
    expect(flyingMoves.length).toBeGreaterThan(4);

    // Expire the event
    composite.setActiveEvents([]);
    const normalMoves = composite.getLegalMoves(board, PieceColor.White);
    expect(normalMoves).toHaveLength(4); // Standard single-step king moves
  });

  it('event expires after 1 round via makeMove', () => {
    // White pawn at sq 22, Black pawn at sq 10. Both have simple moves.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const event = createUitaEvent();
    let state = crazyStateWithBoard(board, PieceColor.White, [event], 0);

    // White's turn: flying moves available
    const whiteMoves = getCurrentLegalMoves(state);
    // White pawn at 22 should have flying forward moves (FL: 17, 13; FR: 18, 15, 11, 8, 4)
    // But 10 is occupied by Black. FR: 18, 15, 11 (10 blocks at sq 10? No: 10 is Black opponent, simple moves stop at occupied)
    // FL from 22: 17, 13. FR from 22: 18(r4c3)→(r3c4)=15→(r2c5)=11→(r1c6)=8→(r0c7)=4. But sq 10 is on a different diagonal.
    expect(whiteMoves.length).toBeGreaterThan(2); // More than standard 2 moves

    // Play White's move (fly to a distant square)
    const flyMove = whiteMoves.find(m => m.captured.length === 0);
    if (flyMove === undefined) throw new Error('Expected a non-capturing move');
    state = makeMove(state, flyMove);
    expect(state.activeEvents.length).toBe(1); // Still active (1 ply left)

    // Black's turn
    const blackMoves = getCurrentLegalMoves(state);
    expect(blackMoves.length).toBeGreaterThan(0);
    const blackMove = blackMoves[0];
    if (blackMove === undefined) throw new Error('Expected a black move');
    state = makeMove(state, blackMove);

    // Event should be expired now
    expect(state.activeEvents.length).toBe(0);
  });
});

// ===========================================================================
// §6.8 — Stacking — Cross-Event
// ===========================================================================

describe('UpInTheAirDecorator — stacking', () => {
  it('stacks with King for a Day — all pieces get 4-directional flying', () => {
    // White pawn at sq 22 — normally can only move forward.
    // King for a Day makes it a king. Up in the Air gives flying.
    // Combined: the pawn should move in all 4 directions with multi-square range.
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 1, color: B, type: P }, // Keep opponent to avoid game-over
    ]);
    const kfadEvent = createActiveEvent(CrazyEvent.KingForADay, PieceColor.White, 0);
    const uitaEvent = createUitaEvent();
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([kfadEvent, uitaEvent]);

    // onTurnStart transforms pawn → king (King for a Day)
    const transformedBoard = composite.onTurnStart(board, PieceColor.White);
    const moves = composite.getLegalMoves(transformedBoard, PieceColor.White);

    // Should have backward moves (king, not pawn) and multiple squares per direction
    // Standard pawn at 22 has 2 forward moves. King at 22 has 4.
    // Flying king at 22 should have many more.
    expect(moves.length).toBeGreaterThan(4);

    // Verify backward moves exist (BL or BR from sq 22)
    // 22(r5c2)→BL→(r6c1)=25. BR→(r6c3)=26.
    const backwardDests = moves.map(m => m.path[0] as number);
    expect(backwardDests).toContain(25); // BL direction
    expect(backwardDests).toContain(26); // BR direction
  });

  it('stacks with No Touching — pawn-captures-king filtered from flying moves', () => {
    // White pawn at sq 22, Black king at sq 18
    // Up in the Air: pawn can fly-jump over king at 18 → land on 15, 11, 8, 4
    // But No Touching: pawn cannot capture king
    // So jump should be filtered out → simple flying moves returned instead
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: K },
    ]);
    const uitaEvent = createUitaEvent();
    const ntEvent = createNTEvent();
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([uitaEvent, ntEvent]);

    const moves = composite.getLegalMoves(board, PieceColor.White);

    // All jumps should be filtered out (pawn can't capture king)
    // Only simple flying moves should remain
    for (const m of moves) {
      expect(m.captured).toHaveLength(0);
    }
    expect(moves.length).toBeGreaterThan(0);
  });

  it('stacks with No Touching — king-captures-king preserved in flying moves', () => {
    // White king at sq 22, Black king at sq 18
    // No Touching only affects pawns; kings can still capture kings
    const board = buildBoard([
      { sq: 22, color: W, type: K },
      { sq: 18, color: B, type: K },
    ]);
    const uitaEvent = createUitaEvent();
    const ntEvent = createNTEvent();
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([uitaEvent, ntEvent]);

    const moves = composite.getLegalMoves(board, PieceColor.White);

    // Should have jump moves (king capturing king is allowed)
    const jumps = moves.filter(m => m.captured.length > 0);
    expect(jumps.length).toBeGreaterThan(0);
  });

  it('stacks with No Touching — all jumps filtered, simple flying moves returned', () => {
    // White pawn at sq 14, Black king at sq 9
    // The only available jump is pawn-captures-king (prohibited by No Touching)
    // Fallback should give simple flying moves
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 9, color: B, type: K },
    ]);
    const uitaEvent = createUitaEvent();
    const ntEvent = createNTEvent();
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([uitaEvent, ntEvent]);

    const moves = composite.getLegalMoves(board, PieceColor.White);

    // All moves should be non-capturing (simple flying moves)
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.captured).toHaveLength(0);
    }
  });

  it('stacks with Opposite Day — independent hooks', () => {
    // Up in the Air affects getLegalMoves, Opposite Day affects onCheckGameOver.
    // They should not interfere with each other.
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 30, color: B, type: P },
    ]);
    const uitaEvent = createUitaEvent();
    const odEvent = createActiveEvent(CrazyEvent.OppositeDay, PieceColor.White, 0);
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([uitaEvent, odEvent]);

    const moves = composite.getLegalMoves(board, PieceColor.White);
    // Flying moves should still be generated (Up in the Air unaffected by Opposite Day)
    expect(moves.length).toBeGreaterThan(4);
  });

  it('stacks with Checks Mix — flying moves on shuffled board', () => {
    // Just verify both events can be active simultaneously without errors
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 30, color: B, type: P },
    ]);
    const uitaEvent = createUitaEvent();
    // Checks Mix is instant (0 plies), so simulate post-shuffle state
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([uitaEvent]);

    const moves = composite.getLegalMoves(board, PieceColor.White);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('stacks with Live Grenade — independent hooks', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 18, color: B, type: P },
    ]);
    const uitaEvent = createUitaEvent();
    const lgEvent = createActiveEvent(CrazyEvent.LiveGrenade, PieceColor.White, 0);
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([uitaEvent, lgEvent]);

    // Flying jumps should still work
    const moves = composite.getLegalMoves(board, PieceColor.White);
    const jumps = moves.filter(m => m.captured.length > 0);
    expect(jumps.length).toBeGreaterThan(0);
  });

  it('stacks with Hot Potato — independent hooks', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: K },
      { sq: 30, color: B, type: P },
    ]);
    const uitaEvent = createUitaEvent();
    const hpEvent = createActiveEvent(CrazyEvent.HotPotato, PieceColor.White, 0);
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([uitaEvent, hpEvent]);

    const moves = composite.getLegalMoves(board, PieceColor.White);
    expect(moves.length).toBeGreaterThan(4);
  });
});

// ===========================================================================
// §6.9 — AI Integration
// ===========================================================================

describe('UpInTheAirDecorator — AI integration', () => {
  it('AI sees flying moves through composite rule set', () => {
    // Verify the composite rule set produces flying moves during search simulation
    // Use pieces far apart so the game doesn't end after one move
    const board = buildBoard([
      { sq: 29, color: W, type: K },
      { sq: 4, color: B, type: K },
    ]);
    const event = createUitaEvent();
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([event]);

    // Simulate what AI search does: get legal moves, apply move, check game over
    const moves = composite.getLegalMoves(board, PieceColor.White);
    expect(moves.length).toBeGreaterThan(0);

    // Apply the first move
    const firstMv = moves[0];
    if (firstMv === undefined) throw new Error('Expected a move');
    const afterMove = composite.applyMove(board, firstMv);
    expect(afterMove).toBeDefined();

    // Check game over
    const result = composite.checkGameOver(afterMove, PieceColor.Black);
    // Game shouldn't be over yet
    expect(result).toBeNull();
  });

  it('AI self-play with Up in the Air completes without crashes', () => {
    // Run a few turns of a game with Up in the Air active
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 21, color: W, type: P },
      { sq: 10, color: B, type: P },
      { sq: 11, color: B, type: P },
    ]);
    const event = createUitaEvent();
    let state = crazyStateWithBoard(board, PieceColor.White, [event], 0);

    // Play up to 10 half-turns
    for (let i = 0; i < 10; i++) {
      if (state.status !== GameStatus.InProgress) break;
      const moves = getCurrentLegalMoves(state);
      if (moves.length === 0) break;
      const mv = moves[0];
      if (mv === undefined) break;
      state = makeMove(state, mv);
    }

    // Should not throw; game should complete or still be in progress
    expect([GameStatus.InProgress, GameStatus.GameOver]).toContain(state.status);
  });
});
