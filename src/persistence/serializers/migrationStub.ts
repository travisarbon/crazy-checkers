/**
 * Task 27.6 — schema migration hook (stub).
 *
 * Task 36.3 replaces the body with a concrete v3→v4 migration. Today's stub
 * is the identity transform for `CURRENT_SCHEMA_VERSION`; any other call
 * throws `MigrationNotImplementedError`, which Task 36.3 then replaces.
 * The named export is deliberately stable so Task 36.3 can land without
 * touching 27.6's public surface.
 */

import type { SerializerEnvelope, SerializerVersion } from './types';
import { MigrationNotImplementedError } from './errors';

export const CURRENT_SCHEMA_VERSION: SerializerVersion = 1;

export function migrateSerializedEnvelope<S>(
  envelope: SerializerEnvelope<S>,
  toVersion: SerializerVersion,
): SerializerEnvelope<S> {
  // SerializerVersion is pinned to 1 in Phase 4 — `schemaVersion === toVersion`
  // is always true today, but the comparison is authored as a positive check
  // so Task 36.3's version-widening edit reads naturally (the union will grow
  // to `1 | 2` at that point and this branch becomes non-trivial).
  const fromVersion = envelope.schemaVersion as number;
  if (fromVersion === (toVersion as number)) {
    return envelope;
  }
  throw new MigrationNotImplementedError({
    fromVersion,
    toVersion,
    gameId: envelope.gameId,
  });
}
