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
 * Source: Events and Choice Mode Playbook.
 * - Positive integer: fixed ply count.
 * - 0: instant (applied once, then removed).
 * - -1: condition-based (removed when a specific game condition is met).
 *
 * All 40 events are included for forward-compatibility with Phases 3–4.
 */
export const EVENT_DURATIONS: Readonly<Record<CrazyEvent, number>> = {
  // Phase 2 (core events)
  [CrazyEvent.KingForADay]: 2, // 1 round = 2 plies
  [CrazyEvent.LiveGrenade]: -1, // Until next capture
  [CrazyEvent.HotPotato]: 2, // Design Decision: Playbook says 1 ply, but 2 plies needed to survive opponent's turn (see Task 8.4 §3.3)
  [CrazyEvent.ChecksMix]: 0, // Instant
  [CrazyEvent.OppositeDay]: 16, // 8 rounds = 16 plies
  [CrazyEvent.UpInTheAir]: 2, // 1 round = 2 plies
  [CrazyEvent.NoTouching]: 2, // 1 round = 2 plies
  // Phases 3–4 (Events 8–40)
  [CrazyEvent.StepBack]: 4, // 2 rounds
  [CrazyEvent.FlippedScript]: 0, // Instant, permanent transformation
  [CrazyEvent.MarchingOrders]: -1, // Permanent
  [CrazyEvent.DealersChoice]: -1, // Condition-based (both skips used)
  [CrazyEvent.Bodyguard]: 4, // 2 rounds
  [CrazyEvent.Quicksand]: 4, // 2 rounds
  [CrazyEvent.Conscription]: 4, // 2 rounds
  [CrazyEvent.GhostWalk]: 2, // 1 round
  [CrazyEvent.Landmine]: 4, // 2 rounds
  [CrazyEvent.Leapfrog]: 2, // 1 round
  [CrazyEvent.FrozenAssets]: 4, // 2 rounds
  [CrazyEvent.DoubleTime]: 2, // 1 round
  [CrazyEvent.SafeHaven]: 4, // 2 rounds
  [CrazyEvent.ChainReaction]: -1, // Until triggered
  [CrazyEvent.PromotionParty]: 4, // 2 rounds
  [CrazyEvent.Reinforcements]: 0, // Instant
  [CrazyEvent.Wormhole]: 4, // 2 rounds
  [CrazyEvent.Demotion]: 0, // Instant
  [CrazyEvent.TimeBomb]: -1, // Countdown-based
  [CrazyEvent.ForcedMarch]: 4, // 2 rounds
  [CrazyEvent.Ricochet]: 2, // 1 round
  [CrazyEvent.CrownThief]: 4, // 2 rounds
  [CrazyEvent.Stampede]: 0, // Instant
  [CrazyEvent.TollRoad]: 4, // 2 rounds
  [CrazyEvent.SwapMeet]: 0, // Instant
  [CrazyEvent.RoyalDecree]: 4, // 2 rounds
  [CrazyEvent.Backfire]: 2, // 1 round
  [CrazyEvent.Sentry]: 4, // 2 rounds
  [CrazyEvent.RushHour]: 2, // 1 round
  [CrazyEvent.Haunted]: -1, // Condition-based (3 ghosts)
  [CrazyEvent.Sacrifice]: 4, // 2 rounds
  [CrazyEvent.ShrinkingBoard]: -1, // Permanent
  // Event 40 — Meta-event (instant; resolved by selection logic, never added to activeEvents)
  [CrazyEvent.DoubleTrouble]: 0, // Instant meta-event
};

/**
 * Flavor text for each event (Events and Choice Mode Playbook).
 * Used by the UI for event announcements (Task 10.3).
 */
