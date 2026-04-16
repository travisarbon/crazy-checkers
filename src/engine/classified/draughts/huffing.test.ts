/**
 * huffing — candidate detection + applyHuff semantics for Malaysian.
 */

import { describe, expect, it } from 'vitest';
import { asNodeId } from '../../boardGeometry';
import {
  createMalaysianCheckersConfig,
  createRussianDraughtsConfig,
} from './DraughtsConfig';
import { findHuffingCandidates, applyHuff } from './huffing';
import { makeState } from './testHelpers';
import { boardSizeOf } from './DraughtsConfig';

describe('findHuffingCandidates — Malaysian', () => {
  const config = createMalaysianCheckersConfig();

  it('returns empty when no mover piece has a jump available', () => {
    const state = makeState(
      config,
      [{ row: 7, col: 0, owner: 'white', kind: 'man' }],
      'white',
    );
    expect(findHuffingCandidates(state, config)).toEqual([]);
  });

  it('returns the single node of a piece that had a jump', () => {
    // (7,0) dark: 7+0=7 odd. Black (6,1) dark: 6+1=7 odd. Landing (5,2) dark.
    const state = makeState(
      config,
      [
        { row: 7, col: 0, owner: 'white', kind: 'man' },
        { row: 6, col: 1, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const cands = findHuffingCandidates(state, config);
    const size = boardSizeOf(config);
    expect(cands).toEqual([asNodeId(7 * size + 0)]);
  });

  it('is always empty on non-huffing configs', () => {
    const russian = createRussianDraughtsConfig();
    const state = makeState(
      russian,
      [
        { row: 7, col: 0, owner: 'white', kind: 'man' },
        { row: 6, col: 1, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    expect(findHuffingCandidates(state, russian)).toEqual([]);
  });
});

describe('applyHuff — Malaysian', () => {
  const config = createMalaysianCheckersConfig();
  const size = boardSizeOf(config);

  it('removes the huffed piece, does not flip turn, does not increment plyCount', () => {
    const state = makeState(
      config,
      [
        { row: 7, col: 0, owner: 'white', kind: 'man' },
        { row: 5, col: 2, owner: 'white', kind: 'man' },
      ],
      'white',
    );
    const next = applyHuff(state, asNodeId(7 * size + 0), config);
    expect(next.pieces.size).toBe(1);
    expect(next.turn).toBe('white');
    expect(next.plyCount).toBe(0);
    expect(next.moveHistory?.length).toBe(1);
    expect(next.moveHistory?.[0]?.kind).toBe('huff');
  });

  it('throws on non-huffing config', () => {
    const russian = createRussianDraughtsConfig();
    const state = makeState(
      russian,
      [{ row: 7, col: 0, owner: 'white', kind: 'man' }],
      'white',
    );
    expect(() => applyHuff(state, asNodeId(7 * 8 + 0), russian)).toThrow(/huffing mechanism/);
  });

  it('throws on empty node', () => {
    const state = makeState(config, [], 'white');
    expect(() => applyHuff(state, asNodeId(0), config)).toThrow(/no piece/);
  });
});
