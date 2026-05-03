import { describe, expect, it } from 'vitest';
import {
  _clearHashTableCacheForTests,
  hashPosition,
  hashToHex,
  hexToHash,
  incrementRepetition,
  repetitionCount,
} from '../harzdameZobrist';
import { buildState } from '../testHelpers';
import { createHarzdameConfig } from '../types';

const CFG = createHarzdameConfig();

describe('harzdameZobrist — table determinism', () => {
  it('hash for the same position is deterministic across rebuild', () => {
    const s = buildState({ pieces: { '17': 'm', '14': 'b' } });
    const h1 = hashPosition(s.pieces, 'white', CFG);
    _clearHashTableCacheForTests();
    const h2 = hashPosition(s.pieces, 'white', CFG);
    expect(h1).toBe(h2);
  });

  it('side-to-move bit toggles the hash', () => {
    const s = buildState({ pieces: { '17': 'm' } });
    expect(hashPosition(s.pieces, 'white', CFG)).not.toBe(
      hashPosition(s.pieces, 'black', CFG),
    );
  });

  it('senior king hashes differently from regular king at the same square', () => {
    const reg = buildState({ pieces: { '17': 'M' } });
    const sen = buildState({ pieces: { '17': 'S' } });
    expect(hashPosition(reg.pieces, 'white', CFG)).not.toBe(
      hashPosition(sen.pieces, 'white', CFG),
    );
  });

  it('man / regular-king / senior-king all hash differently at the same square', () => {
    const m = buildState({ pieces: { '17': 'm' } });
    const k = buildState({ pieces: { '17': 'M' } });
    const s = buildState({ pieces: { '17': 'S' } });
    const set = new Set([
      hashPosition(m.pieces, 'white', CFG),
      hashPosition(k.pieces, 'white', CFG),
      hashPosition(s.pieces, 'white', CFG),
    ]);
    expect(set.size).toBe(3);
  });
});

describe('harzdameZobrist — hex helpers', () => {
  it('hashToHex pads to 16 chars', () => {
    expect(hashToHex(0n)).toBe('0000000000000000');
    expect(hashToHex(0xffffffffffffffffn)).toBe('ffffffffffffffff');
  });

  it('hexToHash inverts hashToHex', () => {
    expect(hexToHash(hashToHex(0x1234567890abcdefn))).toBe(0x1234567890abcdefn);
  });
});

describe('harzdameZobrist — repetition table', () => {
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
