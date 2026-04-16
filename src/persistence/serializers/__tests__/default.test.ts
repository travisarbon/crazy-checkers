import { describe, expect, it } from 'vitest';
import { asNodeId, type NodeId } from '../../../engine/boardGeometry';
import { asClassifiedGameId } from '../../../engine/classified/ClassifiedRuleSet';
import type { ClassifiedGameState, ClassifiedPiece } from '../../../engine/classified/state';
import { createDefaultSerializer } from '../default';
import { SerializerMetaError, SerializerPieceIdError } from '../errors';
import { assertByteIdenticalRoundTrip, roundTrip } from './roundTrip';

const GID = asClassifiedGameId('default-test');
const VOCAB = [
  'pawn-white',
  'pawn-black',
  'king-white',
  'king-black',
  'rook',
  'rook-in-hand',
  'pawn-in-hand',
];

function makeSerializer(vocabulary = VOCAB) {
  return createDefaultSerializer({ gameId: GID, vocabularyPieceIds: vocabulary });
}

function pieces(entries: [number, ClassifiedPiece][]): ReadonlyMap<NodeId, ClassifiedPiece> {
  return new Map(entries.map(([n, p]) => [asNodeId(n), p]));
}

describe('createDefaultSerializer — empty and simple states', () => {
  it('round-trips an empty state', () => {
    const ser = makeSerializer();
    const state: ClassifiedGameState = { pieces: new Map() };
    assertByteIdenticalRoundTrip(ser, state);
    const { rehydrated } = roundTrip(ser, state);
    expect(rehydrated.pieces.size).toBe(0);
  });

  it('round-trips a flat draughts-like state with 24 pieces', () => {
    const ser = makeSerializer();
    const entries: [number, ClassifiedPiece][] = [];
    for (let n = 1; n <= 12; n += 1) entries.push([n, { owner: 'black', kind: 'pawn' }]);
    for (let n = 21; n <= 32; n += 1) entries.push([n, { owner: 'white', kind: 'pawn' }]);
    const state: ClassifiedGameState = {
      pieces: pieces(entries),
      turn: 'white',
      plyCount: 0,
      moveHistory: [],
    };
    assertByteIdenticalRoundTrip(ser, state);
    const { rehydrated } = roundTrip(ser, state);
    expect(rehydrated.pieces.size).toBe(24);
    expect(rehydrated.turn).toBe('white');
  });
});

describe('createDefaultSerializer — ordering invariants', () => {
  it('yields byte-identical JSON when pieces are inserted in different orders', () => {
    const ser = makeSerializer();
    const a = pieces([
      [1, { owner: 'black', kind: 'pawn' }],
      [5, { owner: 'black', kind: 'pawn' }],
      [32, { owner: 'white', kind: 'pawn' }],
    ]);
    const b = pieces([
      [32, { owner: 'white', kind: 'pawn' }],
      [1, { owner: 'black', kind: 'pawn' }],
      [5, { owner: 'black', kind: 'pawn' }],
    ]);
    expect(JSON.stringify(ser.toJSON({ pieces: a }))).toBe(
      JSON.stringify(ser.toJSON({ pieces: b })),
    );
  });

  it('sorts meta keys alphabetically', () => {
    const ser = makeSerializer();
    const a: ClassifiedGameState = {
      pieces: new Map(),
      meta: { zeta: 1, alpha: 2, mu: 3 },
    };
    const json = JSON.stringify(ser.toJSON(a));
    // Confirm key order
    expect(json.indexOf('alpha')).toBeLessThan(json.indexOf('mu'));
    expect(json.indexOf('mu')).toBeLessThan(json.indexOf('zeta'));
  });
});

describe('createDefaultSerializer — stacking (Tier 2)', () => {
  it('round-trips a stacking state with depth-4 stack composition', () => {
    const ser = makeSerializer();
    const stack: ClassifiedPiece = {
      owner: 'white',
      kind: 'stack-top',
      stack: [
        { owner: 'black', kind: 'pawn' },
        { owner: 'white', kind: 'king', promoted: true },
        {
          owner: 'black',
          kind: 'carrier',
          stack: [{ owner: 'white', kind: 'inner' }],
        },
      ],
    };
    const state: ClassifiedGameState = {
      pieces: pieces([
        [1, stack],
        [9, { owner: 'black', kind: 'pawn' }],
      ]),
      turn: 'white',
      plyCount: 0,
      moveHistory: [],
    };
    assertByteIdenticalRoundTrip(ser, state);
    const { rehydrated } = roundTrip(ser, state);
    const top = rehydrated.pieces.get(asNodeId(1));
    expect(top?.stack?.length).toBe(3);
    expect(top?.stack?.[2]?.stack?.[0]?.kind).toBe('inner');
  });
});

describe('createDefaultSerializer — placement phase (Tier 3)', () => {
  it('round-trips a placement-phase state', () => {
    const ser = makeSerializer();
    const state: ClassifiedGameState = {
      pieces: pieces([[5, { owner: 'white', kind: 'stone' }]]),
      turn: 'black',
      plyCount: 1,
      moveHistory: [],
      placementPhase: { phase: 'placement', whiteRemaining: 8, blackRemaining: 9 },
    };
    assertByteIdenticalRoundTrip(ser, state);
    const { rehydrated } = roundTrip(ser, state);
    expect(rehydrated.placementPhase?.phase).toBe('placement');
    expect(rehydrated.placementPhase?.whiteRemaining).toBe(8);
  });
});

