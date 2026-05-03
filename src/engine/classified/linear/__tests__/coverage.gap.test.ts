/**
 * Targeted tests for engine paths that the broader scenario suites do not
 * happen to cover (typed-error branches, defensive throws). Pushes the
 * linear-movement module above the 95% line / 80% branch coverage thresholds.
 */

import { describe, expect, it } from 'vitest';
import { applyLinearMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import {
  createDameoSerializer,
  LinearSerializerCorruptionError,
} from '../dameoSerializer';
import { buildState, configFor } from '../testHelpers';
import type { LinearMove } from '../types';

describe('applyLinearMove — defensive throws', () => {
  const config = configFor('dameo');

  it('throws if a step move arrives at an empty source square', () => {
    const state = buildState({ config, pieces: { e3: 'm' } });
    const ghost: LinearMove = {
      kind: 'step',
      from: 'e4', // empty
      to: 'e5',
      piece: 'man',
      direction: 'N',
      capture: [],
    };
    expect(() => applyLinearMove(state, ghost, config)).toThrow(/no piece at/);
  });

  it('throws if a capture move arrives at an empty source square', () => {
    const state = buildState({ config, pieces: { e3: 'm' } });
    const ghost: LinearMove = {
      kind: 'capture',
      from: 'e4',
      to: 'e6',
      piece: 'man',
      direction: 'N',
      capture: ['e5'],
      meta: { path: [4 * 8 + 4, 2 * 8 + 4] },
    };
    expect(() => applyLinearMove(state, ghost, config)).toThrow(/no piece at/);
  });

  it('throws if a capture move arrives without meta.path', () => {
    const state = buildState({ config, pieces: { e3: 'm', e4: 'b' } });
    const handCrafted: LinearMove = {
      kind: 'capture',
      from: 'e3',
      to: 'e5',
      piece: 'man',
      direction: 'N',
      capture: ['e4'],
      // intentionally omits meta.path
    };
    expect(() => applyLinearMove(state, handCrafted, config)).toThrow(
      /missing required meta.path/,
    );
  });

  it('throws if a group-advance move arrives without meta.groupMemberNodes', () => {
    const state = buildState({
      config,
      pieces: { c3: 'm', d3: 'm', e3: 'm' },
    });
    const handCrafted: LinearMove = {
      kind: 'group-advance',
      from: 'c3',
      to: 'c4',
      piece: 'man',
      direction: 'N',
      capture: [],
      // missing meta.groupMemberNodes
    };
    expect(() => applyLinearMove(state, handCrafted, config)).toThrow(
      /missing required meta.groupMemberNodes/,
    );
  });

  it('throws if a group-advance refers to a missing member tower', () => {
    const state = buildState({ config, pieces: { c3: 'm' } });
    const c3 = config.boardGeometry.coordinateLabels.parseNotation('c3') as unknown as number;
    const d3 = config.boardGeometry.coordinateLabels.parseNotation('d3') as unknown as number;
    const handCrafted: LinearMove = {
      kind: 'group-advance',
      from: 'c3',
      to: 'c4',
      piece: 'man',
      direction: 'N',
      capture: [],
      meta: { groupMemberNodes: [c3, d3] }, // d3 is not in pieces
    };
    expect(() => applyLinearMove(state, handCrafted, config)).toThrow(
      /missing member tower/,
    );
  });

  it('throws on unparsable from-label', () => {
    const state = buildState({ config, pieces: { e3: 'm' } });
    const bad: LinearMove = {
      kind: 'step',
      from: 'q9',
      to: 'a3',
      piece: 'man',
      direction: 'N',
      capture: [],
    };
    expect(() => applyLinearMove(state, bad, config)).toThrow(/unparsable notation token "q9"/);
  });
});

describe('dameoSerializer — typed-error branches', () => {
  const config = configFor('dameo');
  const serializer = createDameoSerializer(config);

  it('throws when repetitionTable entry is not a 2-tuple', () => {
    const start = serializer.toJSON({
      pieces: new Map(),
      turn: 'white',
      plyCount: 0,
      moveHistory: Object.freeze([] as const),
      meta: {
        turnTag: 'white',
        halfMoveClock: 0,
        repetitionTable: Object.freeze([]),
      },
    });
    const tampered = {
      ...(start as Record<string, unknown>),
      repetitionTable: [['onlyhex']],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(LinearSerializerCorruptionError);
  });

  it('throws when moveHistory entry has non-array capture', () => {
    const start = serializer.toJSON({
      pieces: new Map(),
      turn: 'white',
      plyCount: 0,
      moveHistory: Object.freeze([] as const),
      meta: {
        turnTag: 'white',
        halfMoveClock: 0,
        repetitionTable: Object.freeze([]),
      },
    });
    const tampered = {
      ...(start as Record<string, unknown>),
      moveHistory: [
        {
          kind: 'step',
          from: 'a1',
          to: 'b2',
          piece: 'man',
          direction: 'N',
          capture: 'not-an-array',
        },
      ],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(LinearSerializerCorruptionError);
  });

  it('throws when moveHistory capture entry is not a string', () => {
    const start = serializer.toJSON({
      pieces: new Map(),
      turn: 'white',
      plyCount: 0,
      moveHistory: Object.freeze([] as const),
      meta: {
        turnTag: 'white',
        halfMoveClock: 0,
        repetitionTable: Object.freeze([]),
      },
    });
    const tampered = {
      ...(start as Record<string, unknown>),
      moveHistory: [
        {
          kind: 'step',
          from: 'a1',
          to: 'b2',
          piece: 'man',
          direction: 'N',
          capture: [42],
        },
      ],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(LinearSerializerCorruptionError);
  });

  it('throws when meta.path entry is not an integer', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'dameo',
      serializationType: 'standard',
      boardSize: 8,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      squares: '_'.repeat(64),
      moveHistory: [
        {
          kind: 'capture',
          from: 'a1',
          to: 'b2',
          piece: 'man',
          direction: 'N',
          capture: ['c3'],
          meta: { path: ['not-int'] },
        },
      ],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(LinearSerializerCorruptionError);
  });

  it('throws when meta.groupMemberNodes entry is not an integer', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'dameo',
      serializationType: 'standard',
      boardSize: 8,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      squares: '_'.repeat(64),
      moveHistory: [
        {
          kind: 'group-advance',
          from: 'a1',
          to: 'a2',
          piece: 'man',
          direction: 'N',
          capture: [],
          meta: { groupMemberNodes: ['not-int'] },
        },
      ],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(LinearSerializerCorruptionError);
  });

  it('throws when groupMembers array entry is not a string', () => {
    const tampered = {
      schemaVersion: 1,
      gameId: 'dameo',
      serializationType: 'standard',
      boardSize: 8,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      squares: '_'.repeat(64),
      moveHistory: [
        {
          kind: 'group-advance',
          from: 'a1',
          to: 'a2',
          piece: 'man',
          direction: 'N',
          capture: [],
          groupMembers: [42],
        },
      ],
      repetitionTable: [],
    };
    expect(() => serializer.fromJSON(tampered)).toThrow(LinearSerializerCorruptionError);
  });

  it('throws on missing turn', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'dameo',
        boardSize: 8,
      }),
    ).toThrow(LinearSerializerCorruptionError);
  });

  it('throws on invalid halfMoveClock', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'dameo',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: -1,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(LinearSerializerCorruptionError);
  });

  it('throws on invalid plyCount', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'dameo',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: -1,
        squares: '_'.repeat(64),
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(LinearSerializerCorruptionError);
  });

  it('throws on moveHistory entry with invalid kind', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'dameo',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [{ kind: 'mystery' }],
        repetitionTable: [],
      }),
    ).toThrow(LinearSerializerCorruptionError);
  });
});

describe('moveGen — flying king sort tie-breaker (deterministic)', () => {
  it('repeated calls produce identical move ordering', () => {
    const config = configFor('dameo');
    const state = buildState({
      config,
      pieces: { d4: 'M', c5: 'b', e5: 'b' }, // king with multiple capture options
    });
    const moves1 = computeLegalMoves(state, config);
    const moves2 = computeLegalMoves(state, config);
    expect(moves1.map((m) => `${m.kind}|${m.from}|${m.to}|${m.direction}|${m.capture.join(',')}`)).toEqual(
      moves2.map((m) => `${m.kind}|${m.from}|${m.to}|${m.direction}|${m.capture.join(',')}`),
    );
  });
});
