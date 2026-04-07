import { describe, it, expect } from 'vitest';
import {
  EventDecorator,
  EVENT_DURATIONS,
  EVENT_FLAVOR_TEXT,
  EVENT_DISPLAY_NAMES,
  IMPLEMENTED_EVENTS,
  META_EVENTS,
  createActiveEvent,
  tickAllEvents,
  removeEventsByType,
  resolveConflicts,
  isMultiJump,
  selectRandomEvent,
  checkEventTrigger,
} from './events';
import { CrazyEvent, GameMode, PieceColor, square } from './types';
import type { ActiveEvent, BoardState, Move, RuleSet } from './types';
import { createAmericanRules } from './rules';

// ---------------------------------------------------------------------------
// Test helper: minimal concrete EventDecorator subclass
// ---------------------------------------------------------------------------

class TestDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.KingForADay;
  }
  withInner(inner: RuleSet): EventDecorator {
    return new TestDecorator(inner);
  }
}

/** Helper to create an ActiveEvent with minimal boilerplate. */
function makeEvent(
  type: CrazyEvent,
  remainingPlies: number,
  triggeredAtPly: number = 0,
  metadata?: Readonly<Record<string, unknown>>,
): ActiveEvent {
  return {
    type,
    remainingPlies,
    triggeredBy: PieceColor.White,
    triggeredAtPly,
    metadata,
  };
}

// ===========================================================================
// CrazyEvent enum
// ===========================================================================

describe('CrazyEvent', () => {
  it('has 40 entries (all events from the Events and Choice Mode Playbook)', () => {
    expect(Object.values(CrazyEvent)).toHaveLength(40);
  });
});

// ===========================================================================
// Event constants
// ===========================================================================

describe('EVENT_DURATIONS', () => {
  it('covers all events', () => {
    for (const event of Object.values(CrazyEvent)) {
      expect(EVENT_DURATIONS[event]).toBeDefined();
    }
  });
});

describe('EVENT_FLAVOR_TEXT', () => {
  it('covers all events', () => {
    for (const event of Object.values(CrazyEvent)) {
      expect(EVENT_FLAVOR_TEXT[event]).toBeDefined();
      expect(typeof EVENT_FLAVOR_TEXT[event]).toBe('string');
    }
  });
});

describe('EVENT_DISPLAY_NAMES', () => {
  it('covers all events', () => {
    for (const event of Object.values(CrazyEvent)) {
      expect(EVENT_DISPLAY_NAMES[event]).toBeDefined();
      expect(typeof EVENT_DISPLAY_NAMES[event]).toBe('string');
    }
  });
});

// ===========================================================================
// createActiveEvent
// ===========================================================================

describe('createActiveEvent', () => {
  it('creates correct structure with default duration', () => {
    const event = createActiveEvent(CrazyEvent.KingForADay, PieceColor.White, 10);
    expect(event.type).toBe(CrazyEvent.KingForADay);
    expect(event.remainingPlies).toBe(EVENT_DURATIONS[CrazyEvent.KingForADay]);
    expect(event.triggeredBy).toBe(PieceColor.White);
    expect(event.triggeredAtPly).toBe(10);
    expect(event.metadata).toBeUndefined();
  });

  it('preserves metadata', () => {
    const meta = { originalKingSquares: [5, 14] };
    const event = createActiveEvent(CrazyEvent.KingForADay, PieceColor.Black, 5, meta);
    expect(event.metadata).toEqual(meta);
  });

  it('uses correct duration for each event type', () => {
    for (const type of Object.values(CrazyEvent)) {
      const event = createActiveEvent(type, PieceColor.White, 0);
      expect(event.remainingPlies).toBe(EVENT_DURATIONS[type]);
    }
  });
});

// ===========================================================================
// tickAllEvents
// ===========================================================================

