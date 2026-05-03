import { describe, expect, it } from 'vitest';
import {
  _clearHashTableCacheForTests,
  hashPosition,
  hashToHex,
  hexToHash,
  incrementRepetition,
  repetitionCount,
} from '../linearZobrist';
import { buildState, configFor } from '../testHelpers';

describe('linearZobrist — table determinism', () => {
  const config = configFor('dameo');

  it('hash for the same position is deterministic across rebuild', () => {
    const s = buildState({ config, turn: 'white', pieces: { e3: 'm', e6: 'b' } });
    const h1 = hashPosition(s.pieces, 'white', config);
    _clearHashTableCacheForTests();
    const h2 = hashPosition(s.pieces, 'white', config);
    expect(h1).toBe(h2);
  });

  it('side-to-move bit toggles the hash', () => {
    const s = buildState({ config, turn: 'white', pieces: { e3: 'm' } });
    const w = hashPosition(s.pieces, 'white', config);
    const b = hashPosition(s.pieces, 'black', config);
    expect(w).not.toBe(b);
  });

  it('different commanders hash differently', () => {
    const a = buildState({ config, pieces: { e3: 'm' } });
    const b = buildState({ config, pieces: { e3: 'M' } });
    const c = buildState({ config, pieces: { e3: 'b' } });
    const d = buildState({ config, pieces: { e3: 'B' } });
    const ha = hashPosition(a.pieces, 'white', config);
    const hb = hashPosition(b.pieces, 'white', config);
    const hc = hashPosition(c.pieces, 'white', config);
    const hd = hashPosition(d.pieces, 'white', config);
    expect(new Set([ha, hb, hc, hd]).size).toBe(4);
  });

  it('hashToHex pads to 16 chars', () => {
    expect(hashToHex(0n)).toBe('0000000000000000');
    expect(hashToHex(0xffn)).toBe('00000000000000ff');
    expect(hashToHex(0xffffffffffffffffn)).toBe('ffffffffffffffff');
  });

  it('hexToHash inverts hashToHex', () => {
    const orig = 0x1234567890abcdefn;
    expect(hexToHash(hashToHex(orig))).toBe(orig);
  });
});

describe('linearZobrist — repetition table', () => {
  it('first insertion creates a count-1 entry', () => {
    const t1 = incrementRepetition([], 0xabcn);
    expect(repetitionCount(t1, 0xabcn)).toBe(1);
    expect(repetitionCount(t1, 0xdefn)).toBe(0);
  });

  it('subsequent insertions increment count', () => {
    let table: readonly (readonly [string, number])[] = [];
    table = incrementRepetition(table, 0xabcn);
    table = incrementRepetition(table, 0xabcn);
    table = incrementRepetition(table, 0xabcn);
    expect(repetitionCount(table, 0xabcn)).toBe(3);
  });

  it('input table is never mutated', () => {
    const original: readonly (readonly [string, number])[] = [
      Object.freeze([hashToHex(0x123n), 1]),
    ];
    const copy = JSON.parse(JSON.stringify(original)) as readonly (readonly [string, number])[];
    incrementRepetition(original, 0x456n);
    expect(JSON.parse(JSON.stringify(original))).toEqual(copy);
  });
});
