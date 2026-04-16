/**
 * Task 27.6 — compile-time assertions over the serializer surface.
 *
 * This file is type-checked but runs no assertions. Any accidental widening
 * of `SerializerVersion`, `JsonValue`, or `SerializerEnvelope<S>` produces
 * a TypeScript error here at CI time.
 */

import type {
  GameStateSerializer,
  JsonValue,
  RegisteredSerializer,
  SerializerEnvelope,
  SerializerVersion,
} from './types';
import type { ClassifiedGameId } from '../../engine/classified/ClassifiedRuleSet';
import type { ClassifiedGameState } from '../../engine/classified/state';

type Assert<T extends true> = T;
type Equals<A, B> =
  [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// SerializerVersion is pinned to the literal 1 for Phase 4.
export type _VersionIsLiteralOne = Assert<Equals<SerializerVersion, 1>>;

// JsonValue excludes undefined, Date, Map, Set, bigint.
type _Rejects_undefined = Assert<Equals<undefined extends JsonValue ? true : false, false>>;
type _Rejects_Date = Assert<Equals<Date extends JsonValue ? true : false, false>>;
type _Rejects_Map = Assert<Equals<Map<string, unknown> extends JsonValue ? true : false, false>>;
type _Accepts_Primitives = Assert<Equals<string extends JsonValue ? true : false, true>>;

// SerializerEnvelope gameId is branded and schemaVersion is the literal union.
type _EnvelopeGameIdIsBranded = Assert<
  Equals<SerializerEnvelope['gameId'], ClassifiedGameId>
>;
type _EnvelopeSchemaVersionIsPinned = Assert<
  Equals<SerializerEnvelope['schemaVersion'], SerializerVersion>
>;

// RegisteredSerializer narrows gameId from optional to required.
type _RegisteredHasRequiredGameId = Assert<
  Equals<RegisteredSerializer['gameId'], ClassifiedGameId>
>;

// A Task 27.4-legacy serializer (no gameId) still assigns to GameStateSerializer.
export const _legacyShape: GameStateSerializer = {
  version: 1,
  toJSON: () => null,
  fromJSON: () => ({ pieces: new Map() }),
};
// Explicit reference so tsc knows ClassifiedGameState is imported intentionally.
export type _StateRef = ClassifiedGameState;

export type _KeepTypesReferenced = [
  _VersionIsLiteralOne,
  _Rejects_undefined,
  _Rejects_Date,
  _Rejects_Map,
  _Accepts_Primitives,
  _EnvelopeGameIdIsBranded,
  _EnvelopeSchemaVersionIsPinned,
  _RegisteredHasRequiredGameId,
];
