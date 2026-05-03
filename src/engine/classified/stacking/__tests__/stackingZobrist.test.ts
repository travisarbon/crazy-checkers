import { describe, expect, it } from 'vitest';
import {
  _clearHashTableCacheForTests,
  hashPosition,
  hashToHex,
  hexToHash,
  incrementRepetition,
  repetitionCount,
} from '../stackingZobrist';
import { configFor, buildState } from '../testHelpers';

describe('stackingZobrist — table determinism', () => {
  it('hash for the same position is deterministic across rebuild', () => {
    const cfg = configFor('lasca');
    const s = buildState({ config: cfg, turn: 'white', pieces: { '1': 'b', '25': 'm' } });
    const h1 = hashPosition(s.pieces, 'white', cfg);
    _clearHashTableCacheForTests();
    const h2 = hashPosition(s.pieces, 'white', cfg);
    expect(h1).toBe(h2);
  });

  it('side-to-move bit toggles the hash', () => {
    const cfg = configFor('lasca');
    const s = buildState({ config: cfg, turn: 'white', pieces: { '1': 'b', '25': 'm' } });
    const w = hashPosition(s.pieces, 'white', cfg);
    const b = hashPosition(s.pieces, 'black', cfg);
    expect(w).not.toBe(b);
  });

  it('Lasca and Bashni use distinct seed tables (no cross-game collisions for trivial pos)', () => {
    const lasca = configFor('lasca');
    const bashni = configFor('bashni');
    const sl = buildState({ config: lasca, pieces: { '1': 'm' } });
    const sb = buildState({ config: bashni, pieces: { '1': 'm' } });
    const hl = hashPosition(sl.pieces, 'white', lasca);
    const hb = hashPosition(sb.pieces, 'white', bashni);
    expect(hl).not.toBe(hb);
  });

  it('different commanders hash differently', () => {
    const cfg = configFor('lasca');
    const a = buildState({ config: cfg, pieces: { '13': 'm' } });
    const b = buildState({ config: cfg, pieces: { '13': 'M' } });
    const c = buildState({ config: cfg, pieces: { '13': 'b' } });
    const d = buildState({ config: cfg, pieces: { '13': 'B' } });
    const ha = hashPosition(a.pieces, 'white', cfg);
    const hb = hashPosition(b.pieces, 'white', cfg);
    const hc = hashPosition(c.pieces, 'white', cfg);
    const hd = hashPosition(d.pieces, 'white', cfg);
    const set = new Set([ha, hb, hc, hd]);
    expect(set.size).toBe(4);
  });
});

describe('stackingZobrist — commander-only approximation (documented limit)', () => {
  it('two positions with identical commanders but different prisoners hash equal', () => {
    const cfg = configFor('lasca');
    // Same commander layout (white-man at "13") but different prisoners.
    const a = buildState({ config: cfg, pieces: { '13': 'bbm' } }); // top is 'm' (white-man)
    const b = buildState({ config: cfg, pieces: { '13': 'BBm' } }); // top is 'm' (white-man)
    const ha = hashPosition(a.pieces, 'white', cfg);
    const hb = hashPosition(b.pieces, 'white', cfg);
    expect(ha).toBe(hb);
  });
});

describe('stackingZobrist — hex round-trip', () => {
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

describe('stackingZobrist — repetition table', () => {
  it('first insertion creates a count-1 entry', () => {
    const t1 = incrementRepetition([], 0xabcn);
    expect(repetitionCount(t1, 0xabcn)).toBe(1);
    expect(repetitionCount(t1, 0xdefn)).toBe(0);
  });

  it('subsequent insertions of the same hash increment the count', () => {
    let table: readonly (readonly [string, number])[] = [];
    table = incrementRepetition(table, 0xabcn);
    table = incrementRepetition(table, 0xabcn);
    table = incrementRepetition(table, 0xabcn);
    expect(repetitionCount(table, 0xabcn)).toBe(3);
  });

  it('table stays sorted lexicographically by hex key', () => {
    let table: readonly (readonly [string, number])[] = [];
    table = incrementRepetition(table, 0xff00n);
    table = incrementRepetition(table, 0x0011n);
    table = incrementRepetition(table, 0x00ffn);
    const keys = table.map(([h]) => h);
    expect(keys).toEqual([...keys].sort());
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