export const EVENT_FLAVOR_TEXT: Readonly<Record<CrazyEvent, string>> = {
  // Phase 2 (core events)
  [CrazyEvent.KingForADay]: 'For one round everyone wears the crown!',
  [CrazyEvent.LiveGrenade]: 'Your next jump causes a big boom!',
  [CrazyEvent.HotPotato]: 'Your next move changes hands!',
  [CrazyEvent.ChecksMix]: 'Everything has changed!',
  [CrazyEvent.OppositeDay]: "It's golf rules now!",
  [CrazyEvent.UpInTheAir]: 'Everyone can fly!',
  [CrazyEvent.NoTouching]: "Pawns can't capture kings!",
  // Phases 3–4 (Events 8–40)
  [CrazyEvent.StepBack]: "Don't look now — they're coming from behind!",
  [CrazyEvent.FlippedScript]: 'Everything you knew is upside down!',
  [CrazyEvent.MarchingOrders]: 'Fall in line, soldier — no more diagonals!',
  [CrazyEvent.DealersChoice]: "You know what? I'll pass on that one.",
  [CrazyEvent.Bodyguard]: 'The kings have hired protection!',
  [CrazyEvent.Quicksand]: 'The edge of the board is sticky!',
  [CrazyEvent.Conscription]: 'Your captured soldiers switch sides!',
  [CrazyEvent.GhostWalk]: "Now you see them, now you don't!",
  [CrazyEvent.Landmine]: "Watch your step — the center is rigged!",
  [CrazyEvent.Leapfrog]: 'Jump your own team for extra distance!',
  [CrazyEvent.FrozenAssets]: 'Brrr! The kings are frozen solid!',
  [CrazyEvent.DoubleTime]: 'Double the moves, double the chaos!',
  [CrazyEvent.SafeHaven]: 'Find shelter in the corners!',
  [CrazyEvent.ChainReaction]: 'One falls, they all fall!',
  [CrazyEvent.PromotionParty]: "It's a party — everyone's getting promoted!",
  [CrazyEvent.Reinforcements]: 'Fresh troops reporting for duty!',
  [CrazyEvent.Wormhole]: 'Space just folded in half!',
  [CrazyEvent.Demotion]: "The crown is heavy — time to give it up!",
  [CrazyEvent.TimeBomb]: "Tick… tick… tick… BOOM!",
  [CrazyEvent.ForcedMarch]: 'The vanguard leads the charge!',
  [CrazyEvent.Ricochet]: 'Boing! Off the walls they go!',
  [CrazyEvent.CrownThief]: 'Steal the crown right off their head!',
  [CrazyEvent.Stampede]: 'Charge! Everyone forward!',
  [CrazyEvent.TollRoad]: 'Victory has a price!',
  [CrazyEvent.SwapMeet]: "Wait — that's not my piece!",
  [CrazyEvent.RoyalDecree]: 'Only royalty may move!',
  [CrazyEvent.Backfire]: "Watch where you're jumping!",
  [CrazyEvent.Sentry]: "Under the king's watchful eye, none shall pass!",
  [CrazyEvent.RushHour]: 'Full speed ahead — no stopping!',
  [CrazyEvent.Haunted]: "The fallen don't rest easy!",
  [CrazyEvent.Sacrifice]: 'From loss comes strength!',
  [CrazyEvent.ShrinkingBoard]: 'The walls are closing in!',
  // Event 40 — Meta-event
  [CrazyEvent.DoubleTrouble]: 'Twice the chaos, twice the fun!',
};

/**
 * Human-readable display names for each event.
 * Used by the UI for the active events indicator (Task 10.3, Task 11.3).
 */
