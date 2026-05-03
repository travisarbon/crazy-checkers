import { describe, expect, it } from 'vitest';
import {
  createDameoSerializer,
  LinearSerializerCorruptionError,
} from '../dameoSerializer';
import { buildState, configFor } from '../testHelpers';
import { DAMEO_HAND_VERIFIED_SCENARIOS } from '../fixtures/dameo.handVerified';
import { applyLinearMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildStartingState } from '../startingPosition';
import type { LinearMove } from '../types';

describe('dameoSerializer', () => {
  const config = configFor('dameo');
  const serializer = createDameoSerializer(config);

  it('encodes the trapezoid starting state with 64 squares', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start) as { squares: string };
    expect(json.squares).toHaveLength(64);
    // Black row 0: 8 'b'. Row 1: cols 1..6 'b' + cols 0,7 '_'. Row 2: cols 2..5 'b' + 0,1,6,7 '_'.
    expect(json.squares.slice(0, 8)).toBe('bbbbbbbb');
    expect(json.squares.slice(8, 16)).toBe('_bbbbbb_');
    expect(json.squares.slice(16, 24)).toBe('__bbbb__');
    // Empty rows 3-4.
    expect(json.squares.slice(24, 40)).toBe('________________');
    // White row 5: cols 2..5 'm'. Row 6: cols 1..6 'm'. Row 7: full 'm'.
    expect(json.squares.slice(40, 48)).toBe('__mmmm__');
    expect(json.squares.slice(48, 56)).toBe('_mmmmmm_');
    expect(json.squares.slice(56, 64)).toBe('mmmmmmmm');
  });

  it('round-trips the starting state byte-identically', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start);
    const restored = serializer.fromJSON(json);
    expect(serializer.toJSON(restored)).toEqual(json);
  });

  it('round-trips every hand-verified scenario', () => {
    for (const scenario of DAMEO_HAND_VERIFIED_SCENARIOS) {
      const state = buildState({
        config,
        turn: scenario.turn,
        pieces: scenario.pieces,
      });
      const json = serializer.toJSON(state);
      const back = serializer.fromJSON(json);
      const json2 = serializer.toJSON(back);
      expect(json2, `scenario ${scenario.id} round-trip failed`).toEqual(json);
    }
  });

  it('round-trips a sequence with capture history', () => {
    let state = buildState({
      config,
      pieces: { e3: 'm', e4: 'b', e6: 'b' },
    });
    const moves = computeLegalMoves(state, config);
    const cap = moves.find((m) => m.kind === 'capture' && m.capture.length === 2);
    expect(cap).toBeDefined();
    state = applyLinearMove(state, cap as LinearMove, config);

    const json = serializer.toJSON(state);
    const back = serializer.fromJSON(json);
    expect(serializer.toJSON(back)).toEqual(json);
  });

  it('round-trips a group-advance with promotion meta', () => {
    let state = buildState({
      config,
      pieces: { c3: 'm', d3: 'm', e3: 'm' },
    });
    const moves = computeLegalMoves(state, config);
    const grp = moves.find((m) => m.kind === 'group-advance');
    expect(grp).toBeDefined();
    state = applyLinearMove(state, grp as LinearMove, config);

    const json = serializer.toJSON(state);
    const back = serializer.fromJSON(json);
    expect(serializer.toJSON(back)).toEqual(json);
    expect(back.moveHistory[0]?.kind).toBe('group-advance');
  });

  it('throws on schema mismatch', () => {
    expect(() => serializer.fromJSON({ schemaVersion: 99 })).toThrow(
      LinearSerializerCorruptionError,
    );
  });

  it('throws on serializationType mismatch', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'tower',
        gameId: 'dameo',
        boardSize: 8,
      }),
    ).toThrow(LinearSerializerCorruptionError);
  });

  it('throws on gameId mismatch', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'lasca',
        boardSize: 8,
      }),
    ).toThrow(LinearSerializerCorruptionError);
  });

  it('throws on missing squares string', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'dameo',
        boardSize: 8,
        turn: 'white',
      }),
    ).toThrow(LinearSerializerCorruptionError);
  });

  it('throws on wrong square-string length', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'dameo',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '________',
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(LinearSerializerCorruptionError);
  });

  it('throws on unknown square character', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start) as { squares: string };
    const tampered = { ...json, squares: 'X'.repeat(64) };
    expect(() => serializer.fromJSON(tampered)).toThrow(LinearSerializerCorruptionError);
  });

  it('output is deterministic for the same input across runs', () => {
    const state = buildState({
      config,
      pieces: { e3: 'm', d3: 'm', f3: 'm', e6: 'b' },
    });
    expect(serializer.toJSON(state)).toEqual(serializer.toJSON(state));
  });
});