describe('createDefaultSerializer — mancala counts (Tier 5)', () => {
  it('round-trips a mancala-style pit state via ClassifiedPiece.count', () => {
    const ser = makeSerializer();
    const state: ClassifiedGameState = {
      pieces: pieces([
        [1, { owner: 'white', kind: 'pit', count: 4 }],
        [2, { owner: 'white', kind: 'pit', count: 4 }],
        [7, { owner: 'white', kind: 'store', count: 0 }],
      ]),
      turn: 'white',
      plyCount: 0,
      moveHistory: [],
    };
    assertByteIdenticalRoundTrip(ser, state);
    const { rehydrated } = roundTrip(ser, state);
    expect(rehydrated.pieces.get(asNodeId(1))?.count).toBe(4);
  });
});

describe('createDefaultSerializer — hands (Tier 7 T7-10 closure)', () => {
  it('round-trips non-empty hand reserves bit-identically', () => {
    const ser = makeSerializer();
    const state: ClassifiedGameState = {
      pieces: pieces([[1, { owner: 'white', kind: 'rook' }]]),
      turn: 'white',
      plyCount: 0,
      moveHistory: [],
      hands: {
        white: new Map([
          ['rook-in-hand', 2],
          ['pawn-in-hand', 3],
        ]),
        black: new Map([['pawn-in-hand', 1]]),
      },
    };
    assertByteIdenticalRoundTrip(ser, state);
    const { rehydrated } = roundTrip(ser, state);
    expect(rehydrated.hands?.white.get('rook-in-hand')).toBe(2);
    expect(rehydrated.hands?.black.get('pawn-in-hand')).toBe(1);
  });

  it('normalizes hand ordering so insertion order does not leak to JSON', () => {
    const ser = makeSerializer();
    const a: ClassifiedGameState = {
      pieces: new Map(),
      hands: {
        white: new Map([
          ['pawn-in-hand', 1],
          ['rook-in-hand', 2],
        ]),
        black: new Map(),
      },
    };
    const b: ClassifiedGameState = {
      pieces: new Map(),
      hands: {
        white: new Map([
          ['rook-in-hand', 2],
          ['pawn-in-hand', 1],
        ]),
        black: new Map(),
      },
    };
    expect(JSON.stringify(ser.toJSON(a))).toBe(JSON.stringify(ser.toJSON(b)));
  });

  it('throws SerializerPieceIdError on unknown hand pieceId (encode)', () => {
    const ser = makeSerializer();
    const state: ClassifiedGameState = {
      pieces: new Map(),
      hands: {
        white: new Map([['ghost', 1]]),
        black: new Map(),
      },
    };
    expect(() => ser.toJSON(state)).toThrow(SerializerPieceIdError);
  });

  it('throws SerializerPieceIdError on unknown hand pieceId (decode)', () => {
    const ser = makeSerializer();
    const payload = {
      pieces: [],
      hands: {
        white: [['ghost', 1]],
        black: [],
      },
    };
    expect(() => ser.fromJSON(JSON.parse(JSON.stringify(payload)))).toThrow(
      SerializerPieceIdError,
    );
  });
});

describe('createDefaultSerializer — roles (asymmetric Tier 7 / Tafl)', () => {
  it('round-trips role labels', () => {
    const ser = makeSerializer();
    const state: ClassifiedGameState = {
      pieces: pieces([[1, { owner: 'white', kind: 'king' }]]),
      roles: {
        whiteRole: 'Attacker',
        blackRole: 'Defender',
        whiteGoal: 'Capture the king',
        blackGoal: 'Escape to the edge',
      },
    };
    assertByteIdenticalRoundTrip(ser, state);
  });
});

describe('createDefaultSerializer — meta escape hatch', () => {
  it('round-trips JSON-safe meta (nested objects, arrays, primitives)', () => {
    const ser = makeSerializer();
    const state: ClassifiedGameState = {
      pieces: new Map(),
      meta: {
        fen: '8/8/8/8/8/8/8/8 w - - 0 1',
        nested: { key: 1, list: [1, 2, 3] },
        flag: true,
      },
    };
    assertByteIdenticalRoundTrip(ser, state);
  });

  it('throws SerializerMetaError on non-JSON-safe meta values', () => {
    const ser = makeSerializer();
    const cases: unknown[] = [new Date(), new Map(), new Set([1, 2]), () => 0, NaN, Infinity];
    for (const value of cases) {
      expect(() =>
        ser.toJSON({
          pieces: new Map(),
          meta: { bad: value },
        }),
      ).toThrow(SerializerMetaError);
    }
  });
});

describe('createDefaultSerializer — moveHistory', () => {
  it('round-trips a move history with captures and meta', () => {
    const ser = makeSerializer();
    const state: ClassifiedGameState = {
      pieces: new Map(),
      moveHistory: [
        { kind: 'move', from: '1', to: '5' },
        {
          kind: 'capture',
          from: '5',
          to: '14',
          piece: 'pawn-white',
          capture: ['9'],
          meta: { promoted: false, pathLength: 2 },
        },
      ],
    };
    assertByteIdenticalRoundTrip(ser, state);
    const { rehydrated } = roundTrip(ser, state);
    expect(rehydrated.moveHistory?.length).toBe(2);
    expect(rehydrated.moveHistory?.[1]?.capture).toEqual(['9']);
  });
});
