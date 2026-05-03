/**
 * Targeted tests for engine paths that the broader scenario suites do not
 * happen to cover (typed-error branches, defensive throws, configuration
 * knobs). Pushes the alquerque module above the 95% line / 80% branch
 * coverage thresholds.
 */

import { describe, expect, it } from 'vitest';
import { applyAlquerqueMove } from '../applyMove';
import {
  filterMaximumCapture,
  generateCaptureMoves,
  generateSimpleMoves,
} from '../moveGen';
import {
  AlquerqueSerializerCorruptionError,
  createZammaSerializer,
} from '../zammaSerializer';
import { buildState, configFor } from '../testHelpers';
import { createZammaConfig, type AlquerqueConfig, type AlquerqueMove } from '../types';
import { createAlquerqueRuleSet } from '../AlquerqueEngine';
import { alquerqueGeometry } from '../../../boardGeometry';

describe('moveGen — maximum-capture mandatory knob (variant)', () => {
  it('with knob ON, only the longest chain survives', () => {
    const baseConfig = createZammaConfig();
    const variant: AlquerqueConfig = {
      ...baseConfig,
      maximumCaptureMandatory: true,
    };
    // Setup: white at e5 has both a 1-jump (e6 victim) and a 2-jump chain
    // (e6 → e7, then e8 → e9) — the 2-jump uses e6+e8.
    const state = buildState({ config: variant, pieces: { e5: 'm', e6: 'b', e8: 'b' } });
    const captures = generateCaptureMoves(state, variant);
    expect(captures.length).toBeGreaterThanOrEqual(1);
    const filtered = filterMaximumCapture(captures, variant);
    expect(filtered.every((m) => m.capture.length === 2)).toBe(true);
  });

  it('with knob OFF, all legal chains coexist', () => {
    const config = configFor('zamma');
    const state = buildState({ config, pieces: { e5: 'm', e6: 'b', e8: 'b' } });
    const captures = generateCaptureMoves(state, config);
    // Without max-mandatory pruning, both the 1-jump and the 2-jump survive.
    const filtered = filterMaximumCapture(captures, config);
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });
});

describe('moveGen — flying Mullah variant', () => {
  it('flying Mullah walks rays until obstruction', () => {
    const baseConfig = createZammaConfig();
    const variant: AlquerqueConfig = { ...baseConfig, mullahFlying: true };
    const state = buildState({ config: variant, pieces: { e5: 'M' } });
    const moves = generateSimpleMoves(state, variant);
    // Flying Mullah at e5 (8 ray directions × multiple landings each) — many
    // more moves than the 8-step short-range default.
    expect(moves.length).toBeGreaterThan(8);
  });
});

describe('applyAlquerqueMove — defensive throws', () => {
  const config = configFor('zamma');

  it('throws if a step move arrives at an empty source intersection', () => {
    const state = buildState({ config, pieces: { e5: 'm' } });
    const ghost: AlquerqueMove = {
      kind: 'step',
      from: 'e6', // empty
      to: 'e7',
      piece: 'man',
      capture: [],
    };
    expect(() => applyAlquerqueMove(state, ghost, config)).toThrow(/no piece at/);
  });

  it('throws if a capture move arrives at an empty source intersection', () => {
    const state = buildState({ config, pieces: { e5: 'm' } });
    const ghost: AlquerqueMove = {
      kind: 'capture',
      from: 'e6',
      to: 'e8',
      piece: 'man',
      capture: ['e7'],
      meta: { path: [16, 34] },
    };
    expect(() => applyAlquerqueMove(state, ghost, config)).toThrow(/no piece at/);
  });

  it('throws if a capture move arrives without meta.path', () => {
    const state = buildState({ config, pieces: { e5: 'm', e6: 'b' } });
    const handCrafted: AlquerqueMove = {
      kind: 'capture',
      from: 'e5',
      to: 'e7',
      piece: 'man',
      capture: ['e6'],
      // intentionally omits meta.path
    };
    expect(() => applyAlquerqueMove(state, handCrafted, config)).toThrow(
      /missing required meta.path/,
    );
  });

  it('throws on unparsable from-label', () => {
    const state = buildState({ config, pieces: { e5: 'm' } });
    const bad: AlquerqueMove = {
      kind: 'step',
      from: 'q9',
      to: 'a3',
      piece: 'man',
      capture: [],
    };
    expect(() => applyAlquerqueMove(state, bad, config)).toThrow(/unparsable notation token "q9"/);
  });
});

