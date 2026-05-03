import { describe, expect, it } from 'vitest';
import {
  _clearHashTableCacheForTests,
  hashPosition,
  hashToHex,
  hexToHash,
  incrementRepetition,
  repetitionCount,
} from '../custodianZobrist';
import { buildState } from '../testHelpers';
import { createMakYekConfig } from '../makYekConfig';
import { createRekConfig } from '../rekConfig';
import { createHasamiShogiConfig } from '../hasamiShogiConfig';

describe('custodianZobrist — table determinism', () => {
  const config = createMakYekConfig();

  it('hash for the same position is deterministic across rebuild', () => {
    const s = buildState({ config, pieces: { e4: 'm', f4: 'b' } });
    const h1 = hashPosition(s.pieces, 'white', config);
    _clearHashTableCacheForTests();
    const h2 = hashPosition(s.pieces, 'white', config);
    expect(h1).toBe(h2);
  });

  it('side-to-move bit toggles the hash', () => {
    const s = buildState({ config, pieces: { e4: 'm' } });
    expect(hashPosition(s.pieces, 'white', config)).not.toBe(
      hashPosition(s.pieces, 'black', config),
    );
  });
});

describe('custodianZobrist — Rek King distinctness', () => {
  const config = createRekConfig();

  it("Rek's King hashes to a different entry than a Man at the same square", () => {
    const withMan = buildState({ config, pieces: { e4: 'm' } });
    const withKing = buildState({ config, pieces: { e4: 'K' } });
    expect(hashPosition(withMan.pieces, 'white', config)).not.toBe(
      hashPosition(withKing.pieces, 'white', config),
    );
  });
});

describe('custodianZobrist — cross-game seed isolation', () => {
  it('Mak-yek and Hasami Shogi use distinct seeds', () => {
    const mak = createMakYekConfig();
    const hsg = createHasamiShogiConfig();
    const sm = buildState({ config: mak, pieces: { a1: 'm' } });
    const sh = buildState({ config: hsg, pieces: { a1: 'm' } });
    expect(hashPosition(sm.pieces, 'white', mak)).not.toBe(
      hashPosition(sh.pieces, 'white', hsg),
    );
  });
});

describe('custodianZobrist — hex helpers', () => {
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

describe('custodianZobrist — repetition table', () => {
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
