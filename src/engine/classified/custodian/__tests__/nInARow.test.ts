import { describe, expect, it } from 'vitest';
import { findNInARowLines } from '../nInARow';
import { buildState } from '../testHelpers';
import { createDaiHasamiShogiConfig } from '../daiHasamiShogiConfig';

const DH = createDaiHasamiShogiConfig();

describe('findNInARowLines', () => {
  it('detects horizontal 5-in-a-row', () => {
    const state = buildState({
      config: DH,
      pieces: { a5: 'm', b5: 'm', c5: 'm', d5: 'm', e5: 'm' },
    });
    const lines = findNInARowLines({
      pieces: state.pieces,
      owner: 'white',
      n: 5,
      axes: ['horizontal'],
      boardSize: 9,
    });
    expect(lines.length).toBeGreaterThan(0);
  });

  it('detects vertical 5-in-a-row', () => {
    const state = buildState({
      config: DH,
      pieces: { a3: 'm', a4: 'm', a5: 'm', a6: 'm', a7: 'm' },
    });
    const lines = findNInARowLines({
      pieces: state.pieces,
      owner: 'white',
      n: 5,
      axes: ['vertical'],
      boardSize: 9,
    });
    expect(lines.length).toBeGreaterThan(0);
  });

  it('does NOT count diagonal when axes are horizontal+vertical only', () => {
    const state = buildState({
      config: DH,
      pieces: { a1: 'm', b2: 'm', c3: 'm', d4: 'm', e5: 'm' },
    });
    const lines = findNInARowLines({
      pieces: state.pieces,
      owner: 'white',
      n: 5,
      axes: ['horizontal', 'vertical'],
      boardSize: 9,
    });
    expect(lines).toHaveLength(0);
  });

  it('counts diagonal when included', () => {
    const state = buildState({
      config: DH,
      pieces: { a1: 'm', b2: 'm', c3: 'm', d4: 'm', e5: 'm' },
    });
    const lines = findNInARowLines({
      pieces: state.pieces,
      owner: 'white',
      n: 5,
      axes: ['diagonal'],
      boardSize: 9,
    });
    expect(lines.length).toBeGreaterThan(0);
  });

  it('excludes lines entirely inside the excluded-row zone', () => {
    // 5 white pieces all in row 0 (white's starting rank for Dai Hasami).
    const state = buildState({
      config: DH,
      pieces: { a9: 'm', b9: 'm', c9: 'm', d9: 'm', e9: 'm' },
    });
    const lines = findNInARowLines({
      pieces: state.pieces,
      owner: 'white',
      n: 5,
      axes: ['horizontal'],
      boardSize: 9,
      excludeRow: (r) => r >= 0 && r < 2, // white's first two ranks
    });
    expect(lines).toHaveLength(0);
  });

  it('counts a line straddling the boundary (at least one square outside the excluded zone)', () => {
    // 4 squares in row 1 (excluded for white) and 1 square in row 2 (allowed):
    // a1..e1 doesn't straddle. Need vertical: a8 (r=1), a7 (r=2). Use vertical 5: a9..a5 = rows 0..4.
    // a9 (r=0), a8 (r=1), a7 (r=2), a6 (r=3), a5 (r=4). Two excluded (rows 0,1), three allowed.
    const state = buildState({
      config: DH,
      pieces: { a9: 'm', a8: 'm', a7: 'm', a6: 'm', a5: 'm' },
    });
    const lines = findNInARowLines({
      pieces: state.pieces,
      owner: 'white',
      n: 5,
      axes: ['vertical'],
      boardSize: 9,
      excludeRow: (r) => r >= 0 && r < 2,
    });
    expect(lines.length).toBeGreaterThan(0);
  });

  it('does NOT count 4-in-a-row when n is 5', () => {
    const state = buildState({
      config: DH,
      pieces: { a5: 'm', b5: 'm', c5: 'm', d5: 'm' },
    });
    const lines = findNInARowLines({
      pieces: state.pieces,
      owner: 'white',
      n: 5,
      axes: ['horizontal'],
      boardSize: 9,
    });
    expect(lines).toHaveLength(0);
  });

  it('counts 6-in-a-row as multiple 5-windows', () => {
    const state = buildState({
      config: DH,
      pieces: { a5: 'm', b5: 'm', c5: 'm', d5: 'm', e5: 'm', f5: 'm' },
    });
    const lines = findNInARowLines({
      pieces: state.pieces,
      owner: 'white',
      n: 5,
      axes: ['horizontal'],
      boardSize: 9,
    });
    expect(lines).toHaveLength(2);
  });

  it('returns empty for n < 1', () => {
    const state = buildState({ config: DH, pieces: { a1: 'm' } });
    const lines = findNInARowLines({
      pieces: state.pieces,
      owner: 'white',
      n: 0,
      axes: ['horizontal'],
      boardSize: 9,
    });
    expect(lines).toHaveLength(0);
  });
});
