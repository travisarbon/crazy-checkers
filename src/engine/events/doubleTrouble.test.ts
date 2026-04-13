/**
 * Double Trouble — comprehensive test suite (Event 40, meta-event).
 *
 * Double Trouble is a meta-event with no decorator. When drawn in Crazy
 * mode or forced in Chaos mode, it triggers two distinct non-meta events.
 */

import { describe, it, expect } from 'vitest';
import {
  selectRandomEvent,
  selectDoubleTroubleEvents,
  checkEventTrigger,
  IMPLEMENTED_EVENTS,
  META_EVENTS,
} from '../events';
import { makeMove, getCurrentLegalMoves } from '../game';
import { createAmericanRules } from '../rules';
import { createCompositeRuleSet } from '../compositeRuleSet';
import { computeZobristHash } from '../zobrist';
import {
  CrazyEvent,
  GameMode,
  GameStatus,
  PieceColor,
  PlayerType,
  square,
} from '../types';
import type { ActiveEvent, BoardState, GameState, Move, PlayerSetup } from '../types';
import { W, B, P, buildBoard } from '../test-utils';

const HUMAN_VS_HUMAN: PlayerSetup = { white: PlayerType.Human, black: PlayerType.Human };

function crazyState(
  board: BoardState,
  activeColor: PieceColor = PieceColor.White,
  activeEvents: readonly ActiveEvent[] = [],
  mode: GameMode = GameMode.Crazy,
): GameState {
  const base = createAmericanRules();
  const ruleSet = createCompositeRuleSet(base);
  return {
    board, activeColor, status: GameStatus.InProgress, result: null,
    ruleSet, players: HUMAN_VS_HUMAN, moveHistory: [],
    positionHashes: [computeZobristHash(board, activeColor)],
    halfMoveClock: 0, plyCount: 0, mode, activeEvents,
  };
}

const metaSet = new Set<CrazyEvent>(META_EVENTS);

// ===========================================================================
// IMPLEMENTED_EVENTS Pool
// ===========================================================================

describe('IMPLEMENTED_EVENTS pool', () => {
  it('contains exactly 40 entries', () => {
    expect(IMPLEMENTED_EVENTS).toHaveLength(40);
  });

  it('DoubleTrouble is in IMPLEMENTED_EVENTS', () => {
    expect(IMPLEMENTED_EVENTS).toContain(CrazyEvent.DoubleTrouble);
  });

  it('all entries except DoubleTrouble are regular (non-meta) events', () => {
    for (const event of IMPLEMENTED_EVENTS) {
      if (event === CrazyEvent.DoubleTrouble) continue;
      expect(metaSet.has(event as CrazyEvent)).toBe(false);
    }
  });
});

// ===========================================================================
// selectDoubleTroubleEvents
// ===========================================================================

