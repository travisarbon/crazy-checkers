import { describe, expect, it } from 'vitest';
import {
  CustodianSerializerCorruptionError,
  createCustodianSerializer,
} from '../custodianSerializer';
import { buildStartingState } from '../startingPosition';
import { buildState } from '../testHelpers';
import { createMakYekConfig } from '../makYekConfig';
import { createHasamiShogiConfig } from '../hasamiShogiConfig';
import { createRekConfig } from '../rekConfig';
import { createDaiHasamiShogiConfig } from '../daiHasamiShogiConfig';
import { MAK_YEK_HAND_VERIFIED_SCENARIOS } from '../fixtures/makYek.handVerified';
import { HASAMI_SHOGI_HAND_VERIFIED_SCENARIOS } from '../fixtures/hasamiShogi.handVerified';
import { REK_HAND_VERIFIED_SCENARIOS } from '../fixtures/rek.handVerified';
import { DAI_HASAMI_SHOGI_HAND_VERIFIED_SCENARIOS } from '../fixtures/daiHasamiShogi.handVerified';

const MAK = createMakYekConfig();
const HSG = createHasamiShogiConfig();
const REK = createRekConfig();
const DH = createDaiHasamiShogiConfig();

describe('custodianSerializer — Mak-yek', () => {
  const ser = createCustodianSerializer(MAK);

  it('starting position serializes to 64-char string with the correct content', () => {
    const start = buildStartingState(MAK);
    const json = ser.toJSON(start) as { squares: string };
    expect(json.squares).toHaveLength(64);
    // White rows 0+2; black rows 5+7; rest empty.
    expect(json.squares.slice(0, 8)).toBe('mmmmmmmm');
    expect(json.squares.slice(8, 16)).toBe('________');
    expect(json.squares.slice(16, 24)).toBe('mmmmmmmm');
    expect(json.squares.slice(40, 48)).toBe('bbbbbbbb');
    expect(json.squares.slice(56, 64)).toBe('bbbbbbbb');
  });

  it('round-trips the starting state', () => {
    const start = buildStartingState(MAK);
    const json = ser.toJSON(start);
    const restored = ser.fromJSON(json);
    expect(ser.toJSON(restored)).toEqual(json);
  });

  it('round-trips every hand-verified scenario', () => {
    for (const scenario of MAK_YEK_HAND_VERIFIED_SCENARIOS) {
      const state = buildState({ config: MAK, turn: scenario.turn, pieces: scenario.pieces });
      const json = ser.toJSON(state);
      const back = ser.fromJSON(json);
      expect(ser.toJSON(back)).toEqual(json);
    }
  });

  it('throws on unknown character in squares string', () => {
    const start = buildStartingState(MAK);
    const json = ser.toJSON(start) as { squares: string };
    const tampered = { ...json, squares: 'X'.repeat(64) };
    expect(() => ser.fromJSON(tampered)).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on K (king) char appearing in non-Rek game', () => {
    const start = buildStartingState(MAK);
    const json = ser.toJSON(start) as { squares: string };
    const tampered = { ...json, squares: 'K' + json.squares.slice(1) };
    expect(() => ser.fromJSON(tampered)).toThrow(CustodianSerializerCorruptionError);
  });
});

describe('custodianSerializer — Hasami Shogi', () => {
  const ser = createCustodianSerializer(HSG);

  it('starting position serializes to 81-char string', () => {
    const start = buildStartingState(HSG);
    const json = ser.toJSON(start) as { squares: string };
    expect(json.squares).toHaveLength(81);
    expect(json.squares.slice(0, 9)).toBe('mmmmmmmmm');
    expect(json.squares.slice(72, 81)).toBe('bbbbbbbbb');
  });

  it('round-trips every hand-verified scenario', () => {
    for (const scenario of HASAMI_SHOGI_HAND_VERIFIED_SCENARIOS) {
      const state = buildState({ config: HSG, turn: scenario.turn, pieces: scenario.pieces });
      const json = ser.toJSON(state);
      const back = ser.fromJSON(json);
      expect(ser.toJSON(back)).toEqual(json);
    }
  });
});

describe('custodianSerializer — Rek (king alphabet)', () => {
  const ser = createCustodianSerializer(REK);

  it('starting position contains both K and k characters', () => {
    const start = buildStartingState(REK);
    const json = ser.toJSON(start) as { squares: string };
    expect(json.squares).toHaveLength(64);
    expect(json.squares.includes('K')).toBe(true);
    expect(json.squares.includes('k')).toBe(true);
  });

  it('round-trips a Rek state with kings present', () => {
    const state = buildState({
      config: REK,
      pieces: { e4: 'K', d4: 'm', f5: 'k' },
    });
    const json = ser.toJSON(state);
    const back = ser.fromJSON(json);
    expect(ser.toJSON(back)).toEqual(json);
  });

  it('round-trips every hand-verified scenario', () => {
    for (const scenario of REK_HAND_VERIFIED_SCENARIOS) {
      const state = buildState({ config: REK, turn: scenario.turn, pieces: scenario.pieces });
      const json = ser.toJSON(state);
      const back = ser.fromJSON(json);
      expect(ser.toJSON(back)).toEqual(json);
    }
  });
});

describe('custodianSerializer — Dai Hasami Shogi', () => {
  const ser = createCustodianSerializer(DH);

  it('starting position serializes to 81-char string with rows 0..1 + 7..8 filled', () => {
    const start = buildStartingState(DH);
    const json = ser.toJSON(start) as { squares: string };
    expect(json.squares).toHaveLength(81);
    expect(json.squares.slice(0, 9)).toBe('mmmmmmmmm');
    expect(json.squares.slice(9, 18)).toBe('mmmmmmmmm');
    expect(json.squares.slice(63, 72)).toBe('bbbbbbbbb');
    expect(json.squares.slice(72, 81)).toBe('bbbbbbbbb');
  });

  it('round-trips every hand-verified scenario', () => {
    for (const scenario of DAI_HASAMI_SHOGI_HAND_VERIFIED_SCENARIOS) {
      const state = buildState({ config: DH, turn: scenario.turn, pieces: scenario.pieces });
      const json = ser.toJSON(state);
      const back = ser.fromJSON(json);
      expect(ser.toJSON(back)).toEqual(json);
    }
  });
});

describe('custodianSerializer — universal error paths', () => {
  const ser = createCustodianSerializer(MAK);

  it('throws on schema mismatch', () => {
    expect(() => ser.fromJSON({ schemaVersion: 99 })).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on serializationType mismatch', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'tower',
        gameId: 'mak-yek',
        boardSize: 8,
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on gameId mismatch', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'rek',
        boardSize: 8,
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on missing squares string', () => {
    expect(() =>
      ser.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'mak-yek',
        boardSize: 8,
        turn: 'white',
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on null payload', () => {
    expect(() => ser.fromJSON(null)).toThrow(CustodianSerializerCorruptionError);
  });
});
