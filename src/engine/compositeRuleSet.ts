/**
 * CompositeEventRuleSet — composes AmericanRules with active event decorators.
 *
 * Used for Crazy mode and Choice mode games. Holds a flat registry of all
 * decorator instances and selectively invokes active ones by building a
 * temporary decorator chain per method call.
 *
 * ## Stacking Interaction Matrix (21 pairwise + 7 self-stacking)
 *
 * | Event A        | Event B        | Interaction |
 * |----------------|----------------|-------------|
 * | KingForADay    | KingForADay    | Newer takes precedence; both tick independently. |
 * | KingForADay    | LiveGrenade    | Independent. All kings AND next capture explodes. |
 * | KingForADay    | HotPotato      | Independent. Piece switches color AND is temp king. |
 * | KingForADay    | ChecksMix      | Shuffle applies to kinged board. Post-shuffle all kinged. |
 * | KingForADay    | OppositeDay    | Independent. All kinged AND win condition inverted. |
 * | KingForADay    | UpInTheAir     | Combined: all pieces have flying king movement. |
 * | KingForADay    | NoTouching     | NoTouching nullified (no pawns during KingForADay). |
 * | LiveGrenade    | LiveGrenade    | Both detonate same capture, same explosion radius. |
 * | LiveGrenade    | HotPotato      | Independent. Piece destruction takes precedence over switch. |
 * | LiveGrenade    | ChecksMix      | Shuffle instant, grenade remains armed post-shuffle. |
 * | LiveGrenade    | OppositeDay    | Independent. Explosion + inverted win condition. |
 * | LiveGrenade    | UpInTheAir     | Independent. Flying captures trigger grenade. |
 * | LiveGrenade    | NoTouching     | Independent. Blocked captures delay grenade. |
 * | HotPotato      | HotPotato      | Newer takes precedence. Double switch = back to original. |
 * | HotPotato      | ChecksMix      | Shuffle instant. HotPotato applies on shuffled board. |
 * | HotPotato      | OppositeDay    | Independent. Color switch + inverted win. |
 * | HotPotato      | UpInTheAir     | Independent. Flying + color switch. |
 * | HotPotato      | NoTouching     | Independent. |
 * | ChecksMix      | ChecksMix      | Two consecutive shuffles. Both removed after apply. |
 * | ChecksMix      | OppositeDay    | Shuffle instant. Opposite Day continues post-shuffle. |
 * | ChecksMix      | UpInTheAir     | Shuffle instant. Flying continues post-shuffle. |
 * | ChecksMix      | NoTouching     | Shuffle instant. Restriction continues post-shuffle. |
 * | OppositeDay    | OppositeDay    | Newer takes precedence. Same effect as one instance. |
 * | OppositeDay    | UpInTheAir     | Independent. Inverted win + flying. |
 * | OppositeDay    | NoTouching     | Independent. Inverted win + capture restriction. |
 * | UpInTheAir     | UpInTheAir     | Newer takes precedence. Same effect as one instance. |
 * | UpInTheAir     | NoTouching     | Independent. Flying pawns still can't capture kings. |
 * | NoTouching     | NoTouching     | Newer takes precedence. Same effect as one instance. |
 */

import type { ActiveEvent, BoardState, GameResult, Move, Piece, PieceColor, RuleSet, Square } from './types';
import type { CrazyEvent } from './types';
import { EventDecorator, EVENT_DECORATOR_REGISTRY } from './events';

// Ensure all event decorators are registered before createCompositeRuleSet is called.
import './events/index';

/**
 * A RuleSet that composes AmericanRules with zero or more active event
 * decorators. Used for Crazy mode and Choice mode games.
 *
 * Unlike a traditional decorator chain where each decorator wraps the next,
 * this class holds a flat registry of all decorator instances and selectively
 * invokes active ones. This design:
 * - Avoids reconstructing the chain when events activate/expire.
 * - Makes the invocation order explicit and controllable.
 * - Supports efficient AI search (the composite is instantiated once per
 *   worker call, and active events are determined from GameState).
 */
export class CompositeEventRuleSet implements RuleSet {
  private readonly base: RuleSet;
  private readonly decoratorMap: ReadonlyMap<CrazyEvent, EventDecorator>;
  private currentActiveEvents: readonly ActiveEvent[] = [];
  private cachedChain: RuleSet | null = null;
  private activeChainDecorators: EventDecorator[] = [];

  constructor(base: RuleSet, decorators: readonly EventDecorator[]) {
    this.base = base;
    this.decoratorMap = new Map(decorators.map((d) => [d.getEventType(), d]));
  }

  /**
   * Sets the active events context for subsequent RuleSet method calls.
   * Must be called before each turn or search invocation.
   * Pre-builds the decorator chain for performance.
   */
  setActiveEvents(events: readonly ActiveEvent[]): void {
    this.currentActiveEvents = events;
    this.cachedChain = null; // invalidate cache
  }

