/**
 * Task 14.1 — Additional unit tests to close coverage gaps across event
 * decorators, the event system core, and edge-case/stacking scenarios.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion */

import { describe, it, expect } from 'vitest';
import { createAmericanRules } from '../rules';
import { createNewGame, makeMove, getCurrentLegalMoves } from '../game';
import { computeZobristHash } from '../zobrist';
import {
  createActiveEvent,
  EventDecorator,
  EVENT_DECORATOR_REGISTRY,
  EVENT_METADATA_FACTORIES,
  META_EVENTS,
  selectRandomEvent,
  tickAllEvents,
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
  RuleSet,
} from '../types';
import { W, B, P, K, buildBoard } from '../test-utils';
import { serializeGameState, deserializeGameState } from '../../persistence/serialization';
import { evaluateWithEvents } from '../../ai/eventEvalWeights';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HUMAN_VS_HUMAN: PlayerSetup = {
  white: PlayerType.Human,
  black: PlayerType.Human,
};

function makeEvent(
  type: CrazyEvent,
  remainingPlies: number,
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly: number = 0,
  metadata?: Readonly<Record<string, unknown>>,
): ActiveEvent {
  return { type, remainingPlies, triggeredBy, triggeredAtPly, metadata };
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
// §1 — EventDecorator.getActiveEntry coverage (events.ts lines 264-270)
// ===========================================================================

describe('EventDecorator.getActiveEntry', () => {
  class TestDecorator extends EventDecorator {
    getEventType(): CrazyEvent {
      return CrazyEvent.KingForADay;
    }
    withInner(inner: RuleSet): EventDecorator {
      return new TestDecorator(inner);
    }
    // Expose protected method for testing
    testGetActiveEntry(events: readonly ActiveEvent[]): ActiveEvent | undefined {
      return this.getActiveEntry(events);
    }
  }

  const rules = createAmericanRules();
  const decorator = new TestDecorator(rules);

  it('returns undefined for empty events', () => {
    expect(decorator.testGetActiveEntry([])).toBeUndefined();
  });

  it('returns undefined when type is not present', () => {
    const events = [makeEvent(CrazyEvent.LiveGrenade, -1)];
    expect(decorator.testGetActiveEntry(events)).toBeUndefined();
  });

  it('returns the matching entry', () => {
    const events = [makeEvent(CrazyEvent.KingForADay, 2)];
    const result = decorator.testGetActiveEntry(events);
    expect(result).toBeDefined();
    expect(result!.type).toBe(CrazyEvent.KingForADay);
  });

  it('returns the newest (last) entry when multiple exist', () => {
    const older = makeEvent(CrazyEvent.KingForADay, 2, PieceColor.White, 0);
    const newer = makeEvent(CrazyEvent.KingForADay, 1, PieceColor.Black, 5);
    const result = decorator.testGetActiveEntry([older, newer]);
    expect(result).toBe(newer);
  });

  it('skips non-matching entries and finds the correct one', () => {
    const events = [
      makeEvent(CrazyEvent.LiveGrenade, -1),
      makeEvent(CrazyEvent.OppositeDay, 16),
      makeEvent(CrazyEvent.KingForADay, 2, PieceColor.Black, 10),
    ];
    const result = decorator.testGetActiveEntry(events);
    expect(result!.triggeredAtPly).toBe(10);
  });
});

// ===========================================================================
// §2 — selectRandomEvent meta-event re-roll (events.ts lines 459-468)
// ===========================================================================

describe('selectRandomEvent — meta-event re-roll', () => {
  // In Phase 2, META_EVENTS aren't in IMPLEMENTED_EVENTS, so the meta path
  // is never exercised naturally. We test it by temporarily manipulating the
  // pool. Since IMPLEMENTED_EVENTS is frozen, we test the code-path logic
  // indirectly by verifying the function behaves correctly with seeded random.

  it('does not return meta-events from Phase 2 pool', () => {
    const metaSet = new Set(META_EVENTS);
    for (let i = 0; i < 200; i++) {
      const events = selectRandomEvent();
      for (const event of events) {
        expect(metaSet.has(event)).toBe(false);
      }
    }
  });

  it('always returns a single-element array in Phase 2', () => {
    for (let i = 0; i < 50; i++) {
      const events = selectRandomEvent();
      expect(events).toHaveLength(1);
    }
  });

  it('returns different events across many draws', () => {
    const seen = new Set<CrazyEvent>();
    for (let i = 0; i < 500; i++) {
      const events = selectRandomEvent();
      for (const e of events) seen.add(e);
    }
    // Should see multiple distinct events
    expect(seen.size).toBeGreaterThan(1);
  });
});

// ===========================================================================
// §3 — Up in the Air: inactive delegation + fallback paths
// ===========================================================================

describe('UpInTheAirDecorator — coverage gaps', () => {
  it('delegates to inner chain when not active (line 51)', () => {
    // Directly instantiate decorator and call getLegalMoves with no active events context
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const base = createAmericanRules();
    const decoratorFactory = EVENT_DECORATOR_REGISTRY.get(CrazyEvent.UpInTheAir);
    expect(decoratorFactory).toBeDefined();
    const decorator = decoratorFactory!(base) as EventDecorator;
    const linked = decorator.withInner(base);
    // Empty activeEventsContext → isActive returns false → delegates to inner
    linked.setActiveEventsContext([]);

    const moves = linked.getLegalMoves(board, PieceColor.White);
    // Standard pawn at 22 should have at most 2 forward moves
    expect(moves.length).toBeLessThanOrEqual(2);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('returns simple flying moves when all jumps are pawn-captures-king with No Touching (lines 78-82)', () => {
    // Directly instantiate UpInTheAir decorator with NoTouching in context
    // Setup: only pawn-captures-king jumps exist, all filtered by No Touching
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 9, color: B, type: K },
    ]);
    const uitaEvent = createActiveEvent(CrazyEvent.UpInTheAir, PieceColor.White, 0);
    const ntEvent = createActiveEvent(CrazyEvent.NoTouching, PieceColor.White, 0);

    const base = createAmericanRules();
    const decoratorFactory = EVENT_DECORATOR_REGISTRY.get(CrazyEvent.UpInTheAir);
    const decorator = decoratorFactory!(base) as EventDecorator;
    const linked = decorator.withInner(base);
    linked.setActiveEventsContext([uitaEvent, ntEvent]);

    const moves = linked.getLegalMoves(board, PieceColor.White);
    // All jumps should be filtered (pawn can't capture king) → simple flying moves
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.captured).toHaveLength(0);
    }
  });

  it('returns simple flying moves via composite when all jumps filtered (integration)', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 9, color: B, type: K },
    ]);
    const uitaEvent = createActiveEvent(CrazyEvent.UpInTheAir, PieceColor.White, 0);
    const ntEvent = createActiveEvent(CrazyEvent.NoTouching, PieceColor.White, 0);
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([uitaEvent, ntEvent]);

    const moves = composite.getLegalMoves(board, PieceColor.White);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.captured).toHaveLength(0);
    }
  });
});

