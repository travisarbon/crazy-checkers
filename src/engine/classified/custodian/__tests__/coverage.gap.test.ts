/**
 * Targeted tests for engine paths the broader scenario suites don't cover
 * (typed-error branches, defensive throws, optional capture-mode knobs).
 * Pushes the custodian module above the 95% line / 80% branch coverage
 * thresholds.
 */

import { describe, expect, it } from 'vitest';
import { applyCustodianMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import {
  CustodianSerializerCorruptionError,
  createCustodianSerializer,
} from '../custodianSerializer';
import { buildState } from '../testHelpers';
import { createMakYekConfig } from '../makYekConfig';
import { createRekConfig } from '../rekConfig';
import { createDaiHasamiShogiConfig } from '../daiHasamiShogiConfig';
import type { CustodianMove } from '../types';

const MAK = createMakYekConfig();
const REK = createRekConfig();
const DH = createDaiHasamiShogiConfig();

describe('applyCustodianMove — defensive throws', () => {
  it('throws when source square is empty', () => {
    const state = buildState({ config: MAK, pieces: { a1: 'm' } });
    const ghost: CustodianMove = {
      kind: 'slide',
      from: 'h1',
      to: 'h2',
      piece: 'man',
      capture: [],
    };
    expect(() => applyCustodianMove(state, ghost, MAK)).toThrow(/no piece at/);
  });

  it('throws on unparsable from-label', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'm' } });
    const bad: CustodianMove = {
      kind: 'slide',
      from: 'q9',
      to: 'a1',
      piece: 'man',
      capture: [],
    };
    expect(() => applyCustodianMove(state, bad, MAK)).toThrow(/unparsable notation token "q9"/);
  });

  it('throws on unparsable to-label', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'm' } });
    const bad: CustodianMove = {
      kind: 'slide',
      from: 'e4',
      to: 'zz9',
      piece: 'man',
      capture: [],
    };
    expect(() => applyCustodianMove(state, bad, MAK)).toThrow(/unparsable notation token "zz9"/);
  });
});

describe('custodianSerializer — full error-path coverage', () => {
  const serMak = createCustodianSerializer(MAK);
  const serRek = createCustodianSerializer(REK);
  const serDh = createCustodianSerializer(DH);

  it('throws on string-instead-of-object payload', () => {
    expect(() => serMak.fromJSON('string')).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on unsupported boardSize', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 12,
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on invalid turn value', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'red',
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on wrong squares string length', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '___',
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on negative halfMoveClock', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: -1,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on negative plyCount', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: -1,
        squares: '_'.repeat(64),
        moveHistory: [],
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on missing moveHistory array', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on missing repetitionTable', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on malformed repetitionTable entry shape', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [],
        repetitionTable: [['onlyhex']],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on malformed repetitionTable hex', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [],
        repetitionTable: [['BAD-HEX', 1]],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on negative repetitionTable count', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [],
        repetitionTable: [['0000000000000abc', -1]],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('Dai Hasami: round-trips a state with non-null winningLines', () => {
    const state = buildState({
      config: DH,
      turn: 'black',
      pieces: { a5: 'm', b5: 'm', c5: 'm', d5: 'm', e5: 'm' },
    });
    const seeded = {
      ...state,
      meta: {
        ...state.meta,
        winningLines: Object.freeze([
          Object.freeze([4 * 9 + 0, 4 * 9 + 1, 4 * 9 + 2, 4 * 9 + 3, 4 * 9 + 4]),
        ]),
      },
    };
    const json = serDh.toJSON(seeded);
    const back = serDh.fromJSON(json);
    expect(back.meta.winningLines).not.toBeNull();
    expect(back.meta.winningLines?.length).toBe(1);
  });

  it('Dai Hasami: throws on malformed winningLines (non-array)', () => {
    expect(() =>
      serDh.fromJSON({
        schemaVersion: 1,
        gameId: 'dai-hasami-shogi',
        serializationType: 'standard',
        boardSize: 9,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(81),
        moveHistory: [],
        repetitionTable: [],
        winningLines: 'not-an-array',
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('Dai Hasami: throws on winningLines entry with non-int', () => {
    expect(() =>
      serDh.fromJSON({
        schemaVersion: 1,
        gameId: 'dai-hasami-shogi',
        serializationType: 'standard',
        boardSize: 9,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(81),
        moveHistory: [],
        repetitionTable: [],
        winningLines: [['not-a-number']],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on moveHistory entry that is not an object', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: ['not-object'],
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on moveHistory entry with invalid kind', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [{ kind: 'mystery' }],
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on moveHistory entry with non-string from/to', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [{ kind: 'slide', from: 1, to: 2, piece: 'man', capture: [] }],
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on moveHistory entry with invalid piece kind', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [{ kind: 'slide', from: 'a1', to: 'a2', piece: 'queen', capture: [] }],
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on moveHistory entry with non-array capture', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [{ kind: 'slide', from: 'a1', to: 'a2', piece: 'man', capture: 'no' }],
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws on moveHistory capture entry that is not a string', () => {
    expect(() =>
      serMak.fromJSON({
        schemaVersion: 1,
        gameId: 'mak-yek',
        serializationType: 'standard',
        boardSize: 8,
        turn: 'white',
        halfMoveClock: 0,
        plyCount: 0,
        squares: '_'.repeat(64),
        moveHistory: [{ kind: 'slide', from: 'a1', to: 'a2', piece: 'man', capture: [42] }],
        repetitionTable: [],
      }),
    ).toThrow(CustodianSerializerCorruptionError);
  });

  it('round-trips a move with full meta breakdown (Rek state with intervention + immobilization combined)', () => {
    // Construct a Rek state where applying a move produces a meta.captureBreakdown
    // covering multiple modes, then round-trip it through the serializer.
    let state = buildState({
      config: REK,
      pieces: { a8: 'm', h1: 'b', g1: 'm', h2: 'm', a1: 'K', h8: 'k' },
    });
    const moves = computeLegalMoves(state, REK);
    state = applyCustodianMove(state, moves[0] as CustodianMove, REK);
    const json = serRek.toJSON(state);
    const back = serRek.fromJSON(json);
    expect(serRek.toJSON(back)).toEqual(json);
  });
});

describe('custodianSerializer — encode-side throws', () => {
  it('throws when encoding state with king at non-Rek game', () => {
    const ser = createCustodianSerializer(MAK);
    const state = buildState({ config: MAK, pieces: { a1: 'm' } });
    // Sneak a king into the pieces map (not normally allowed by buildState).
    const corrupted = {
      ...state,
      pieces: new Map([
        ...state.pieces,
        [4 as never, { owner: 'white' as const, kind: 'king' as const }],
      ]),
    };
    expect(() => ser.toJSON(corrupted as never)).toThrow(CustodianSerializerCorruptionError);
  });

  it('throws when encoding state with unknown piece kind/owner', () => {
    const ser = createCustodianSerializer(MAK);
    const state = buildState({ config: MAK, pieces: {} });
    const corrupted = {
      ...state,
      pieces: new Map([[4 as never, { owner: 'red', kind: 'queen' } as never]]),
    };
    expect(() => ser.toJSON(corrupted as never)).toThrow(CustodianSerializerCorruptionError);
  });
});
