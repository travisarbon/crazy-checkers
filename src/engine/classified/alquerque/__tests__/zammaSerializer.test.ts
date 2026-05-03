import { describe, expect, it } from 'vitest';
import {
  AlquerqueSerializerCorruptionError,
  createZammaSerializer,
} from '../zammaSerializer';
import { buildState, configFor } from '../testHelpers';
import { ZAMMA_HAND_VERIFIED_SCENARIOS } from '../fixtures/zamma.handVerified';
import { applyAlquerqueMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildStartingState } from '../startingPosition';
import type { AlquerqueMove } from '../types';

describe('zammaSerializer', () => {
  const config = configFor('zamma');
  const serializer = createZammaSerializer(config);

  it('encodes the trapezoid starting state with 81 intersections', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start) as { intersections: string };
    expect(json.intersections).toHaveLength(81);
    // Black row 0..3: full = 36 'b'.
    expect(json.intersections.slice(0, 9)).toBe('bbbbbbbbb');
    expect(json.intersections.slice(9, 18)).toBe('bbbbbbbbb');
    expect(json.intersections.slice(18, 27)).toBe('bbbbbbbbb');
    expect(json.intersections.slice(27, 36)).toBe('bbbbbbbbb');
    // Row 4: cols 0..3 black, col 4 empty, cols 5..8 white.
    expect(json.intersections.slice(36, 45)).toBe('bbbb_mmmm');
    // White rows 5..8: full 'm'.
    expect(json.intersections.slice(45, 54)).toBe('mmmmmmmmm');
    expect(json.intersections.slice(54, 63)).toBe('mmmmmmmmm');
    expect(json.intersections.slice(63, 72)).toBe('mmmmmmmmm');
    expect(json.intersections.slice(72, 81)).toBe('mmmmmmmmm');
  });

  it('round-trips the starting state byte-identically', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start);
    const restored = serializer.fromJSON(json);
    expect(serializer.toJSON(restored)).toEqual(json);
  });

  it('round-trips every hand-verified scenario', () => {
    for (const scenario of ZAMMA_HAND_VERIFIED_SCENARIOS) {
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
      pieces: { e5: 'm', e6: 'b', e8: 'b' },
    });
    const moves = computeLegalMoves(state, config);
    const cap = moves.find((m) => m.kind === 'capture' && m.capture.length === 2);
    expect(cap).toBeDefined();
    state = applyAlquerqueMove(state, cap as AlquerqueMove, config);

    const json = serializer.toJSON(state);
    const back = serializer.fromJSON(json);
    expect(serializer.toJSON(back)).toEqual(json);
  });

  it('throws on schema mismatch', () => {
    expect(() => serializer.fromJSON({ schemaVersion: 99 })).toThrow(
      AlquerqueSerializerCorruptionError,
    );
  });

  it('throws on serializationType mismatch', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'tower',
        gameId: 'zamma',
        boardSize: 9,
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on gameId mismatch', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'lasca',
        boardSize: 9,
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on missing intersections string', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'zamma',
        boardSize: 9,
        turn: 'white',
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on wrong intersections-string length', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'zamma',
        boardSize: 9,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        intersections: '________',
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('throws on unknown intersection character', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start) as { intersections: string };
    const tampered = { ...json, intersections: 'X'.repeat(81) };
    expect(() => serializer.fromJSON(tampered)).toThrow(AlquerqueSerializerCorruptionError);
  });

  it('output is deterministic for the same input across runs', () => {
    const state = buildState({
      config,
      pieces: { e5: 'm', d5: 'm', f5: 'm', e6: 'b' },
    });
    expect(serializer.toJSON(state)).toEqual(serializer.toJSON(state));
  });
});
