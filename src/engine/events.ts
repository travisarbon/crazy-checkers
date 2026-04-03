/**
 * Event system core: constants, EventDecorator base class, lifecycle utilities,
 * trigger logic, decorator registry, and serialization types.
 *
 * Production event decorators (Tasks 8.x–9.x) extend EventDecorator and
 * register themselves in EVENT_DECORATOR_REGISTRY.
 */

import type {
  ActiveEvent,
  BoardState,
  GameResult,
  Move,
  Piece,
  PieceColor,
  RuleSet,
  Square,
} from './types';
import { CrazyEvent, GameMode } from './types';

// ---------------------------------------------------------------------------
// Step 2 — Event Duration Constants
// ---------------------------------------------------------------------------

/**
 * Default durations for each event type, in half-turns (plies).
 *
 * Source: Design Document §2.2.
 * - Positive integer: fixed ply count.
 * - 0: instant (applied once, then removed).
 * - -1: condition-based (removed when a specific game condition is met).
 */
export const EVENT_DURATIONS: Readonly<Record<CrazyEvent, number>> = {
  [CrazyEvent.KingForADay]: 2, // 1 round = 2 plies
  [CrazyEvent.LiveGrenade]: -1, // Until next capture
  [CrazyEvent.HotPotato]: 1, // 1 move = 1 ply
  [CrazyEvent.ChecksMix]: 0, // Instant
  [CrazyEvent.OppositeDay]: 2, // 1 round = 2 plies
  [CrazyEvent.UpInTheAir]: 2, // 1 round = 2 plies
  [CrazyEvent.NoTouching]: 2, // 1 round = 2 plies
};

/**
 * Flavor text for each event (Design Document §2.2).
 * Used by the UI for event announcements (Task 10.3).
 */
export const EVENT_FLAVOR_TEXT: Readonly<Record<CrazyEvent, string>> = {
  [CrazyEvent.KingForADay]: 'For one round everyone wears the crown!',
  [CrazyEvent.LiveGrenade]: 'Your next jump causes a big boom!',
  [CrazyEvent.HotPotato]: 'Your next move changes hands!',
  [CrazyEvent.ChecksMix]: 'Everything has changed!',
  [CrazyEvent.OppositeDay]: "It's golf rules now!",
  [CrazyEvent.UpInTheAir]: 'Everyone can fly!',
  [CrazyEvent.NoTouching]: "Pawns can't capture kings!",
};

/**
 * Human-readable display names for each event.
 * Used by the UI for the active events indicator (Task 10.3, Task 11.3).
 */
export const EVENT_DISPLAY_NAMES: Readonly<Record<CrazyEvent, string>> = {
  [CrazyEvent.KingForADay]: 'King for a Day',
  [CrazyEvent.LiveGrenade]: 'Live Grenade',
  [CrazyEvent.HotPotato]: 'Hot Potato',
  [CrazyEvent.ChecksMix]: 'Checks Mix',
  [CrazyEvent.OppositeDay]: 'Opposite Day',
  [CrazyEvent.UpInTheAir]: 'Up in the Air',
  [CrazyEvent.NoTouching]: 'No Touching!',
};

// ---------------------------------------------------------------------------
// Step 3 — EventDecorator Abstract Base Class
// ---------------------------------------------------------------------------

/**
 * Abstract base class for production event decorators.
 *
 * Unlike the stress-test prototypes in events.stresstest.ts, production
 * decorators are STATELESS: they derive all needed information from the
 * `ActiveEvent` entries in the active events list, not from instance variables.
 *
 * Subclasses override specific RuleSet methods and hooks to inject
 * event-specific behavior, always checking `isActive()` first.
 */
export abstract class EventDecorator implements RuleSet {
  protected readonly inner: RuleSet;

  constructor(inner: RuleSet) {
    this.inner = inner;
  }

  /** Returns the CrazyEvent type this decorator handles. */
  abstract getEventType(): CrazyEvent;

  /**
   * Returns a new instance of this decorator wrapping a different inner RuleSet.
   * Used by CompositeEventRuleSet to build temporary decorator chains.
   */
  abstract withInner(inner: RuleSet): EventDecorator;

  /**
   * Checks whether this event type is currently active.
   * Searches the provided active events list for a matching type.
   */
  isActive(events: readonly ActiveEvent[]): boolean {
    return events.some((e) => e.type === this.getEventType());
  }