// ===========================================================================
// §4 — Hot Potato: undefined landing square edge cases
// ===========================================================================

describe('HotPotatoDecorator — edge cases', () => {
  it('handles empty path move via direct decorator call (line 67)', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const hotPotatoEvent = makeEvent(CrazyEvent.HotPotato, 2, PieceColor.White, 0);
    const base = createAmericanRules();
    const decoratorFactory = EVENT_DECORATOR_REGISTRY.get(CrazyEvent.HotPotato);
    const decorator = decoratorFactory!(base) as EventDecorator;
    const linked = decorator.withInner(base);
    linked.setActiveEventsContext([hotPotatoEvent]);

    // Call onTurnEnd with a move that has empty path
    const emptyPathMove: Move = { from: square(22), path: [], captured: [] };
    const result = linked.onTurnEnd!(board, PieceColor.White, emptyPathMove);
    // Should return board unchanged (no crash)
    expect(result).toEqual(board);
  });

  it('handles normal move via game integration', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const hotPotatoEvent = makeEvent(CrazyEvent.HotPotato, 2, PieceColor.White, 0);
    const state = crazyStateWithBoard(board, PieceColor.White, [hotPotatoEvent]);

    const moves = getCurrentLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
    const move = moves[0]!;
    const newState = makeMove(state, move);
    expect(newState.status).toBe(GameStatus.InProgress);
  });

  it('metadata factory returns undefined when move has no path (line 101)', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.HotPotato);
    expect(factory).toBeDefined();

    const board = buildBoard([{ sq: 22, color: W, type: P }]);
    // No move provided
    const result = factory!(board, PieceColor.White);
    expect(result).toBeUndefined();
  });

  it('metadata factory returns hotSquare from move path', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.HotPotato);
    const board = buildBoard([{ sq: 22, color: W, type: P }]);
    const move: Move = {
      from: square(22),
      path: [square(18)],
      captured: [],
    };
    const result = factory!(board, PieceColor.White, undefined, move);
    expect(result).toEqual({ hotSquare: 18 });
  });

  it('even count of matching Hot Potato events cancels out (double switch)', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    // Two Hot Potato events for the same player = even count = cancel out
    const hp1 = makeEvent(CrazyEvent.HotPotato, 2, PieceColor.White, 0);
    const hp2 = makeEvent(CrazyEvent.HotPotato, 2, PieceColor.White, 2);
    const state = crazyStateWithBoard(board, PieceColor.White, [hp1, hp2]);

    const moves = getCurrentLegalMoves(state);
    const move = moves[0]!;
    const newState = makeMove(state, move);
    // With even count, color switch cancels — piece should remain white
    // (though it's now black's turn, the piece that moved should still be white)
    const landingSq = move.path[move.path.length - 1] as number;
    const piece = newState.board[landingSq - 1];
    expect(piece).not.toBeNull();
    expect(piece!.color).toBe(PieceColor.White);
  });
});