  /** Returns the current active events (for external inspection). */
  getActiveEvents(): readonly ActiveEvent[] {
    return this.currentActiveEvents;
  }

  /**
   * Collects and clears pending removal requests from all active decorators.
   * Called by game.ts after hook chains (onCapture, onTurnEnd) that may
   * trigger condition-based event removal.
   */
  drainPendingRemovals(): CrazyEvent[] {
    const removals: CrazyEvent[] = [];
    for (const decorator of this.activeChainDecorators) {
      removals.push(...decorator.drainPendingRemovals());
    }
    return removals;
  }

  /**
   * Collects the suppress-turn-switch signal from all active decorators.
   * Returns true if any decorator requested suppression.
   * Called by game.ts after onTurnEnd to conditionally skip turn alternation
   * and event ply tick (used by Double Time for two-moves-per-turn).
   */
  drainSuppressTurnSwitch(): boolean {
    for (const decorator of this.activeChainDecorators) {
      if (decorator.drainSuppressTurnSwitch()) return true;
    }
    return false;
  }

  /**
   * Collects and clears pending metadata update requests from all active decorators.
   * Called by game.ts after hook chains (onTurnEnd) that may request
   * metadata updates for active events (e.g., Dealer's Choice skip tracking).
   */
  drainPendingMetadataUpdates(): Array<{ type: CrazyEvent; metadata: Readonly<Record<string, unknown>> }> {
    const updates: Array<{ type: CrazyEvent; metadata: Readonly<Record<string, unknown>> }> = [];
    for (const decorator of this.activeChainDecorators) {
      updates.push(...decorator.drainPendingMetadataUpdates());
    }
    return updates;
  }

  /**
   * Returns the EventDecorator instances that are currently active,
   * based on the provided active events list.
   * Order: matches the order of events in the activeEvents array (oldest first).
   */
  private getActiveDecorators(events: readonly ActiveEvent[]): EventDecorator[] {
    const seen = new Set<CrazyEvent>();
    const active: EventDecorator[] = [];
    for (const e of events) {
      if (seen.has(e.type)) continue;
      seen.add(e.type);
      const decorator = this.decoratorMap.get(e.type);
      if (decorator) active.push(decorator);
    }
    return active;
  }

  /** Builds the active decorator chain: base → decorator1 → decorator2 → ... */
  private buildActiveChain(): RuleSet {
    if (this.cachedChain) return this.cachedChain;

    const activeDecorators = this.getActiveDecorators(this.currentActiveEvents);
    if (activeDecorators.length === 0) {
      this.activeChainDecorators = [];
      this.cachedChain = this.base;
      return this.base;
    }

    const chainDecorators: EventDecorator[] = [];
    let chain: RuleSet = this.base;
    for (const decorator of activeDecorators) {
      const linked = decorator.withInner(chain);
      linked.setActiveEventsContext(this.currentActiveEvents);
      chainDecorators.push(linked);
      chain = linked;
    }
    this.activeChainDecorators = chainDecorators;
    this.cachedChain = chain;
    return chain;
  }

  // --- RuleSet methods ---

  getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    return this.buildActiveChain().getLegalMoves(board, activeColor);
  }

  applyMove(board: BoardState, move: Move): BoardState {
    return this.buildActiveChain().applyMove(board, move);
  }

  checkGameOver(board: BoardState, activeColor: PieceColor): GameResult | null {
    return this.buildActiveChain().checkGameOver(board, activeColor);
  }

  shouldPromote(piece: Piece, sq: Square): boolean {
    return this.buildActiveChain().shouldPromote(piece, sq);
  }

  // --- Optional hooks ---

  onTurnStart(board: BoardState, activeColor: PieceColor): BoardState {
    const chain = this.buildActiveChain();
    return chain.onTurnStart ? chain.onTurnStart(board, activeColor) : board;
  }

  onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    const chain = this.buildActiveChain();
    return chain.onTurnEnd ? chain.onTurnEnd(board, activeColor, move) : board;
  }

  onCapture(board: BoardState, landingSquare: Square, captured: Square[]): BoardState {
    const chain = this.buildActiveChain();
    return chain.onCapture ? chain.onCapture(board, landingSquare, captured) : board;
  }

  onCheckGameOver(
    board: BoardState,
    activeColor: PieceColor,
    baseResult: GameResult | null,
  ): GameResult | null {
    const chain = this.buildActiveChain();
    return chain.onCheckGameOver
      ? chain.onCheckGameOver(board, activeColor, baseResult)
      : baseResult;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a CompositeEventRuleSet with all registered decorators.
 * Used by createNewGame (Task 7.3) and the AI worker (Task 10.2).
 */
export function createCompositeRuleSet(base: RuleSet): CompositeEventRuleSet {
  const decorators = Array.from(EVENT_DECORATOR_REGISTRY.values()).map((factory) => factory(base));
  return new CompositeEventRuleSet(base, decorators);
}