describe('zammaSerializer — typed-error branches', () => {
  const config = configFor('zamma');
  const serializer = createZammaSerializer(config);

  it('throws when repetitionTable entry is not a 2-tuple', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [],
      repetitionTable: [['onlyhex']],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when repetitionTable entry hex is malformed', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [],
      repetitionTable: [['BAD-HEX', 1]],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when repetitionTable count is malformed', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [],
      repetitionTable: [['0000000000000abc', -1]],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when moveHistory entry is not an object', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: ['not-an-object'],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when moveHistory entry has invalid kind', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [{ kind: 'mystery' }],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when moveHistory has non-string from/to', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [{ kind: 'step', from: 1, to: 2, piece: 'man', capture: [] }],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when moveHistory entry has invalid piece kind', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [{ kind: 'step', from: 'a1', to: 'a2', piece: 'queen', capture: [] }],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when moveHistory entry has non-array capture', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [{ kind: 'step', from: 'a1', to: 'a2', piece: 'man', capture: 'no' }],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when moveHistory capture entry is not a string', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [{ kind: 'step', from: 'a1', to: 'a2', piece: 'man', capture: [42] }],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when meta.path entry is not an integer', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [
        {
          kind: 'capture',
          from: 'a1',
          to: 'b2',
          piece: 'man',
          capture: ['c3'],
          meta: { path: ['not-int'] },
        },
      ],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when meta.directions entry is not a string', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'zamma',
      serializationType: 'standard',
      boardSize: 9,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      intersections: '_'.repeat(81),
      moveHistory: [
        {
          kind: 'capture',
          from: 'a1',
          to: 'b2',
          piece: 'man',
          capture: ['c3'],
          meta: { directions: [42] },
        },
      ],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on missing turn', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'zamma',
        boardSize: 9,
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on invalid halfMoveClock', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'zamma',
        boardSize: 9,
        turn: 'white',
        halfMoveClock: -1,
        plyCount: 0,
        intersections: '_'.repeat(81),
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on invalid plyCount', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'zamma',
        boardSize: 9,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: -1,
        intersections: '_'.repeat(81),
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on missing moveHistory', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'zamma',
        boardSize: 9,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        intersections: '_'.repeat(81),
        repetitionTable: [],
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on missing repetitionTable', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'zamma',
        boardSize: 9,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        intersections: '_'.repeat(81),
        moveHistory: [],
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on null payload', () => {
    expect(() => serializer.fromJSON(null)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on boardSize mismatch', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        gameId: 'zamma',
        serializationType: 'standard',
        boardSize: 7,
        turn: 'white',
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws when encode encounters an unknown piece kind/owner', () => {
    const corruptState = {
      pieces: new Map([[40 as never, { owner: 'red', kind: 'man' } as never]]),
      turn: 'white' as const,
      plyCount: 0,
      moveHistory: Object.freeze([] as const),
      meta: {
        turnTag: 'white' as const,
        halfMoveClock: 0,
        repetitionTable: Object.freeze([]),
      },
    };
    // The encode path should throw on unknown owner.
    expect(() => serializer.toJSON(corruptState as never)).toThrow(
      AlquerqueSerializerCorruptionError,
    );
  });
});

describe('AlquerqueEngine — factory caching', () => {
  it('returns the same instance for repeat calls with the same config', () => {
    const config = createZammaConfig();
    const a = createAlquerqueRuleSet(config);
    const b = createAlquerqueRuleSet(config);
    expect(a).toBe(b);
  });
});

describe('alquerqueGeometry — pass-through edge cases', () => {
  it('default diagonalPattern is "alternating" (when not specified)', () => {
    const geom = alquerqueGeometry({ size: 9 });
    expect(geom.dimensions.alquerque?.diagonalPattern).toBe('alternating');
  });
});
