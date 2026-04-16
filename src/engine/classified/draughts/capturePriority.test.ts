/**
 * capturePriority — rule-by-rule narrowing behaviour.
 */

import { describe, expect, it } from 'vitest';
import {
  createDraughtsConfig,
  type DraughtsConfig,
} from './DraughtsConfig';
import { filterByCapturePriority } from './capturePriority';
import type { DraughtsMove } from './moveGen';
import { makeState } from './testHelpers';

function move(
  overrides: Partial<DraughtsMove> & Pick<DraughtsMove, 'from' | 'to' | 'capture' | 'piece'>,
): DraughtsMove {
  return {
    kind: 'jump',
    ...overrides,
  };
}

describe('filterByCapturePriority — most-pieces', () => {
  const config = createDraughtsConfig('brazilian-draughts');

  it('retains moves with the maximum captured count', () => {
    // State is unused for non-weighted rule because captureWeight counts
    // by length when pieces aren't found in state.pieces. We set up state
    // so the `captureWeight` helper returns deterministic numbers.
    const state = makeState(config, []);
    const m1: DraughtsMove = move({ from: 'a', to: 'b', piece: 'man', capture: ['x', 'y'] });
    const m2: DraughtsMove = move({ from: 'c', to: 'd', piece: 'man', capture: ['z'] });
    const out = filterByCapturePriority([m1, m2], state, config);
    expect(out).toEqual([m1]);
  });
});

describe('filterByCapturePriority — preserves singletons', () => {
  const config = createDraughtsConfig('russian-draughts');
  it('single candidate bypasses the filter', () => {
    const state = makeState(config, []);
    const m: DraughtsMove = move({ from: 'a', to: 'b', piece: 'man', capture: [] });
    expect(filterByCapturePriority([m], state, config)).toEqual([m]);
  });
});

describe('filterByCapturePriority — empty rule list (Russian)', () => {
  it('Russian has no priority rules; any candidate set survives unchanged', () => {
    const config: DraughtsConfig = createDraughtsConfig('russian-draughts');
    const state = makeState(config, []);
    const m1: DraughtsMove = move({ from: 'a', to: 'b', piece: 'man', capture: ['x'] });
    const m2: DraughtsMove = move({ from: 'c', to: 'd', piece: 'man', capture: ['y', 'z'] });
    expect(filterByCapturePriority([m1, m2], state, config)).toEqual([m1, m2]);
  });
});

describe('filterByCapturePriority — capturing-with-king (Italian)', () => {
  const config = createDraughtsConfig('italian-draughts');
  it('prefers king-start chains when ties exist on earlier rules', () => {
    const state = makeState(config, []);
    // Two 1-capture chains; one starts with a king. Italian rules:
    // most-pieces (tie), most-kings-captured (tie), capturing-with-king (breaks).
    const manStart: DraughtsMove = move({
      from: 'a',
      to: 'b',
      piece: 'man',
      capture: ['x'],
    });
    const kingStart: DraughtsMove = move({
      from: 'c',
      to: 'd',
      piece: 'king',
      capture: ['y'],
    });
    expect(filterByCapturePriority([manStart, kingStart], state, config)).toEqual([kingStart]);
  });
});

describe('filterByCapturePriority — idempotent under double-application', () => {
  const config = createDraughtsConfig('international-checkers');
  it('applying twice yields the same result', () => {
    const state = makeState(config, []);
    const m1: DraughtsMove = move({ from: 'a', to: 'b', piece: 'man', capture: ['x', 'y'] });
    const m2: DraughtsMove = move({ from: 'c', to: 'd', piece: 'man', capture: ['z'] });
    const once = filterByCapturePriority([m1, m2], state, config);
    const twice = filterByCapturePriority(once, state, config);
    expect(twice).toEqual(once);
  });
});
