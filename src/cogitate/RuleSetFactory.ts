/**
 * RuleSetFactory — mode-to-RuleSet factory registry (Task 21.1).
 *
 * Used by the web worker to reconstruct RuleSet instances from a serialized
 * mode identifier (+ optional serialized events). RuleSet objects contain
 * methods and cannot be passed via postMessage.
 */

import type { ActiveEvent, CrazyEvent, PieceColor, RuleSet } from '../engine/types';
import { createAmericanRules } from '../engine/rules';
import { createCompositeRuleSet } from '../engine/compositeRuleSet';
import type { SerializedActiveEvent } from '../persistence/serialization';
import { CHOICE_MODE_DATA } from '../persistence/choiceModeData';
import { choiceDisplayNameToId } from './adapters/choiceAdapter';

export type RuleSetFactoryFn = (
  eventContext?: readonly SerializedActiveEvent[],
) => RuleSet;

const factories = new Map<string, RuleSetFactoryFn>();

export function registerRuleSetFactory(modeId: string, factory: RuleSetFactoryFn): void {
  factories.set(modeId, factory);
}

export function hasRuleSetFactory(modeId: string): boolean {
  return factories.has(modeId);
}

export function createRuleSet(
  modeId: string,
  eventContext?: readonly SerializedActiveEvent[],
): RuleSet {
  const factory = factories.get(modeId);
  if (!factory) {
    throw new Error(`No rule set factory registered for mode: ${modeId}`);
  }
  return factory(eventContext);
}

/** Test-only utility to clear the registry. */
export function _clearRuleSetFactoryRegistry(): void {
  factories.clear();
}

// ---------------------------------------------------------------------------
// Registered factories (Phase 3)
// ---------------------------------------------------------------------------

function deserializeEvents(events: readonly SerializedActiveEvent[]): ActiveEvent[] {
  return events.map((e) => ({
    type: e.type as CrazyEvent,
    remainingPlies: e.remainingPlies,
    triggeredBy: e.triggeredBy as PieceColor,
    triggeredAtPly: e.triggeredAtPly,
    ...(e.metadata !== undefined ? { metadata: e.metadata } : {}),
  }));
}

function classicFactory(): RuleSet {
  return createAmericanRules();
}

function crazyFactoryFactory(): RuleSetFactoryFn {
  return (events?: readonly SerializedActiveEvent[]): RuleSet => {
    const composite = createCompositeRuleSet(createAmericanRules());
    composite.setActiveEvents(events ? deserializeEvents(events) : []);
    return composite;
  };
}

function choiceFactoryFactory(permanentEvent: CrazyEvent | null): RuleSetFactoryFn {
  return (events?: readonly SerializedActiveEvent[]): RuleSet => {
    const composite = createCompositeRuleSet(createAmericanRules());
    const deserialized = events ? deserializeEvents(events) : [];

    // Prefer the caller-provided permanent event entry when present —
    // it carries live metadata (MarchingOrders.orthogonalGrid,
    // Wormhole.portals, TimeBomb countdown, Haunted.ghosts, etc.).
    // Without this the AI worker would rebuild the permanent event
    // from scratch without metadata, its ruleSet would diverge from
    // the client's, and the move it returns could be rejected by the
    // client's legality check — which silently aborts the AI turn.
    const providedPermanent =
      permanentEvent !== null
        ? deserialized.find((e) => e.type === permanentEvent)
        : undefined;

    const combined: ActiveEvent[] = [];
    if (permanentEvent != null) {
      combined.push(
        providedPermanent ?? {
          type: permanentEvent,
          remainingPlies: -1,
          triggeredBy: 'WHITE' as PieceColor,
          triggeredAtPly: 0,
          permanent: true,
        },
      );
    }
    for (const e of deserialized) {
      if (permanentEvent == null || e.type !== permanentEvent) combined.push(e);
    }
    composite.setActiveEvents(combined);
    return composite;
  };
}

let registered = false;

/** Registers Phase 3 factories. Idempotent. */
export function registerPhase3RuleSetFactories(): void {
  if (registered) return;
  registered = true;
  registerRuleSetFactory('classic', classicFactory);
  registerRuleSetFactory('crazy', crazyFactoryFactory());
  registerRuleSetFactory('chaos', crazyFactoryFactory());
  for (const def of CHOICE_MODE_DATA) {
    registerRuleSetFactory(
      choiceDisplayNameToId(def.displayName),
      choiceFactoryFactory(def.event),
    );
  }
}

registerPhase3RuleSetFactories();

/** Test-only: reset the registered flag so factories can be re-registered. */
export function _resetRuleSetFactoryRegistration(): void {
  registered = false;
}
