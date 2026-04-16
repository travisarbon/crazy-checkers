import { describe, expect, it } from 'vitest';
import {
  DuplicateSerializerError,
  EnvelopeVersionError,
  MigrationNotImplementedError,
  SerializerIdentityError,
  SerializerMetaError,
  SerializerMissingError,
  SerializerPieceIdError,
} from '../errors';
import { asClassifiedGameId } from '../../../engine/classified/ClassifiedRuleSet';
import type { RegisteredSerializer } from '../types';

const gid = asClassifiedGameId('test-err');
const otherGid = asClassifiedGameId('test-err-other');

const mockSerializer = (gameId = gid): RegisteredSerializer => ({
  gameId,
  version: 1,
  toJSON: () => null,
  fromJSON: () => ({ pieces: new Map() }),
});

describe('serializer typed errors', () => {
  it('SerializerMissingError carries gameId + operation and has stable name', () => {
    const err = new SerializerMissingError({ gameId: gid, operation: 'deserialize' });
    expect(err.name).toBe('SerializerMissingError');
    expect(err.gameId).toBe(gid);
    expect(err.operation).toBe('deserialize');
    expect(err.message).toContain('test-err');
    expect(err instanceof Error).toBe(true);
  });

  it('DuplicateSerializerError carries both serializer references', () => {
    const a = mockSerializer();
    const b = mockSerializer();
    const err = new DuplicateSerializerError({ gameId: gid, existing: a, incoming: b });
    expect(err.name).toBe('DuplicateSerializerError');
    expect(err.existing).toBe(a);
    expect(err.incoming).toBe(b);
  });

  it('SerializerIdentityError distinguishes expected vs actual', () => {
    const err = new SerializerIdentityError({ expectedGameId: gid, actualGameId: otherGid });
    expect(err.name).toBe('SerializerIdentityError');
    expect(err.expectedGameId).toBe(gid);
    expect(err.actualGameId).toBe(otherGid);
    expect(err.message).toContain('test-err');
    expect(err.message).toContain('test-err-other');
  });

  it('MigrationNotImplementedError carries version bounds', () => {
    const err = new MigrationNotImplementedError({ fromVersion: 2, toVersion: 4, gameId: gid });
    expect(err.name).toBe('MigrationNotImplementedError');
    expect(err.fromVersion).toBe(2);
    expect(err.toVersion).toBe(4);
    expect(err.gameId).toBe(gid);
    expect(err.message).toMatch(/2.*→.*4/);
  });

  it('SerializerPieceIdError carries the unknown id and the registered list', () => {
    const err = new SerializerPieceIdError({
      gameId: gid,
      unknownPieceId: 'ghost',
      registeredPieceIds: ['pawn', 'king'],
    });
    expect(err.name).toBe('SerializerPieceIdError');
    expect(err.unknownPieceId).toBe('ghost');
    expect(err.registeredPieceIds).toEqual(['pawn', 'king']);
    expect(err.message).toContain('ghost');
    expect(err.message).toContain('pawn');
  });

  it('SerializerMetaError carries the meta key path', () => {
    const err = new SerializerMetaError({
      gameId: gid,
      metaKey: 'meta.badKey',
      value: new Date(),
    });
    expect(err.name).toBe('SerializerMetaError');
    expect(err.metaKey).toBe('meta.badKey');
  });

  it('EnvelopeVersionError reports both the envelope and the registry version', () => {
    const err = new EnvelopeVersionError({
      gameId: gid,
      envelopeVersion: 2,
      registryVersion: 1,
    });
    expect(err.name).toBe('EnvelopeVersionError');
    expect(err.envelopeVersion).toBe(2);
    expect(err.registryVersion).toBe(1);
  });
});
