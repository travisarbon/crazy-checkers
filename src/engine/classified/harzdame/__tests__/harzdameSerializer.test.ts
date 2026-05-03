import { describe, expect, it } from 'vitest';
import {
  HarzdameSerializerCorruptionError,
  createHarzdameSerializer,
} from '../harzdameSerializer';
import { buildStartingState } from '../startingPosition';
import { buildState } from '../testHelpers';
import { HARZDAME_HAND_VERIFIED_SCENARIOS } from '../fixtures/harzdame.handVerified';
import { createHarzdameConfig, type HarzdameConfig } from '../types';

const CFG = createHarzdameConfig();

describe('harzdameSerializer — starting position snapshot', () => {
  const ser = createHarzdameSerializer(CFG);

  it('serializes the starting position to a 32-char string', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { squares: string };
    expect(json.squares).toHaveLength(32);
  });

  it('starting position has 12 b chars (PDN 1..12) and 12 m chars (PDN 21..32)', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { squares: string };
    expect(json.squares.slice(0, 12)).toBe('bbbbbbbbbbbb');
    expect(json.squares.slice(12, 20)).toBe('________');
    expect(json.squares.slice(20, 32)).toBe('mmmmmmmmmmmm');
  });

  it('starting position carries gameId "harzdame" and schemaVersion 1', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as {
      gameId: string;
      schemaVersion: number;
      serializationType: string;
      boardSize: number;
    };
    expect(json.gameId).toBe('harzdame');
    expect(json.schemaVersion).toBe(1);
    expect(json.serializationType).toBe('standard');
    expect(json.boardSize).toBe(8);
  });

  it('seniorKings is null when no senior kings present', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { seniorKings: number[] | null };
    expect(json.seniorKings).toBeNull();
  });
});

describe('harzdameSerializer — round-trip', () => {
  const ser = createHarzdameSerializer(CFG);

  it('round-trips the starting state exactly', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start);
    const back = ser.fromJSON(json);
    expect(ser.toJSON(back)).toEqual(json);
  });

  it('round-trips a state with senior kings (S/s chars)', () => {
    const state = buildState({
      pieces: { '1': 'S', '32': 's', '17': 'm', '18': 'M', '5': 'b', '6': 'B' },
    });
    const json = ser.toJSON(state);
    const back = ser.fromJSON(json);
    expect(ser.toJSON(back)).toEqual(json);
  });

  it('round-trips every hand-verified scenario', () => {
    for (const scenario of HARZDAME_HAND_VERIFIED_SCENARIOS) {
      const state = buildState({
        config: CFG,
        turn: scenario.turn,
        pieces: scenario.pieces,
      });
      const json = ser.toJSON(state);
      const back = ser.fromJSON(json);
      expect(ser.toJSON(back)).toEqual(json);
    }
  });

  it('seniorKings cache reflects the actual senior pieces after round-trip', () => {
    const state = buildState({ pieces: { '1': 'S', '32': 's' } });
    const json = ser.toJSON(state) as { seniorKings: number[] | null };
    expect(json.seniorKings).not.toBeNull();
    expect(json.seniorKings?.length).toBe(2);
  });
});

describe('harzdameSerializer — encode rejects ill-formed pieces', () => {
  it('throws on encoding a senior king when seniorKing.enabled=false', () => {
    const variant: HarzdameConfig = {
      ...CFG,
      seniorKing: { ...CFG.seniorKing, enabled: false },
    };
    const sv = createHarzdameSerializer(variant);
    const state = buildState({ config: variant, pieces: { '1': 'S' } });
    expect(() => sv.toJSON(state)).toThrow(HarzdameSerializerCorruptionError);
  });
});

describe('harzdameSerializer — decode error paths', () => {
  const ser = createHarzdameSerializer(CFG);

  it('throws on null payload', () => {
    expect(() => ser.fromJSON(null)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on non-object payload', () => {
    expect(() => ser.fromJSON('not an object')).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on schema mismatch', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 99,
        serializationType: 'standard',
        gameId: 'harzdame',
        boardSize: 8,
      }),
    ).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on serializationType mismatch', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'tower',
        gameId: 'harzdame',
        boardSize: 8,
      }),
    ).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on gameId mismatch', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'mak-yek',
        boardSize: 8,
      }),
    ).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on boardSize mismatch', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'harzdame',
        boardSize: 10,
      }),
    ).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on missing squares string', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'harzdame',
        boardSize: 8,
        turn: 'white',
      }),
    ).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on squares string of wrong length', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { squares: string };
    const tampered = { ...json, squares: '________' };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on unknown character in squares string', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { squares: string };
    const tampered = { ...json, squares: 'X'.repeat(32) };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on senior-king char (S) when seniorKing.enabled=false', () => {
    const variant: HarzdameConfig = {
      ...CFG,
      seniorKing: { ...CFG.seniorKing, enabled: false },
    };
    const sv = createHarzdameSerializer(variant);
    const start = buildStartingState(variant);
    const json = sv.toJSON(start) as { squares: string };
    const tampered = { ...json, squares: 'S' + json.squares.slice(1) };
    expect(() => sv.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on invalid turn value', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, turn: 'gray' };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on invalid halfMoveClock (not int)', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, halfMoveClock: 'huh' };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on negative plyCount', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, plyCount: -1 };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on moveHistory not an array', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, moveHistory: 'not an array' };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on repetitionTable not an array', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, repetitionTable: 'not an array' };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on repetitionTable entry shape mismatch', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, repetitionTable: [['only-one-element']] };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on repetitionTable hex malformed (wrong length)', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, repetitionTable: [['abc', 1]] };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });

  it('throws on repetitionTable count zero', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = {
      ...json,
      repetitionTable: [['0123456789abcdef', 0]],
    };
    expect(() => ser.fromJSON(tampered)).toThrow(HarzdameSerializerCorruptionError);
  });
});
