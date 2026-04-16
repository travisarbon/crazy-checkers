/**
 * Task 27.6 — Serializer framework types.
 *
 * Extends the Task 27.4 `GameStateSerializer<S>` shape additively: adds a
 * `gameId` identity field, the `SerializerEnvelope<S>` wrapper consumed by
 * Task 36 persistence, and an optional per-game `migrate` hook that Task 36.3
 * will populate. Every Task 27.4 registration continues to compile because
 * `gameId` and `migrate` are optional on the extended surface; the registry
 * stamps `gameId` at registration time via the legacy adapter if missing.
 *
 * See ../../../Documentation/Phase 4/Task 27/Task_27_6_Serializer_Framework_and_Schema_Migration_Hook_Plan.md
 */

import type { ClassifiedGameId } from '../../engine/classified/ClassifiedRuleSet';
import type { ClassifiedGameState } from '../../engine/classified/state';

/** Closed version union; Phase 4 lands v1. Expansion phases widen this union. */
export type SerializerVersion = 1;

/** JSON-safe payload; the whole recursive shape of anything the framework encodes. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * Envelope written into GameRecord.gameSpecificMetadata (Task 36.1) and into
 * the SavedGame blob (Task 36.4). Version lives at the envelope level so
 * per-game payload shapes can evolve independently of the framework schema.
 */
export interface SerializerEnvelope<S = ClassifiedGameState> {
  readonly gameId: ClassifiedGameId;
  readonly schemaVersion: SerializerVersion;
  readonly payload: JsonValue;
  /** Phantom field to preserve `S` at type level without runtime cost. */
  readonly __stateType?: S;
}

/**
 * Extended serializer contract. `gameId` and `migrate` are optional so every
 * Task 27.4 registrant compiles; `registerClassifiedGame` (Task 27.4) stamps
 * `gameId` at registration via `createSerializerFromLegacyShape` when absent.
 */
export interface GameStateSerializer<S = ClassifiedGameState> {
  readonly gameId?: ClassifiedGameId;
  readonly version: SerializerVersion;
  // `unknown` (not `JsonValue`) preserves compatibility with Task 27.4-era
  // serializers whose return shapes use branded primitives (`NodeId`). The
  // default serializer below tightens its own internal types to `JsonValue`.
  readonly toJSON: (state: S) => unknown;
  readonly fromJSON: (json: unknown) => S;
  readonly migrate?: (json: unknown, fromVersion: SerializerVersion) => unknown;
}

/**
 * Registered serializer — same as `GameStateSerializer` but with `gameId`
 * required. The registry only stores serializers in this shape.
 */
export interface RegisteredSerializer<S = ClassifiedGameState>
  extends GameStateSerializer<S> {
  readonly gameId: ClassifiedGameId;
}