  /**
   * Returns the ActiveEvent entry for this decorator's type, if present.
   * When multiple entries of the same type exist (stacking), returns the
   * newest (last in the array, per the "newest takes precedence" rule).
   */
  protected getActiveEntry(events: readonly ActiveEvent[]): ActiveEvent | undefined {
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (event !== undefined && event.type === this.getEventType()) {
        return event;
      }
    }
    return undefined;
  }

  /**
   * Ticks duration for events of this type. Decrements remainingPlies by 1
   * for each matching event. Removes events whose remainingPlies reaches 0
   * after decrement. Does not tick condition-based events (remainingPlies === -1)
   * or instant events (remainingPlies === 0).
   *
   * Returns a new array with updated events.
   */
  tickDuration(events: readonly ActiveEvent[]): readonly ActiveEvent[] {
    return events
      .map((e) => {
        if (e.type !== this.getEventType()) return e;
        if (e.remainingPlies <= 0) return e;
        return { ...e, remainingPlies: e.remainingPlies - 1 };
      })
      .filter((e) => {
        if (e.type !== this.getEventType()) return true;
        return e.remainingPlies !== 0;
      });
  }

  // --- RuleSet delegation ---

  getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    return this.inner.getLegalMoves(board, activeColor);
  }

  applyMove(board: BoardState, move: Move): BoardState {
    return this.inner.applyMove(board, move);
  }

  checkGameOver(board: BoardState, activeColor: PieceColor): GameResult | null {
    return this.inner.checkGameOver(board, activeColor);
  }

  shouldPromote(piece: Piece, sq: Square): boolean {
    return this.inner.shouldPromote(piece, sq);
  }

  onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    return this.inner.onTurnStart ? this.inner.onTurnStart(board, activeColor) : board;
  }

  onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    return this.inner.onTurnEnd ? this.inner.onTurnEnd(board, activeColor, move) : board;
  }

  onCapture(board: BoardState, landingSquare: Square, captured: Square[]): BoardState {
    return this.inner.onCapture ? this.inner.onCapture(board, landingSquare, captured) : board;
  }

  onCheckGameOver(
    board: BoardState,
    activeColor: PieceColor,
    baseResult: GameResult | null,
  ): GameResult | null {
    return this.inner.onCheckGameOver
      ? this.inner.onCheckGameOver(board, activeColor, baseResult)
      : baseResult;
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Event Stacking, Conflict Resolution, and Lifecycle Utilities
// ---------------------------------------------------------------------------

/**
 * Resolves conflicts in the active events list.
 *
 * Removes instant events (remainingPlies === 0) that have already been applied.
 * The "newest takes precedence" rule for same-type stacking is enforced by
 * the decorator's getActiveEntry() returning the last match.
 */
export function resolveConflicts(events: readonly ActiveEvent[]): readonly ActiveEvent[] {
  return events.filter((e) => e.remainingPlies !== 0);
}

/**
 * Creates a new ActiveEvent for the given event type.
 */
export function createActiveEvent(
  type: CrazyEvent,
  triggeredBy: PieceColor,
  triggeredAtPly: number,
  metadata?: Readonly<Record<string, unknown>>,
): ActiveEvent {
  return {
    type,
    remainingPlies: EVENT_DURATIONS[type],
    triggeredBy,
    triggeredAtPly,
    metadata,
  };
}

/**
 * Ticks all active events' durations by one ply.
 * Returns a new array with decremented durations and expired events removed.
 *
 * Condition-based events (remainingPlies === -1) are NOT ticked here;
 * they are removed by their specific decorator when the condition is met.
 */
export function tickAllEvents(events: readonly ActiveEvent[]): readonly ActiveEvent[] {
  return events
    .map((e) => {
      if (e.remainingPlies <= 0) return e;
      return { ...e, remainingPlies: e.remainingPlies - 1 };
    })
    .filter((e) => e.remainingPlies !== 0);
}

/**
 * Removes all events of the specified type from the active events list.
 * Used when a condition-based event's condition is met (e.g., Live Grenade
 * detonates on capture).
 */
export function removeEventsByType(
  events: readonly ActiveEvent[],
  type: CrazyEvent,
): readonly ActiveEvent[] {
  return events.filter((e) => e.type !== type);
}

// ---------------------------------------------------------------------------
// Step 6 — Crazy Mode Event Trigger Logic
// ---------------------------------------------------------------------------

/**
 * Returns true if the given move is a multi-jump (two or more captures).
 * Multi-jumps are the trigger condition for Crazy mode events (Design Document §2.2).
 */
export function isMultiJump(move: Move): boolean {
  return move.captured.length >= 2;
}

/**
 * Selects a random event type from the seven Crazy mode events.
 *
 * Accepts an optional random function for testability (dependency injection).
 * The default uses Math.random(). For deterministic replays (Phase 3 Cogitate),
 * a seeded PRNG should be passed.
 */
export function selectRandomEvent(randomFn: () => number = Math.random): CrazyEvent {
  const events = Object.values(CrazyEvent);
  const index = Math.floor(randomFn() * events.length);
  return events[index] as CrazyEvent;
}

/**
 * Determines whether an event should trigger and, if so, which event.
 * Called after every move in Crazy mode.
 */
export function checkEventTrigger(
  move: Move,
  mode: GameMode,
  randomFn: () => number = Math.random,
): CrazyEvent | null {
  if (mode !== GameMode.Crazy) return null;
  if (!isMultiJump(move)) return null;
  return selectRandomEvent(randomFn);
}

// ---------------------------------------------------------------------------
// Step 7 — Event Decorator Registry
// ---------------------------------------------------------------------------

/**
 * Registry of event decorator factories.
 *
 * Each factory takes a base RuleSet and returns an EventDecorator instance.
 * Populated by Tasks 8.x and 9.x as each event is implemented.
 * Initially empty — the composite handles an empty registry gracefully.
 */
export const EVENT_DECORATOR_REGISTRY: Map<CrazyEvent, (base: RuleSet) => EventDecorator> =
  new Map();

// createCompositeRuleSet factory is in compositeRuleSet.ts to avoid circular imports.

// ---------------------------------------------------------------------------
// Step 8 — Serialization Support for AI Worker
// ---------------------------------------------------------------------------

/**
 * Extensions to SerializableGameState for Phase 2.
 * These fields will be added to the worker's SerializableGameState in Task 10.2.
 * Defined here for type-level documentation.
 */
export interface EventSerializationFields {
  readonly mode: GameMode;
  readonly activeEvents: readonly ActiveEvent[];
}
