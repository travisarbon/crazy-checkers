import { describe, expect, it } from 'vitest';
import {
  _clearHashTableCacheForTests,
  hashPosition,
  hashToHex,
  hexToHash,
  incrementRepetition,
  repetitionCount,
} from '../cheskersZobrist';
import { buildState } from '../testHelpers';
import { createCheskersConfig } from '../types';

const CFG = createCheskersConfig();

describe('cheskersZobrist — table determinism', () => {
  it('hash for the same position is deterministic across rebuild', () => {
    const s = buildState({ pieces: { d4: 'P', e5: 'p' } });
    const h1 = hashPosition(s.pieces, 'white', CFG);
    _clearHashTableCacheForTests();
    const h2 = hashPosition(s.pieces, 'white', CFG);
    expect(h1).toBe(h2);
  });

  it('side-to-move bit toggles the hash', () => {
    const s = buildState({ pieces: { d4: 'P' } });
    expect(hashPosition(s.pieces, 'white', CFG)).not.toBe(
      hashPosition(s.pieces, 'black', CFG),
    );
  });

  it('all 4 piece kinds at the same square hash differently', () => {
    const a = buildState({ pieces: { d4: 'P' } });
    const b = buildState({ pieces: { d4: 'K' } });
    const c = buildState({ pieces: { d4: 'B' } });
    const d = buildState({ pieces: { d4: 'C' } });
    const set = new Set([
      hashPosition(a.pieces, 'white', CFG),
      hashPosition(b.pieces, 'white', CFG),
      hashPosition(c.pieces, 'white', CFG),
      hashPosition(d.pieces, 'white', CFG),
    ]);
    expect(set.size).toBe(4);
  });

  it('white vs black at same square hash differently for each kind', () => {
    for (const kindPair of [
      ['P', 'p'],
      ['K', 'k'],
      ['B', 'b'],
      ['C', 'c'],
    ]) {
      const w = buildState({ pieces: { d4: kindPair[0] as string } });
      const b = buildState({ pieces: { d4: kindPair[1] as string } });
      expect(hashPosition(w.pieces, 'white', CFG)).not.toBe(
        hashPosition(b.pieces, 'white', CFG),
      );
    }
  });
});

describe('cheskersZobrist — hex helpers', () => {
  it('hashToHex pads to 16 chars', () => {
    expect(hashToHex(0n)).toBe('0000000000000000');
    expect(hashToHex(0xffffffffffffffffn)).toBe('ffffffffffffffff');
  });

  it('hexToHash inverts hashToHex', () => {
    expect(hexToHash(hashToHex(0x1234567890abcdefn))).toBe(0x1234567890abcdefn);
  });
});

describe('cheskersZobrist — repetition table', () => {
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
      Object.freeze<readonly [string, number]>([hashToHex(0x123n), 1]),
    ];
    const copy = JSON.parse(JSON.stringify(original)) as readonly (readonly [string, number])[];
    incrementRepetition(original, 0x456n);
    expect(JSON.parse(JSON.stringify(original))).toEqual(copy);
  });
});
