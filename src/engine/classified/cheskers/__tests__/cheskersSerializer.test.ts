import { describe, expect, it } from 'vitest';
import {
  CheskersSerializerCorruptionError,
  createCheskersSerializer,
} from '../cheskersSerializer';
import { buildStartingState } from '../startingPosition';
import { buildState } from '../testHelpers';
import { CHESKERS_HAND_VERIFIED_SCENARIOS } from '../fixtures/cheskers.handVerified';
import { createCheskersConfig } from '../types';

const CFG = createCheskersConfig();

describe('cheskersSerializer — starting position snapshot', () => {
  const ser = createCheskersSerializer(CFG);

  it('serializes the starting position to a 32-char string', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { squares: string };
    expect(json.squares).toHaveLength(32);
  });

  it('starting position carries gameId "cheskers" and serializationType "chess"', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as {
      gameId: string;
      schemaVersion: number;
      serializationType: string;
      boardSize: number;
    };
    expect(json.gameId).toBe('cheskers');
    expect(json.schemaVersion).toBe(1);
    expect(json.serializationType).toBe('chess');
    expect(json.boardSize).toBe(8);
  });

  it('starting position kingCount = white 2, black 2', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { kingCount: { white: number; black: number } };
    expect(json.kingCount).toEqual({ white: 2, black: 2 });
  });

  it('starting squares contain all 4 piece-type chars per side', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { squares: string };
    expect(json.squares.includes('P')).toBe(true);
    expect(json.squares.includes('K')).toBe(true);
    expect(json.squares.includes('B')).toBe(true);
    expect(json.squares.includes('C')).toBe(true);
    expect(json.squares.includes('p')).toBe(true);
    expect(json.squares.includes('k')).toBe(true);
    expect(json.squares.includes('b')).toBe(true);
    expect(json.squares.includes('c')).toBe(true);
  });
});

describe('cheskersSerializer — round-trip', () => {
  const ser = createCheskersSerializer(CFG);

  it('round-trips the starting state', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start);
    const back = ser.fromJSON(json);
    expect(ser.toJSON(back)).toEqual(json);
  });

  it('round-trips every hand-verified scenario', () => {
    for (const scenario of CHESKERS_HAND_VERIFIED_SCENARIOS) {
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

  it('round-trips a state with all 8 piece characters present', () => {
    const state = buildState({
      pieces: {
        a1: 'B', c1: 'K', e1: 'K', g1: 'C',
        d2: 'P', b8: 'c', d8: 'k', f8: 'k', h8: 'b', a7: 'p',
      },
      turn: 'black',
    });
    const json = ser.toJSON(state);
    const back = ser.fromJSON(json);
    expect(ser.toJSON(back)).toEqual(json);
  });
});

describe('cheskersSerializer — decode error paths', () => {
  const ser = createCheskersSerializer(CFG);

  it('throws on null payload', () => {
    expect(() => ser.fromJSON(null)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on schema mismatch', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 99,
        serializationType: 'chess',
        gameId: 'cheskers',
        boardSize: 8,
      }),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on serializationType mismatch (expected "chess")', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'cheskers',
        boardSize: 8,
      }),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on gameId mismatch', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'chess',
        gameId: 'mak-yek',
        boardSize: 8,
      }),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on boardSize mismatch', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'chess',
        gameId: 'cheskers',
        boardSize: 10,
      }),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on missing squares string', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'chess',
        gameId: 'cheskers',
        boardSize: 8,
        turn: 'white',
      }),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on squares string of wrong length', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, squares: '________' };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on unknown character in squares string', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { squares: string };
    const tampered = { ...json, squares: 'X'.repeat(32) };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on illegal char (e.g., Q for chess queen which Cheskers doesn\'t have)', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as { squares: string };
    const tampered = { ...json, squares: 'Q' + json.squares.slice(1) };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on invalid turn value', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, turn: 'gray' };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on kingCount mismatch vs. parsed pieces', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, kingCount: { white: 5, black: 5 } };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on moveHistory not an array', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, moveHistory: 'huh' };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on repetitionTable malformed entry', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, repetitionTable: [['only-one']] };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on repetitionTable hex malformed', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, repetitionTable: [['xyz', 1]] };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on repetitionTable count zero', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, repetitionTable: [['0123456789abcdef', 0]] };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on negative plyCount', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, plyCount: -1 };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on invalid halfMoveClock', () => {
    const start = buildStartingState(CFG);
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, halfMoveClock: 'huh' };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });
});