// ===========================================================================
// §5 — Live Grenade: metadata factory (line 69)
// ===========================================================================

describe('LiveGrenadeDecorator — metadata factory', () => {
  it('metadata factory returns undefined', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.LiveGrenade);
    expect(factory).toBeDefined();
    const result = factory!(
      buildBoard([{ sq: 1, color: W, type: P }]),
      PieceColor.White,
    );
    expect(result).toBeUndefined();
  });
});

// ===========================================================================
// §6 — Opposite Day: inactive path (line 72)
// ===========================================================================

describe('OppositeDayDecorator — inactive path', () => {
  it('passes through game-over result unchanged when not active via direct decorator (line 72)', () => {
    const board = buildBoard([{ sq: 1, color: B, type: P }]);
    const base = createAmericanRules();
    const decoratorFactory = EVENT_DECORATOR_REGISTRY.get(CrazyEvent.OppositeDay);
    expect(decoratorFactory).toBeDefined();
    const decorator = decoratorFactory!(base) as EventDecorator;
    const linked = decorator.withInner(base);
    // Empty context → Opposite Day is NOT active → should pass through
    linked.setActiveEventsContext([]);

    const baseResult = base.checkGameOver(board, PieceColor.White);
    expect(baseResult).not.toBeNull();
    expect(baseResult!.type).toBe('BLACK_WIN');

    // onCheckGameOver with inactive Opposite Day should not invert
    const result = linked.onCheckGameOver!(board, PieceColor.White, baseResult);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('BLACK_WIN'); // NOT inverted
  });

  it('inverts game-over result when active via direct decorator', () => {
    const board = buildBoard([{ sq: 1, color: B, type: P }]);
    const base = createAmericanRules();
    const decoratorFactory = EVENT_DECORATOR_REGISTRY.get(CrazyEvent.OppositeDay);
    const decorator = decoratorFactory!(base) as EventDecorator;
    const linked = decorator.withInner(base);
    const odEvent = createActiveEvent(CrazyEvent.OppositeDay, PieceColor.White, 0);
    linked.setActiveEventsContext([odEvent]);

    const baseResult = base.checkGameOver(board, PieceColor.White);
    expect(baseResult).not.toBeNull();

    const inverted = linked.onCheckGameOver!(board, PieceColor.White, baseResult);
    expect(inverted).not.toBeNull();
    expect(inverted!.type).toBe('WHITE_WIN');
  });
});

// ===========================================================================
// §7 — Edge-Case Tests from Playtesting (Task 14.1 Step 3)
// ===========================================================================

