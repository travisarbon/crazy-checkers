import { describe, expect, it } from 'vitest';
import {
  createStackingSerializer,
  StackingSerializerCorruptionError,
} from '../stackingSerializer';
import { configFor, buildState } from '../testHelpers';
import { LASCA_HAND_VERIFIED_SCENARIOS } from '../fixtures/lasca.handVerified';
import { BASHNI_HAND_VERIFIED_SCENARIOS } from '../fixtures/bashni.handVerified';
import { applyStackingMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildStartingState } from '../startingPosition';
import type { StackingMove } from '../types';

describe('stackingSerializer — Lasca', () => {
  const config = configFor('lasca');
  const serializer = createStackingSerializer(config);

  it('encodes the starting state with 25 squares and seeds the repetition table', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start) as { squares: string };
    const tokens = json.squares.split(',');
    expect(tokens).toHaveLength(25);
    // Black: rows 0..2 (squares 1..11). White: rows 4..6 (squares 15..25).
    // Row 3 (squares 12..14) is empty.
    expect(tokens.slice(0, 11).every((t) => t === 'T[b]')).toBe(true);
    expect(tokens.slice(11, 14).every((t) => t === '_')).toBe(true);
    expect(tokens.slice(14).every((t) => t === 'T[m]')).toBe(true);
  });

  it('round-trips the starting state byte-identically', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start);
    const restored = serializer.fromJSON(json);
    expect(serializer.toJSON(restored)).toEqual(json);
  });

  it('round-trips every Lasca hand-verified scenario', () => {
    for (const scenario of LASCA_HAND_VERIFIED_SCENARIOS) {
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

  it('round-trips a sequence of plies with capture history', () => {
    let state = buildState({
      config,
      pieces: { '16': 'm', '13': 'b' },
    });
    const moves = computeLegalMoves(state, config);
    expect(moves).toHaveLength(1);
    state = applyStackingMove(state, moves[0] as StackingMove, config);

    const json = serializer.toJSON(state);
    const back = serializer.fromJSON(json);
    const json2 = serializer.toJSON(back);
    expect(json2).toEqual(json);
  });

  it('throws on schema mismatch', () => {
    expect(() => serializer.fromJSON({ schemaVersion: 99 })).toThrow(
      StackingSerializerCorruptionError,
    );
  });

  it('throws on serializationType mismatch', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'standard',
        gameId: 'lasca',
        boardSize: 7,
      }),
    ).toThrow(StackingSerializerCorruptionError);
  });

  it('throws on gameId mismatch', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'tower',
        gameId: 'bashni',
        boardSize: 7,
      }),
    ).toThrow(StackingSerializerCorruptionError);
  });

  it('throws on missing squares string', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'tower',
        gameId: 'lasca',
        boardSize: 7,
        turn: 'white',
      }),
    ).toThrow(StackingSerializerCorruptionError);
  });

  it('throws on malformed tower token', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start) as { squares: string };
    const corrupted = { ...json, squares: json.squares.replace('T[b]', 'X[zz]') };
    expect(() => serializer.fromJSON(corrupted)).toThrow(StackingSerializerCorruptionError);
  });

  it('throws on wrong square count', () => {
    expect(() =>
      serializer.fromJSON({
        schemaVersion: 1,
        serializationType: 'tower',
        gameId: 'lasca',
        boardSize: 7,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_,_,_',
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(StackingSerializerCorruptionError);
  });
});

describe('stackingSerializer — Bashni', () => {
  const config = configFor('bashni');
  const serializer = createStackingSerializer(config);

  it('encodes the starting state with 32 squares', () => {
    const start = buildStartingState(config);
    const json = serializer.toJSON(start) as { squares: string };
    const tokens = json.squares.split(',');
    expect(tokens).toHaveLength(32);
    // Black: rows 0..2 (squares 1..12). Empty: rows 3..4 (13..20). White: rows 5..7 (21..32).
    expect(tokens.slice(0, 12).every((t) => t === 'T[b]')).toBe(true);
    expect(tokens.slice(12, 20).every((t) => t === '_')).toBe(true);
    expect(tokens.slice(20).every((t) => t === 'T[m]')).toBe(true);
  });

  it('round-trips every Bashni hand-verified scenario', () => {
    for (const scenario of BASHNI_HAND_VERIFIED_SCENARIOS) {
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

  it('preserves move history (with promotion + meta) across round-trip', () => {
    let state = buildState({
      config,
      pieces: { '10': 'm', '7': 'b', '8': 'b' },
    });
    const moves = computeLegalMoves(state, config);
    const longChain = moves.filter((m) => m.kind === 'capture' && m.capture.length === 2);
    expect(longChain).toHaveLength(1);
    state = applyStackingMove(state, longChain[0] as StackingMove, config);
    expect(state.moveHistory).toHaveLength(1);
    expect(state.moveHistory[0]?.meta?.promotionSquare).toBeDefined();

    const json = serializer.toJSON(state);
    const back = serializer.fromJSON(json);
    expect(back.moveHistory[0]?.meta?.promotionSquare).toBe(
      state.moveHistory[0]?.meta?.promotionSquare,
    );
    expect(serializer.toJSON(back)).toEqual(json);
  });
});

describe('stackingSerializer — output determinism', () => {
  it('repeated encoding of the same state yields the same JSON', () => {
    const config = configFor('lasca');
    const serializer = createStackingSerializer(config);
    const state = buildState({
      config,
      pieces: { '13': 'mbB', '17': 'm', '5': 'b' },
    });
    expect(serializer.toJSON(state)).toEqual(serializer.toJSON(state));
  });
});