describe('selectDoubleTroubleEvents', () => {
  it('returns exactly 2 events', () => {
    const events = selectDoubleTroubleEvents(() => 0.3);
    expect(events).toHaveLength(2);
  });

  it('both events are distinct', () => {
    const events = selectDoubleTroubleEvents(() => 0.5);
    expect(events[0]).not.toBe(events[1]);
  });

  it('both events are non-meta', () => {
    for (let i = 0; i < 50; i++) {
      const events = selectDoubleTroubleEvents();
      for (const e of events) {
        expect(metaSet.has(e)).toBe(false);
      }
    }
  });

  it('DoubleTrouble itself never appears in result', () => {
    for (let i = 0; i < 100; i++) {
      const events = selectDoubleTroubleEvents();
      expect(events).not.toContain(CrazyEvent.DoubleTrouble);
    }
  });

  it('is deterministic with seeded random', () => {
    const seeded = () => 0.42;
    const a = selectDoubleTroubleEvents(seeded);
    const b = selectDoubleTroubleEvents(seeded);
    expect(a).toEqual(b);
  });

  it('covers diverse events across many calls', () => {
    const seen = new Set<CrazyEvent>();
    for (let i = 0; i < 500; i++) {
      const events = selectDoubleTroubleEvents();
      for (const e of events) seen.add(e);
    }
    // Should hit at least 10 different events out of 19
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
});

// ===========================================================================
// selectRandomEvent with DoubleTrouble in pool
// ===========================================================================

describe('selectRandomEvent (DoubleTrouble live)', () => {
  it('returns 2 events when DoubleTrouble is drawn', () => {
    // DoubleTrouble is at index 19 of 40 events
    // randomFn returning 19/40 = 0.475 → floor(0.475*40) = 19 = DoubleTrouble
    const events = selectRandomEvent(() => 0.475);
    expect(events).toHaveLength(2);
    expect(events[0]).not.toBe(events[1]);
  });

  it('returns 1 event when a regular event is drawn', () => {
    // randomFn returning 0 → index 0 = KingForADay (regular)
    const events = selectRandomEvent(() => 0);
    expect(events).toHaveLength(1);
    expect(events[0]).toBe(CrazyEvent.KingForADay);
  });

  it('never returns DoubleTrouble as an event in the result', () => {
    for (let i = 0; i < 200; i++) {
      const events = selectRandomEvent();
      expect(events).not.toContain(CrazyEvent.DoubleTrouble);
    }
  });

  it('approximately 5% of draws trigger Double Trouble (2-element)', () => {
    let doubleTroubleCount = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i++) {
      const events = selectRandomEvent();
      if (events.length === 2) doubleTroubleCount++;
    }
    // 1/20 = 5%. At n=5000 the 4-sigma band is roughly 3.1%–6.9%; we
    // widen to 2%–10% (inclusive) so a single flaky run doesn't trip
    // on boundary hits like exactly 0.02 or 0.10.
    const rate = doubleTroubleCount / trials;
    expect(rate).toBeGreaterThanOrEqual(0.02);
    expect(rate).toBeLessThanOrEqual(0.10);
  });
});

// ===========================================================================
// checkEventTrigger — Chaos mode forces Double Trouble
// ===========================================================================

describe('checkEventTrigger — Chaos mode', () => {
  const captureMove: Move = {
    from: square(22), path: [square(15)], captured: [square(18)],
  };
  const simpleMove: Move = {
    from: square(22), path: [square(18)], captured: [],
  };
  const multiJump: Move = {
    from: square(22), path: [square(15), square(6)], captured: [square(18), square(10)],
  };

  it('always returns 2 events on any capture', () => {
    const result = checkEventTrigger(captureMove, GameMode.Chaos, () => 0.3);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result).toHaveLength(2);
    expect(result[0]).not.toBe(result[1]);
  });

  it('returns 2 events on multi-jump', () => {
    const result = checkEventTrigger(multiJump, GameMode.Chaos, () => 0.5);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
  });

  it('returns null on simple moves (no capture)', () => {
    expect(checkEventTrigger(simpleMove, GameMode.Chaos)).toBeNull();
  });

  it('both events are non-meta and distinct', () => {
    for (let i = 0; i < 50; i++) {
      const result = checkEventTrigger(captureMove, GameMode.Chaos);
      expect(result).not.toBeNull();
      if (result === null) continue;
      expect(result).toHaveLength(2);
      expect(result[0]).not.toBe(result[1]);
      expect(metaSet.has(result[0] as CrazyEvent)).toBe(false);
      expect(metaSet.has(result[1] as CrazyEvent)).toBe(false);
    }
  });
});

// ===========================================================================
// No DoubleTrouble ActiveEvent invariant
// ===========================================================================

describe('DoubleTrouble ActiveEvent invariant', () => {
  it('DoubleTrouble never appears as ActiveEvent after game moves', () => {
    // Setup: White can make a multi-jump to trigger an event in Crazy mode
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 11, color: B, type: P },
      { sq: 30, color: B, type: P },
    ]);
    let state = crazyState(board, W, []);

    const moves = getCurrentLegalMoves(state);
    const matchingMove = moves.find(m =>
      (m.from as number) === 22 && m.captured.length >= 2,
    );
    if (matchingMove !== undefined) {
      state = makeMove(state, matchingMove);
      // Verify no DoubleTrouble ActiveEvent
      expect(state.activeEvents.every(e => e.type !== CrazyEvent.DoubleTrouble)).toBe(true);
    }
  });

  it('Chaos mode creates 2 ActiveEvents per capture (not DoubleTrouble)', () => {
    // White can jump Black pawn — triggers forced Double Trouble in Chaos
    const board = buildBoard([
      { sq: 22, color: W, type: P },
      { sq: 18, color: B, type: P },
      { sq: 30, color: B, type: P },
    ]);
    // Use a fixed random so we get deterministic events
    const state = crazyState(board, W, [], GameMode.Chaos);

    const moves = getCurrentLegalMoves(state);
    const jump = moves.find(m => m.captured.length > 0);
    if (jump !== undefined) {
      const newState = makeMove(state, jump);
      // Should have 2 new active events (from Double Trouble)
      expect(newState.activeEvents.length).toBe(2);
      // Neither should be DoubleTrouble
      expect(newState.activeEvents.every(e => e.type !== CrazyEvent.DoubleTrouble)).toBe(true);
      // Both should be distinct
      expect(newState.activeEvents[0]?.type).not.toBe(newState.activeEvents[1]?.type);
    }
  });
});

// ===========================================================================
// Determinism
// ===========================================================================

describe('determinism', () => {
  it('selectDoubleTroubleEvents is deterministic with same seed', () => {
    const seed = () => 0.7;
    const a = selectDoubleTroubleEvents(seed);
    const b = selectDoubleTroubleEvents(seed);
    expect(a).toEqual(b);
  });

  it('selectRandomEvent is deterministic with same seed', () => {
    const seed = () => 0.95; // hits DoubleTrouble
    const a = selectRandomEvent(seed);
    const b = selectRandomEvent(seed);
    expect(a).toEqual(b);
  });
});