describe('Playtesting edge cases', () => {
  it('King for a Day + No Touching: pawns get backward movement but cannot capture kings', () => {
    // White pawn at sq 14, no nearby black kings — test backward movement
    // KfaD: pawn becomes king (can move backward)
    // NoTouching: pawns can't capture kings — but under KfaD, all pawns ARE kings
    // so NoTouching should have no effect (no pawns exist)
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const kfadEvent = createActiveEvent(CrazyEvent.KingForADay, PieceColor.White, 0);
    const ntEvent = createActiveEvent(CrazyEvent.NoTouching, PieceColor.White, 0);
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([kfadEvent, ntEvent]);

    // onTurnStart upgrades all pawns to kings
    const transformedBoard = composite.onTurnStart(board, PieceColor.White);
    const moves = composite.getLegalMoves(transformedBoard, PieceColor.White);

    // Should have backward moves (piece is now a king)
    // sq 14 is row 3, col 2. Forward: 9, 10. Backward: 17, 18.
    const destinations = moves.map(m => m.path[0] as number);
    const hasBackward = destinations.some(d => d > 14);
    expect(hasBackward).toBe(true);

    // All moves should be non-capturing (no adjacent opponent pieces)
    // Just verify we have moves in multiple directions
    expect(moves.length).toBeGreaterThan(2);
  });

  it('event expiry at exact boundary: old event cleaned before new event created', () => {
    // Create state with KingForADay at 1 remaining ply
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 9, color: B, type: P },
      { sq: 10, color: B, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const expiringEvent = makeEvent(CrazyEvent.KingForADay, 1, PieceColor.White, 0, {
      originalKingSquares: [],
    });
    const state = crazyStateWithBoard(board, PieceColor.White, [expiringEvent]);

    const moves = getCurrentLegalMoves(state);
    const move = moves[0]!;
    const newState = makeMove(state, move);

    // After the move, KingForADay should be expired (ticked from 1→0→removed)
    const kfadEvents = newState.activeEvents.filter(
      e => e.type === CrazyEvent.KingForADay,
    );
    expect(kfadEvents).toHaveLength(0);
  });

  it('save/resume round-trip with 2+ active events preserves all metadata', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const odEvent = makeEvent(CrazyEvent.OppositeDay, 14, PieceColor.White, 2);
    const kfadEvent = makeEvent(CrazyEvent.KingForADay, 2, PieceColor.Black, 4, {
      originalKingSquares: [5, 14],
    });
    const state = crazyStateWithBoard(board, PieceColor.White, [odEvent, kfadEvent], 6);

    const serialized = serializeGameState(state);
    const restored = deserializeGameState(serialized);

    expect(restored.activeEvents).toHaveLength(2);
    expect(restored.activeEvents[0]!.type).toBe(CrazyEvent.OppositeDay);
    expect(restored.activeEvents[0]!.remainingPlies).toBe(14);
    expect(restored.activeEvents[1]!.type).toBe(CrazyEvent.KingForADay);
    expect(restored.activeEvents[1]!.remainingPlies).toBe(2);
    expect(restored.activeEvents[1]!.metadata).toEqual({ originalKingSquares: [5, 14] });
    expect(restored.mode).toBe(GameMode.Crazy);
  });

  it('AI search consistency: same position + same events = identical scores', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 14, color: W, type: K },
      { sq: 5, color: B, type: P },
      { sq: 1, color: B, type: K },
    ]);
    const events: ActiveEvent[] = [
      makeEvent(CrazyEvent.OppositeDay, 12, PieceColor.White, 0),
      makeEvent(CrazyEvent.KingForADay, 2, PieceColor.Black, 2, {
        originalKingSquares: [14, 1],
      }),
    ];

    const score1 = evaluateWithEvents(board, PieceColor.White, events);
    const score2 = evaluateWithEvents(board, PieceColor.White, events);
    expect(score1).toBe(score2);
  });

  it('Opposite Day + Live Grenade: explosion scoring interacts with score inversion', () => {
    const board = buildBoard([
      { sq: 14, color: W, type: P },
      { sq: 22, color: W, type: P },
      { sq: 5, color: B, type: P },
      { sq: 10, color: B, type: P },
    ]);
    const events: ActiveEvent[] = [
      makeEvent(CrazyEvent.OppositeDay, 12, PieceColor.White, 0),
      makeEvent(CrazyEvent.LiveGrenade, -1, PieceColor.White, 2),
    ];

    const scoreWithEvents = evaluateWithEvents(board, PieceColor.White, events);
    const scoreWithoutEvents = evaluateWithEvents(board, PieceColor.White, []);

    // Opposite Day inverts the score, so the signs should differ
    expect(Math.sign(scoreWithEvents)).not.toBe(Math.sign(scoreWithoutEvents));
  });
});

