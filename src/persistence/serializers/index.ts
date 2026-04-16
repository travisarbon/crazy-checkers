/**
 * Task 27.6 — public entry point for the Classified serializer framework.
 *
 * Consumers (Task 36, Task 38, Tier 1–7 authoring) import from this file.
 * The internal `migrationStub` remains addressable for Task 36.3's override.
 */

export type {
  GameStateSerializer,
  RegisteredSerializer,
  SerializerVersion,
  SerializerEnvelope,
  JsonValue,
} from './types';

export {
  registerSerializer,
  registerSerializerForSpec,
  getSerializer,
  hasSerializer,
  listRegisteredSerializers,
  clearSerializers__TEST_ONLY,
  _unregisterSerializer,
} from './registry';

export { createDefaultSerializer } from './default';
export type { DefaultSerializerSpec } from './default';
export { createSerializerFromLegacyShape } from './legacyAdapter';
export { CURRENT_SCHEMA_VERSION, migrateSerializedEnvelope } from './migrationStub';
export { encodePiece, decodePiece } from './defaultPieces';

export {
  SerializerMissingError,
  DuplicateSerializerError,
  SerializerIdentityError,
  MigrationNotImplementedError,
  SerializerPieceIdError,
  SerializerMetaError,
  EnvelopeVersionError,
} from './errors';
