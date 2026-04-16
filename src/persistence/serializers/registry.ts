/**
 * Task 27.6 — module-level serializer registry.
 *
 * Per-game serializer lookup. Keyed by `ClassifiedGameId`. Insertion order is
 * preserved so debug dumps interleave with `listClassifiedGameIds()` 1:1.
 *
 * Registration happens exclusively through `registerClassifiedGame(spec)`
 * (see `src/engine/classified/registry.ts`) — this module exports the
 * primitives that wiring uses. Direct `registerSerializer` calls are for
 * tests only (covered by `__tests__/registry.test.ts`).
 */

import type { ClassifiedGameId } from '../../engine/classified/ClassifiedRuleSet';
import type { GameStateSerializer, RegisteredSerializer } from './types';
import {
  DuplicateSerializerError,
  SerializerIdentityError,
  SerializerMissingError,
} from './errors';
import { createSerializerFromLegacyShape } from './legacyAdapter';

const registry = new Map<ClassifiedGameId, RegisteredSerializer>();

/**
 * Registers a serializer under its `gameId`. Idempotent on identical
 * references; throws `DuplicateSerializerError` on a different serializer
 * reaching the same `gameId`.
 *
 * The serializer must carry its `gameId`; callers that hold a legacy
 * Task 27.4 shape should route through `registerSerializerForSpec` which
 * runs the identity guard and stamps in the `gameId` via the legacy adapter.
 */
export function registerSerializer(serializer: RegisteredSerializer): void {
  const existing = registry.get(serializer.gameId);
  if (existing !== undefined) {
    if (existing === serializer) return;
    throw new DuplicateSerializerError({
      gameId: serializer.gameId,
      existing,
      incoming: serializer,
    });
  }
  registry.set(serializer.gameId, serializer);
}

/**
 * Registers the serializer attached to a registration spec. Runs the
 * identity guard (rejects a serializer whose `gameId` mismatches the spec)
 * and stamps in `gameId` via the legacy adapter if the serializer lacks one.
 *
 * Invoked by `registerClassifiedGame` in `src/engine/classified/registry.ts`.
 */
export function registerSerializerForSpec(
  specGameId: ClassifiedGameId,
  serializer: GameStateSerializer,
): RegisteredSerializer {
  let normalized: RegisteredSerializer;
  if (serializer.gameId === undefined) {
    normalized = createSerializerFromLegacyShape(specGameId, serializer);
  } else if (serializer.gameId !== specGameId) {
    throw new SerializerIdentityError({
      expectedGameId: specGameId,
      actualGameId: serializer.gameId,
    });
  } else {
    normalized = serializer as RegisteredSerializer;
  }

  const existing = registry.get(specGameId);
  if (existing !== undefined && existing !== normalized) {
    // Same-spec re-registration with a fresh legacy-wrapped object:
    // allow if the underlying toJSON/fromJSON references match.
    if (existing.toJSON === normalized.toJSON && existing.fromJSON === normalized.fromJSON) {
      return existing;
    }
    throw new DuplicateSerializerError({
      gameId: specGameId,
      existing,
      incoming: normalized,
    });
  }
  registry.set(specGameId, normalized);
  return normalized;
}

/**
 * Fetches the serializer for a `gameId`. Non-nullable return — throws
 * `SerializerMissingError` if unregistered. Callers that want the branching
 * form should use `hasSerializer` first.
 */
export function getSerializer(gameId: ClassifiedGameId): RegisteredSerializer {
  const s = registry.get(gameId);
  if (s === undefined) {
    throw new SerializerMissingError({ gameId, operation: 'deserialize' });
  }
  return s;
}

export function hasSerializer(gameId: ClassifiedGameId): boolean {
  return registry.has(gameId);
}

export function listRegisteredSerializers(): readonly ClassifiedGameId[] {
  return [...registry.keys()];
}

/**
 * Test-only reset. Named verbosely so any accidental production reference
 * fails code review. Consumed by `beforeEach(clearSerializers__TEST_ONLY)`.
 */
export function clearSerializers__TEST_ONLY(): void {
  registry.clear();
}

/** Internal accessor used by the classified registry to unregister on rollback. */
export function _unregisterSerializer(gameId: ClassifiedGameId): void {
  registry.delete(gameId);
}