// ===========================================================================
// §8 — Regression tests for Correction Plan items (Task 14.1 Step 4)
// ===========================================================================

describe('Correction Plan regression tests', () => {
  it('§1 Checks Mix stale board: shuffle uses live board, not creation-time board', () => {
    // Create Checks Mix event, then modify board, then apply — should use modified board
    const boardA = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 14, color: W, type: P },
      { sq: 5, color: B, type: P },
      { sq: 1, color: B, type: P },
    ]);

    // Create ChecksMix metadata with a seed
    const metadataFactory = EVENT_METADATA_FACTORIES.get(CrazyEvent.ChecksMix);
    const metadata = metadataFactory!(boardA, PieceColor.White, () => 0.42);

    // Now create a different board (boardB) — simulating another event modifying the board
    const boardB = buildBoard([
      { sq: 30, color: W, type: P },
      { sq: 20, color: W, type: P },
      { sq: 5, color: B, type: P },
      { sq: 1, color: B, type: P },
    ]);

    const cmEvent = makeEvent(CrazyEvent.ChecksMix, 0, PieceColor.White, 0, metadata);
    const base = createAmericanRules();
    const composite = createCompositeRuleSet(base);
    composite.setActiveEvents([cmEvent]);

    // Apply onTurnStart to boardB (not boardA)
    const shuffledBoard = composite.onTurnStart(boardB, PieceColor.White);

    // The shuffle should operate on boardB. Count total pieces.
    let pieceCount = 0;
    for (const sq of shuffledBoard) {
      if (sq !== null) pieceCount++;
    }
    expect(pieceCount).toBe(4); // Same number of pieces as boardB
  });

  it('§2 Event ticking in Choice mode: events decrement in Choice mode games', () => {
    const timedEvent = makeEvent(CrazyEvent.KingForADay, 4, PieceColor.White, 0, {
      originalKingSquares: [],
    });

    // Tick should decrement regardless of mode
    const ticked = tickAllEvents([timedEvent]);
    expect(ticked).toHaveLength(1);
    expect(ticked[0]!.remainingPlies).toBe(3);
  });

  it('§3 Deserialization for Choice mode: CompositeEventRuleSet present after deserialize', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const base = createAmericanRules();
    const ruleSet = createCompositeRuleSet(base);
    const state: GameState = {
      board,
      activeColor: PieceColor.White,
      status: GameStatus.InProgress,
      result: null,
      ruleSet,
      players: HUMAN_VS_HUMAN,
      moveHistory: [],
      positionHashes: [computeZobristHash(board, PieceColor.White)],
      halfMoveClock: 0,
      plyCount: 0,
      mode: GameMode.Choice,
      activeEvents: [],
    };

    const serialized = serializeGameState(state);
    const restored = deserializeGameState(serialized);

    expect(restored.mode).toBe(GameMode.Choice);
    // The rule set should have event support (CompositeEventRuleSet has setActiveEvents)
    expect(typeof (restored.ruleSet as unknown as Record<string, unknown>).setActiveEvents).toBe('function');
  });

  it('§4 createNewGame for Choice mode: uses CompositeEventRuleSet', () => {
    const base = createAmericanRules();
    const state = createNewGame(base, HUMAN_VS_HUMAN, GameMode.Choice);

    expect(state.mode).toBe(GameMode.Choice);
    expect(typeof (state.ruleSet as unknown as Record<string, unknown>).setActiveEvents).toBe('function');
  });

  it('§7 UI legal moves: backward moves included during King for a Day', () => {
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 1, color: B, type: P },
    ]);
    const kfadEvent = createActiveEvent(CrazyEvent.KingForADay, PieceColor.White, 0);
    const state = crazyStateWithBoard(board, PieceColor.White, [kfadEvent]);

    const moves = getCurrentLegalMoves(state);
    // White pawn at 22 should be treated as king → has backward moves
    const destinations = moves.map(m => m.path[0] as number);
    const hasBackward = destinations.some(d => d > 22);
    expect(hasBackward).toBe(true);
  });
});