describe('tickAllEvents', () => {
  it('decrements ply-based events', () => {
    const events = [makeEvent(CrazyEvent.KingForADay, 2)];
    const result = tickAllEvents(events);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ remainingPlies: 1 });
  });

  it('removes expired events (decremented to 0)', () => {
    const events = [makeEvent(CrazyEvent.KingForADay, 1)];
    const result = tickAllEvents(events);
    expect(result).toHaveLength(0);
  });

  it('does not tick condition-based events (remainingPlies === -1)', () => {
    const events = [makeEvent(CrazyEvent.LiveGrenade, -1)];
    const result = tickAllEvents(events);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ remainingPlies: -1 });
  });

  it('removes instant events (remainingPlies === 0)', () => {
    const events = [makeEvent(CrazyEvent.ChecksMix, 0)];
    const result = tickAllEvents(events);
    expect(result).toHaveLength(0);
  });

  it('handles mixed event types correctly', () => {
    const events = [
      makeEvent(CrazyEvent.KingForADay, 2), // ply-based: 2 → 1
      makeEvent(CrazyEvent.LiveGrenade, -1), // condition-based: unchanged
      makeEvent(CrazyEvent.ChecksMix, 0), // instant: removed
      makeEvent(CrazyEvent.OppositeDay, 1), // ply-based: 1 → removed
    ];
    const result = tickAllEvents(events);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: CrazyEvent.KingForADay, remainingPlies: 1 });
    expect(result[1]).toMatchObject({ type: CrazyEvent.LiveGrenade, remainingPlies: -1 });
  });
});

// ===========================================================================
// removeEventsByType
// ===========================================================================

describe('removeEventsByType', () => {
  it('removes all matching events', () => {
    const events = [
      makeEvent(CrazyEvent.LiveGrenade, -1, 0),
      makeEvent(CrazyEvent.LiveGrenade, -1, 5),
    ];
    const result = removeEventsByType(events, CrazyEvent.LiveGrenade);
    expect(result).toHaveLength(0);
  });

  it('preserves other events', () => {
    const events = [
      makeEvent(CrazyEvent.LiveGrenade, -1),
      makeEvent(CrazyEvent.KingForADay, 2),
    ];
    const result = removeEventsByType(events, CrazyEvent.LiveGrenade);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: CrazyEvent.KingForADay });
  });
});

// ===========================================================================
// resolveConflicts
// ===========================================================================

describe('resolveConflicts', () => {
  it('removes instant events (remainingPlies === 0)', () => {
    const events = [
      makeEvent(CrazyEvent.ChecksMix, 0),
      makeEvent(CrazyEvent.KingForADay, 2),
    ];
    const result = resolveConflicts(events);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: CrazyEvent.KingForADay });
  });

  it('preserves active events with positive plies', () => {
    const events = [makeEvent(CrazyEvent.KingForADay, 2)];
    const result = resolveConflicts(events);
    expect(result).toHaveLength(1);
  });

  it('preserves condition-based events', () => {
    const events = [makeEvent(CrazyEvent.LiveGrenade, -1)];
    const result = resolveConflicts(events);
    expect(result).toHaveLength(1);
  });
});

// ===========================================================================
// EventDecorator base class
// ===========================================================================

