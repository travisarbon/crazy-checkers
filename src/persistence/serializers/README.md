# Classified Serializer Framework (Task 27.6)

Per-game serializer registry + default encoder for Phase 4 Classified mode.
Every Tier 1–7 game plugs into this framework via `registerClassifiedGame`;
Task 36 (persistence extensions) consumes the registry to write `GameRecord`
payloads and rehydrate `SavedGame` blobs.

See the full plan at:
`../../../../Documentation/Phase 4/Task 27/Task_27_6_Serializer_Framework_and_Schema_Migration_Hook_Plan.md`

## Public surface

All consumers import from `src/persistence/serializers` (the folder index):

- `registerSerializer(serializer)` — direct registration (tests only).
- `registerSerializerForSpec(gameId, serializer)` — the path used by
  `registerClassifiedGame`. Stamps in `gameId` via the legacy adapter when
  absent, throws `SerializerIdentityError` on a mismatch.
- `getSerializer(gameId)` — non-nullable lookup; throws
  `SerializerMissingError` if unregistered.
- `hasSerializer(gameId)` / `listRegisteredSerializers()` — introspection.
- `createDefaultSerializer({ gameId, vocabularyPieceIds })` — factory that
  covers every field of `ClassifiedGameState`. Most Tier 1 / Tier 3–5
  games register this default without writing any per-game code.
- `createSerializerFromLegacyShape(gameId, legacy)` — adapter for Task
  27.4-era `{ version, toJSON, fromJSON }` serializers.
- `CURRENT_SCHEMA_VERSION` / `migrateSerializedEnvelope` — schema-migration
  hook. Task 36.3 replaces the stub body.
- `SerializerEnvelope<S>` — wrapper Task 36 writes to
  `GameRecord.gameSpecificMetadata`: `{ gameId, schemaVersion, payload }`.

## Auto-registration

`registerClassifiedGame(spec)` (see `src/engine/classified/registry.ts`)
registers `spec.ruleSet.serializer` under `spec.gameId` as part of its
atomic registration pipeline. A rollback on any downstream failure also
unregisters the serializer.

## Round-trip guarantees

The default serializer maintains canonical ordering on serialize so two
constructions of an equivalent state produce byte-identical JSON:

- `pieces` entries sorted by `NodeId`.
- `hands.white` / `hands.black` entries sorted alphabetically by pieceId.
- `meta` keys sorted alphabetically (recursive).

Invalid inputs fail loud:

- Unknown `pieceId` in `hands` → `SerializerPieceIdError`.
- `NaN`, `Infinity`, `Date`, `Map`, `Set`, functions in `meta` → `SerializerMetaError`.

Tests live in `__tests__/`; the `roundTrip.ts` harness exports
`assertByteIdenticalRoundTrip` for per-game serializer tests.
