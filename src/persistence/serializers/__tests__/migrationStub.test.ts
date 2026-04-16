import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateSerializedEnvelope } from '../migrationStub';
import { MigrationNotImplementedError } from '../errors';
import type { SerializerEnvelope } from '../types';
import { asClassifiedGameId } from '../../../engine/classified/ClassifiedRuleSet';

const envelope = (
  schemaVersion: 1 = 1,
): SerializerEnvelope => ({
  gameId: asClassifiedGameId('migration-test'),
  schemaVersion,
  payload: { foo: 'bar' },
});

describe('migrateSerializedEnvelope', () => {
  it('is identity for matching version', () => {
    const e = envelope();
    const out = migrateSerializedEnvelope(e, CURRENT_SCHEMA_VERSION);
    expect(out).toBe(e);
  });

  it('throws MigrationNotImplementedError on any non-identity call', () => {
    const e = { ...envelope(), schemaVersion: 0 as unknown as 1 };
    expect(() => migrateSerializedEnvelope(e, CURRENT_SCHEMA_VERSION)).toThrow(
      MigrationNotImplementedError,
    );
    try {
      migrateSerializedEnvelope(e, CURRENT_SCHEMA_VERSION);
    } catch (err) {
      expect(err).toBeInstanceOf(MigrationNotImplementedError);
      const m = err as MigrationNotImplementedError;
      expect(m.fromVersion).toBe(0);
      expect(m.toVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(m.gameId).toBe(asClassifiedGameId('migration-test'));
    }
  });

  it('CURRENT_SCHEMA_VERSION is pinned at 1 for Phase 4 / Task 27.6', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
});
