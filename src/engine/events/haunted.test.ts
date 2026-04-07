/**
 * Haunted — comprehensive test suite (Event 37).
 */

import { describe, it, expect } from 'vitest';
import { HauntedDecorator } from './haunted';
import type { HauntedMetadata } from './haunted';
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
} from '../types';
import type {
  ActiveEvent,
  BoardState,
  GameState,
  Move,
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

function createHauntedEvent(
  triggeredBy: PieceColor = PieceColor.White,
  triggeredAtPly = 0,
  metadata?: Record<string, unknown>,
): ActiveEvent {
  return createActiveEvent(
    CrazyEvent.Haunted,
    triggeredBy,
    triggeredAtPly,
    metadata ?? { ghosts: [], ghostCount: 0 },
  );
}

function firstMove(state: GameState): Move {
  const moves = getCurrentLegalMoves(state);
  const first = moves[0];
  if (first === undefined) throw new Error('No legal moves');
  return first;
}

// ===========================================================================
// Metadata Factory
// ===========================================================================

describe('Haunted metadata factory', () => {
  it('initializes with empty ghosts and zero count', () => {
    const factory = EVENT_METADATA_FACTORIES.get(CrazyEvent.Haunted);
    expect(factory).toBeDefined();
    if (factory === undefined) throw new Error('factory missing');
    const metadata = factory(buildBoard([]), W) as unknown as HauntedMetadata;
    expect(metadata.ghosts).toEqual([]);
    expect(metadata.ghostCount).toBe(0);
  });
});

// ===========================================================================
// Decorator Tests
// ===========================================================================

describe('HauntedDecorator', () => {
  it('getEventType returns CrazyEvent.Haunted', () => {
    const base = createAmericanRules();
    const decorator = new HauntedDecorator(base);
    expect(decorator.getEventType()).toBe(CrazyEvent.Haunted);
  });

  it('withInner produces a new instance', () => {
    const base = createAmericanRules();
    const decorator = new HauntedDecorator(base);
    const newDecorator = decorator.withInner(base);
    expect(newDecorator).not.toBe(decorator);
    expect(newDecorator).toBeInstanceOf(HauntedDecorator);
  });

  it('ghosts block landing on ghost squares', () => {
    // Ghost at sq 14. White pawn trying to move to 14 should be blocked.
    const board = buildBoard([
      { sq: 18, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createHauntedEvent(W, 0, {
      ghosts: [{ square: 14, remainingPlies: 5 }],
      ghostCount: 1,
    });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // No moves should land on ghost square 14
    for (const m of moves) {
      for (const sq of m.path) {
        expect(sq as number).not.toBe(14);
      }
    }
  });

  it('moves to non-ghost squares are allowed', () => {
    // Ghost at sq 10. White pawn at 18 should still be able to move to other squares.
    const board = buildBoard([
      { sq: 18, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createHauntedEvent(W, 0, {
      ghosts: [{ square: 10, remainingPlies: 5 }],
      ghostCount: 1,
    });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('ghost timers decrement each ply via onTurnEnd', () => {
    // Set up a simple position and make a move
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createHauntedEvent(W, 0, {
      ghosts: [{ square: 10, remainingPlies: 3 }],
      ghostCount: 1,
    });
    const state = crazyStateWithBoard(board, W, [event]);
    const newState = makeMove(state, firstMove(state));

    const hauntedEvt = newState.activeEvents.find(e => e.type === CrazyEvent.Haunted);
    expect(hauntedEvt).toBeDefined();
    const metadata = hauntedEvt?.metadata as unknown as HauntedMetadata | undefined;
    expect(metadata).toBeDefined();
    // Ghost timer should have decremented by 1
    if (metadata && metadata.ghosts.length > 0) {
      expect(metadata.ghosts[0]?.remainingPlies).toBe(2);
    }
  });

  it('expired ghosts are removed from metadata', () => {
    // Ghost with 1 remaining ply — should expire after one turn
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createHauntedEvent(W, 0, {
      ghosts: [{ square: 10, remainingPlies: 1 }],
      ghostCount: 1,
    });
    const state = crazyStateWithBoard(board, W, [event]);
    const newState = makeMove(state, firstMove(state));

    const hauntedEvt = newState.activeEvents.find(e => e.type === CrazyEvent.Haunted);
    if (hauntedEvt) {
      const metadata = hauntedEvt.metadata as unknown as HauntedMetadata;
      // Ghost should be removed (remainingPlies 1 - 1 = 0 → filtered out)
      expect(metadata.ghosts.length).toBe(0);
    }
  });

  it('event is removed when all 3 ghosts have been created and expired', () => {
    // 3 ghosts, all about to expire
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createHauntedEvent(W, 0, {
      ghosts: [
        { square: 10, remainingPlies: 1 },
        { square: 11, remainingPlies: 1 },
        { square: 12, remainingPlies: 1 },
      ],
      ghostCount: 3,
    });
    const state = crazyStateWithBoard(board, W, [event]);
    const newState = makeMove(state, firstMove(state));

    // Event should be removed (all 3 ghosts expired, ghostCount >= 3)
    expect(newState.activeEvents.some(e => e.type === CrazyEvent.Haunted)).toBe(false);
  });

  it('event persists while ghosts remain even if cap is reached', () => {
    // 3 ghosts created but some still alive
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 3, color: B, type: P },
    ]);
    const event = createHauntedEvent(W, 0, {
      ghosts: [
        { square: 10, remainingPlies: 1 },
        { square: 11, remainingPlies: 5 },
      ],
      ghostCount: 3,
    });
    const state = crazyStateWithBoard(board, W, [event]);
    const newState = makeMove(state, firstMove(state));

    // Event should still be active (one ghost still has remaining plies)
    expect(newState.activeEvents.some(e => e.type === CrazyEvent.Haunted)).toBe(true);
  });

  it('is a condition-based event (remainingPlies === -1)', () => {
    const event = createActiveEvent(CrazyEvent.Haunted, W, 0);
    expect(event.remainingPlies).toBe(-1);
  });

  it('fallback simple moves when all jumps blocked by ghosts', () => {
    // Set up: White has a mandatory capture, but the landing square is a ghost
    // This should trigger fallback simple moves
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P }, // Can be captured, landing at 15
      { sq: 3, color: B, type: P },
    ]);
    const event = createHauntedEvent(W, 0, {
      ghosts: [{ square: 15, remainingPlies: 5 }], // blocks landing
      ghostCount: 1,
    });
    const state = crazyStateWithBoard(board, W, [event]);
    const moves = getCurrentLegalMoves(state);

    // Should have some moves (fallback simples), none landing on ghost
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      for (const sq of m.path) {
        expect(sq as number).not.toBe(15);
      }
    }
  });

  it('is registered in EVENT_DECORATOR_REGISTRY', () => {
    expect(EVENT_DECORATOR_REGISTRY.has(CrazyEvent.Haunted)).toBe(true);
  });

  it('CrazyEvent.Haunted is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.Haunted);
  });
});