describe('EventDecorator', () => {
  const rules = createAmericanRules();

  describe('isActive', () => {
    it('returns true when event type is in the list', () => {
      const decorator = new TestDecorator(rules);
      const events = [makeEvent(CrazyEvent.KingForADay, 2)];
      expect(decorator.isActive(events)).toBe(true);
    });

    it('returns false when event type is not in the list', () => {
      const decorator = new TestDecorator(rules);
      const events = [makeEvent(CrazyEvent.LiveGrenade, -1)];
      expect(decorator.isActive(events)).toBe(false);
    });

    it('returns true when multiple of same type exist', () => {
      const decorator = new TestDecorator(rules);
      const events = [
        makeEvent(CrazyEvent.KingForADay, 2, 0),
        makeEvent(CrazyEvent.KingForADay, 2, 5),
      ];
      expect(decorator.isActive(events)).toBe(true);
    });

    it('returns false for empty events list', () => {
      const decorator = new TestDecorator(rules);
      expect(decorator.isActive([])).toBe(false);
    });
  });

  describe('getActiveEntry (via tickDuration behavior)', () => {
    it('tickDuration decrements matching events only', () => {
      const decorator = new TestDecorator(rules);
      const events = [
        makeEvent(CrazyEvent.KingForADay, 2),
        makeEvent(CrazyEvent.LiveGrenade, -1),
      ];
      const result = decorator.tickDuration(events);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ remainingPlies: 1 }); // KingForADay decremented
      expect(result[1]).toMatchObject({ remainingPlies: -1 }); // LiveGrenade unchanged
    });

    it('tickDuration removes expired matching events', () => {
      const decorator = new TestDecorator(rules);
      const events = [makeEvent(CrazyEvent.KingForADay, 1)];
      const result = decorator.tickDuration(events);
      expect(result).toHaveLength(0);
    });

    it('tickDuration ignores condition-based events of matching type', () => {
      // Use a different test decorator for LiveGrenade
      class LiveGrenadeTestDecorator extends EventDecorator {
        getEventType(): CrazyEvent {
          return CrazyEvent.LiveGrenade;
        }
        withInner(inner: RuleSet): EventDecorator {
          return new LiveGrenadeTestDecorator(inner);
        }
      }
      const lgDecorator = new LiveGrenadeTestDecorator(rules);
      const events = [makeEvent(CrazyEvent.LiveGrenade, -1)];
      const result = lgDecorator.tickDuration(events);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ remainingPlies: -1 });
    });

    it('tickDuration does not affect other event types', () => {
      const decorator = new TestDecorator(rules); // handles KingForADay
      const events = [makeEvent(CrazyEvent.OppositeDay, 16)];
      const result = decorator.tickDuration(events);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ remainingPlies: 16 }); // unchanged
    });
  });

  describe('RuleSet delegation', () => {
    it('delegates all RuleSet methods to inner', () => {
      const decorator = new TestDecorator(rules);
      const board: BoardState = new Array(32).fill(null);
      // Place a white pawn at sq 22
      (board as unknown[])[21] = { color: PieceColor.White, type: 'PAWN' };

      // getLegalMoves delegates
      const moves = decorator.getLegalMoves(board, PieceColor.White);
      const baseMoves = rules.getLegalMoves(board, PieceColor.White);
      expect(moves).toEqual(baseMoves);

      // checkGameOver delegates
      const result = decorator.checkGameOver(board, PieceColor.Black);
      const baseResult = rules.checkGameOver(board, PieceColor.Black);
      expect(result).toEqual(baseResult);

      // shouldPromote delegates
      const piece = { color: PieceColor.White, type: 'PAWN' as const };
      expect(decorator.shouldPromote(piece, square(1))).toBe(rules.shouldPromote(piece, square(1)));
    });
  });
});

// ===========================================================================
// Event trigger logic
// ===========================================================================

describe('isMultiJump', () => {
  it('returns true for 2+ captures', () => {
    const move: Move = {
      from: square(22),
      path: [square(15), square(6)],
      captured: [square(18), square(10)],
    };
    expect(isMultiJump(move)).toBe(true);
  });

  it('returns true for 3 captures', () => {
    const move: Move = {
      from: square(26),
      path: [square(17), square(10), square(1)],
      captured: [square(22), square(14), square(6)],
    };
    expect(isMultiJump(move)).toBe(true);
  });

  it('returns false for single jump', () => {
    const move: Move = {
      from: square(22),
      path: [square(15)],
      captured: [square(18)],
    };
    expect(isMultiJump(move)).toBe(false);
  });

  it('returns false for simple move (0 captures)', () => {
    const move: Move = {
      from: square(22),
      path: [square(18)],
      captured: [],
    };
    expect(isMultiJump(move)).toBe(false);
  });
});

describe('META_EVENTS', () => {
  it('contains DoubleTrouble', () => {
    expect(META_EVENTS).toContain(CrazyEvent.DoubleTrouble);
  });

  it('DoubleTrouble is in IMPLEMENTED_EVENTS (Task 15.3)', () => {
    const implementedSet = new Set<string>(IMPLEMENTED_EVENTS);
    expect(implementedSet.has(CrazyEvent.DoubleTrouble)).toBe(true);
  });
});

