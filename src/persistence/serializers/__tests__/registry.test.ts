import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSerializers__TEST_ONLY,
  getSerializer,
  hasSerializer,
  listRegisteredSerializers,
  registerSerializer,
  registerSerializerForSpec,
  _unregisterSerializer,
} from '../registry';
import {
  DuplicateSerializerError,
  SerializerIdentityError,
  SerializerMissingError,
} from '../errors';
import { asClassifiedGameId } from '../../../engine/classified/ClassifiedRuleSet';
import type { GameStateSerializer, RegisteredSerializer } from '../types';

const gidA = asClassifiedGameId('test-reg-a');
const gidB = asClassifiedGameId('test-reg-b');

function fixture(gameId = gidA): RegisteredSerializer {
  return {
    gameId,
    version: 1,
    toJSON: () => null,
    fromJSON: () => ({ pieces: new Map() }),
  };
}

afterEach(() => {
  clearSerializers__TEST_ONLY();
});

describe('SerializerRegistry', () => {
  it('get after register returns the same reference', () => {
    const s = fixture();
    registerSerializer(s);
    expect(getSerializer(gidA)).toBe(s);
  });

  it('hasSerializer reports presence', () => {
    expect(hasSerializer(gidA)).toBe(false);
    registerSerializer(fixture());
    expect(hasSerializer(gidA)).toBe(true);
  });

  it('re-registering the identical serializer is a no-op', () => {
    const s = fixture();
    registerSerializer(s);
    registerSerializer(s);
    expect(getSerializer(gidA)).toBe(s);
  });

  it('re-registering a different serializer under the same gameId throws', () => {
    registerSerializer(fixture());
    expect(() => {
      registerSerializer(fixture());
    }).toThrow(DuplicateSerializerError);
  });

  it('getSerializer on an unregistered id throws SerializerMissingError', () => {
    expect(() => getSerializer(gidA)).toThrow(SerializerMissingError);
    try {
      getSerializer(gidA);
    } catch (err) {
      expect(err).toBeInstanceOf(SerializerMissingError);
      expect((err as SerializerMissingError).gameId).toBe(gidA);
      expect((err as SerializerMissingError).operation).toBe('deserialize');
    }
  });

  it('list preserves insertion order', () => {
    const ids: ReturnType<typeof asClassifiedGameId>[] = [];
    for (let i = 0; i < 20; i += 1) {
      const gid = asClassifiedGameId(`test-order-${String(i)}`);
      ids.push(gid);
      registerSerializer({
        gameId: gid,
        version: 1,
        toJSON: () => null,
        fromJSON: () => ({ pieces: new Map() }),
      });
    }
    expect(listRegisteredSerializers()).toEqual(ids);
  });

  it('clearSerializers__TEST_ONLY empties the registry', () => {
    registerSerializer(fixture());
    clearSerializers__TEST_ONLY();
    expect(listRegisteredSerializers()).toEqual([]);
    expect(() => getSerializer(gidA)).toThrow(SerializerMissingError);
  });

  it('_unregisterSerializer removes a single entry', () => {
    registerSerializer(fixture(gidA));
    registerSerializer(fixture(gidB));
    _unregisterSerializer(gidA);
    expect(hasSerializer(gidA)).toBe(false);
    expect(hasSerializer(gidB)).toBe(true);
  });
});

describe('registerSerializerForSpec (identity guard + legacy stamping)', () => {
  it('stamps gameId on a legacy serializer with no gameId', () => {
    const legacy: GameStateSerializer = {
      version: 1,
      toJSON: () => null,
      fromJSON: () => ({ pieces: new Map() }),
    };
    const registered = registerSerializerForSpec(gidA, legacy);
    expect(registered.gameId).toBe(gidA);
    expect(hasSerializer(gidA)).toBe(true);
    expect(getSerializer(gidA).toJSON).toBe(legacy.toJSON);
  });

  it('rejects a serializer whose gameId mismatches the spec', () => {
    const serializer: RegisteredSerializer = fixture(gidB);
    expect(() => registerSerializerForSpec(gidA, serializer)).toThrow(
      SerializerIdentityError,
    );
  });

  it('passes through a serializer whose gameId matches the spec', () => {
    const serializer = fixture(gidA);
    const registered = registerSerializerForSpec(gidA, serializer);
    expect(registered).toBe(serializer);
  });

  it('re-registration with a fresh legacy wrap but same underlying functions is idempotent', () => {
    const legacy: GameStateSerializer = {
      version: 1,
      toJSON: () => null,
      fromJSON: () => ({ pieces: new Map() }),
    };
    registerSerializerForSpec(gidA, legacy);
    // A second call builds a new wrapper object but the inner toJSON/fromJSON
    // references still match — registry accepts it without a duplicate throw.
    const second = registerSerializerForSpec(gidA, legacy);
    expect(second.toJSON).toBe(legacy.toJSON);
  });
});