export const EVENT_DISPLAY_NAMES: Readonly<Record<CrazyEvent, string>> = {
  // Phase 2 (core events)
  [CrazyEvent.KingForADay]: 'King for a Day',
  [CrazyEvent.LiveGrenade]: 'Live Grenade',
  [CrazyEvent.HotPotato]: 'Hot Potato',
  [CrazyEvent.ChecksMix]: 'Checks Mix',
  [CrazyEvent.OppositeDay]: 'Opposite Day',
  [CrazyEvent.UpInTheAir]: 'Up in the Air',
  [CrazyEvent.NoTouching]: 'No Touching!',
  // Phases 3–4 (Events 8–40)
  [CrazyEvent.StepBack]: 'Step-Back',
  [CrazyEvent.FlippedScript]: 'Flipped Script',
  [CrazyEvent.MarchingOrders]: 'Marching Orders',
  [CrazyEvent.DealersChoice]: "Dealer's Choice",
  [CrazyEvent.Bodyguard]: 'Bodyguard',
  [CrazyEvent.Quicksand]: 'Quicksand',
  [CrazyEvent.Conscription]: 'Conscription',
  [CrazyEvent.GhostWalk]: 'Ghost Walk',
  [CrazyEvent.Landmine]: 'Landmine',
  [CrazyEvent.Leapfrog]: 'Leapfrog',
  [CrazyEvent.FrozenAssets]: 'Frozen Assets',
  [CrazyEvent.DoubleTime]: 'Double Time',
  [CrazyEvent.SafeHaven]: 'Safe Haven',
  [CrazyEvent.ChainReaction]: 'Chain Reaction',
  [CrazyEvent.PromotionParty]: 'Promotion Party',
  [CrazyEvent.Reinforcements]: 'Reinforcements',
  [CrazyEvent.Wormhole]: 'Wormhole',
  [CrazyEvent.Demotion]: 'Demotion',
  [CrazyEvent.TimeBomb]: 'Time Bomb',
  [CrazyEvent.ForcedMarch]: 'Forced March',
  [CrazyEvent.Ricochet]: 'Ricochet',
  [CrazyEvent.CrownThief]: 'Crown Thief',
  [CrazyEvent.Stampede]: 'Stampede',
  [CrazyEvent.TollRoad]: 'Toll Road',
  [CrazyEvent.SwapMeet]: 'Swap Meet',
  [CrazyEvent.RoyalDecree]: 'Royal Decree',
  [CrazyEvent.Backfire]: 'Backfire',
  [CrazyEvent.Sentry]: 'Sentry',
  [CrazyEvent.RushHour]: 'Rush Hour',
  [CrazyEvent.Haunted]: 'Haunted',
  [CrazyEvent.Sacrifice]: 'Sacrifice',
  [CrazyEvent.ShrinkingBoard]: 'Shrinking Board',
  // Event 40 — Meta-event
  [CrazyEvent.DoubleTrouble]: 'Double Trouble',
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
   * Pending event removal requests accumulated during hook execution.
   * Collected by CompositeEventRuleSet after hook chains complete.
   */
  private _pendingRemovals: CrazyEvent[] = [];

  /**
   * Called by subclasses to request removal of a condition-based event
   * after its condition is met (e.g., Live Grenade detonates on capture).
   */
  protected requestEventRemoval(type: CrazyEvent): void {
    this._pendingRemovals.push(type);
  }

  /**
   * Returns and clears all pending removal requests.
   * Called by CompositeEventRuleSet to drain removals from active decorators.
   */
  drainPendingRemovals(): CrazyEvent[] {
    const removals = this._pendingRemovals;
    this._pendingRemovals = [];
    return removals;
  }

  /**
   * The active events context, set by CompositeEventRuleSet when building
   * the decorator chain. Allows decorators to read metadata from their
   * ActiveEvent entries without instance state.
   */
  protected activeEventsContext: readonly ActiveEvent[] = [];

  /**
   * Sets the active events context for this decorator instance.
   * Called by CompositeEventRuleSet after building the chain via withInner().
   */
  setActiveEventsContext(events: readonly ActiveEvent[]): void {
    this.activeEventsContext = events;
  }

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
 * The pool of currently implemented events that can be randomly triggered.
 *
 * Initially contains only KingForADay (Task 8.1). Each subsequent event
 * implementation task (8.2–9.3) adds its event type to this array.
 * This prevents unimplemented events from being selected at random.
 */
export const IMPLEMENTED_EVENTS: readonly CrazyEvent[] = [
  CrazyEvent.KingForADay,
  CrazyEvent.LiveGrenade,
  CrazyEvent.NoTouching,
  CrazyEvent.HotPotato,
  CrazyEvent.ChecksMix,
  CrazyEvent.OppositeDay,
  CrazyEvent.UpInTheAir,
];

/**
 * Meta-events that trigger re-rolls rather than decorator activations.
 * When a meta-event is drawn, selectRandomEvent re-rolls from the regular
 * event pool (IMPLEMENTED_EVENTS minus META_EVENTS).
 *
 * Currently contains only DoubleTrouble (Event 40). In Phase 2, DoubleTrouble
 * is not in IMPLEMENTED_EVENTS, so this code path is never reached — but the
 * architecture is validated and ready for when DoubleTrouble is added.
 */
export const META_EVENTS: readonly CrazyEvent[] = [CrazyEvent.DoubleTrouble] as const;

/**
 * Returns true if the given move is a multi-jump (two or more captures).
 * Multi-jumps are the trigger condition for Crazy mode events (Design Document §2.2).
 */
export function isMultiJump(move: Move): boolean {
  return move.captured.length >= 2;
}

/**
 * Selects one or more random event types from the implemented event pool.
 *
 * Returns a `CrazyEvent[]` — in Phase 2 this is always a single-element array.
 * When Double Trouble is added to IMPLEMENTED_EVENTS (Phase 3 or late Phase 2),
 * drawing it will cause this function to return a two-element array of distinct
 * non-meta events, without requiring any API changes to callers.
 *
 * Draws from IMPLEMENTED_EVENTS rather than the full CrazyEvent enum,
 * so only events with registered decorators can be selected.
 *
 * Accepts an optional random function for testability (dependency injection).
 * The default uses Math.random(). For deterministic replays (Phase 3 Cogitate),
 * a seeded PRNG should be passed.
 */
export function selectRandomEvent(randomFn: () => number = Math.random): CrazyEvent[] {
  // Dev/test-only: check for forced event from __TEST_TRIGGER_EVENT hook.
  // Tree-shaken from production builds via dead-code elimination.
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  const g = globalThis as any;
  if (g.__TEST_FORCED_EVENT != null) {
    const forced: CrazyEvent = g.__TEST_FORCED_EVENT;
    g.__TEST_FORCED_EVENT = null;
    return [forced];
  }
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

  const metaSet = new Set<CrazyEvent>(META_EVENTS);

  const index = Math.floor(randomFn() * IMPLEMENTED_EVENTS.length);
  const drawn = IMPLEMENTED_EVENTS[index] as CrazyEvent;

  // If a meta-event (e.g., DoubleTrouble) is drawn, re-roll twice from the
  // regular pool (excluding meta-events), ensuring the two results differ.
  if (metaSet.has(drawn)) {
    const regularPool = IMPLEMENTED_EVENTS.filter((e) => !metaSet.has(e));
    if (regularPool.length === 0) return [drawn]; // Defensive: no regular events available
    const first = regularPool[Math.floor(randomFn() * regularPool.length)] as CrazyEvent;
    if (regularPool.length === 1) return [first]; // Only one regular event — can't pick two distinct
    let second: CrazyEvent;
    do {
      second = regularPool[Math.floor(randomFn() * regularPool.length)] as CrazyEvent;
    } while (second === first);
    return [first, second];
  }

  return [drawn];
}

/**
 * Determines whether an event should trigger and, if so, which event(s).
 * Called after every move in Crazy mode.
 *
 * Returns a `CrazyEvent[]` on trigger (single-element in Phase 2, potentially
 * two-element when Double Trouble is implemented), or `null` if no trigger.
 */
export function checkEventTrigger(
  move: Move,
  mode: GameMode,
  randomFn: () => number = Math.random,
): CrazyEvent[] | null {
  if (mode === GameMode.Crazy) {
    // Crazy mode: trigger on multi-jumps (2+ captures)
    if (!isMultiJump(move)) return null;
    return selectRandomEvent(randomFn);
  }
  if (mode === GameMode.Chaos) {
    // Chaos mode: trigger on any jump (1+ captures).
    // In Phase 3+, Chaos always forces Double Trouble (two events per trigger).
    if (move.captured.length < 1) return null;
    return selectRandomEvent(randomFn);
  }
  return null;
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
// Event Metadata Factory Registry
// ---------------------------------------------------------------------------

/**
 * Registry of event-specific metadata factories.
 *
 * When an event triggers, makeMove consults this registry to build the
 * event's initial metadata. This keeps event-specific logic out of game.ts
 * and co-located with the decorator that consumes the metadata.
 *
 * Each factory receives the current board state and the color of the player
 * who triggered the event, and returns metadata (or undefined if none needed).
 */
export const EVENT_METADATA_FACTORIES: Map<
  CrazyEvent,
  (board: BoardState, activeColor: PieceColor, randomFn?: () => number, move?: Move) => Readonly<Record<string, unknown>> | undefined
> = new Map();

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