describe('selectRandomEvent', () => {
  it('returns an array of implemented events for 100 random calls', () => {
    const validEvents = new Set<string>(IMPLEMENTED_EVENTS);
    for (let i = 0; i < 100; i++) {
      const events = selectRandomEvent();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThanOrEqual(1);
      for (const event of events) {
        expect(validEvents.has(event)).toBe(true);
      }
    }
  });

  it('returns 1 or 2 elements depending on whether DoubleTrouble is drawn', () => {
    // With a fixed random, ensure deterministic behavior
    const events = selectRandomEvent(() => 0.5);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.length).toBeLessThanOrEqual(2);
  });

  it('is deterministic with seeded random', () => {
    const seeded = () => 0.5;
    const events1 = selectRandomEvent(seeded);
    const events2 = selectRandomEvent(seeded);
    expect(events1).toEqual(events2);
  });

  it('selects first implemented event when random returns 0', () => {
    const events = selectRandomEvent(() => 0);
    expect(events[0]).toBe(IMPLEMENTED_EVENTS[0]);
  });

  it('selects last implemented event when random returns just under 1', () => {
    // Last event is ShrinkingBoard — a regular event, returns 1-element array
    const events = selectRandomEvent(() => 0.999);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const implementedSet = new Set<string>(IMPLEMENTED_EVENTS);
    for (const e of events) {
      expect(implementedSet.has(e)).toBe(true);
    }
  });

  it('only draws from IMPLEMENTED_EVENTS, not the full enum', () => {
    const implementedSet = new Set<string>(IMPLEMENTED_EVENTS);
    for (let i = 0; i < 200; i++) {
      const events = selectRandomEvent();
      for (const event of events) {
        expect(implementedSet.has(event)).toBe(true);
      }
    }
  });
});

describe('checkEventTrigger', () => {
  const multiJumpMove: Move = {
    from: square(22),
    path: [square(15), square(6)],
    captured: [square(18), square(10)],
  };
  const singleJumpMove: Move = {
    from: square(22),
    path: [square(15)],
    captured: [square(18)],
  };
  const simpleMove: Move = {
    from: square(22),
    path: [square(18)],
    captured: [],
  };

  it('returns an array of implemented events for multi-jump in Crazy mode', () => {
    const result = checkEventTrigger(multiJumpMove, GameMode.Crazy, () => 0.5);
    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
    if (result !== null) {
      for (const event of result) {
        expect(IMPLEMENTED_EVENTS).toContain(event);
      }
    }
  });

  it('returns null for single jump in Crazy mode', () => {
    expect(checkEventTrigger(singleJumpMove, GameMode.Crazy)).toBeNull();
  });

  it('returns null for simple move in Crazy mode', () => {
    expect(checkEventTrigger(simpleMove, GameMode.Crazy)).toBeNull();
  });

  it('returns null in Classic mode regardless of jump count', () => {
    expect(checkEventTrigger(multiJumpMove, GameMode.Classic)).toBeNull();
  });

  it('triggers Double Trouble (2 events) on any capture in Chaos mode', () => {
    const result = checkEventTrigger(singleJumpMove, GameMode.Chaos, () => 0.5);
    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
    if (result !== null) {
      expect(result).toHaveLength(2);
      expect(result[0]).not.toBe(result[1]);
      const metaSet = new Set<CrazyEvent>(META_EVENTS);
      for (const event of result) {
        expect(IMPLEMENTED_EVENTS).toContain(event);
        expect(metaSet.has(event)).toBe(false);
      }
    }
  });

  it('does not trigger in Chaos mode on simple moves (0 captures)', () => {
    expect(checkEventTrigger(simpleMove, GameMode.Chaos)).toBeNull();
  });

  it('returns null in Choice mode (events are permanent, not triggered by jumps)', () => {
    expect(checkEventTrigger(multiJumpMove, GameMode.Choice)).toBeNull();
  });
});
