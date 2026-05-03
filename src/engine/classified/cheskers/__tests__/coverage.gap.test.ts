/**
 * Coverage-gap tests for Cheskers (Phase 4 Task 29.6).
 *
 * Targets defensive error paths and rarely-exercised branches that the
 * primary scenario suites don't cover:
 *  - applyMove error throws (no piece, bad label, malformed piece).
 *  - serializer decodeMove with rich meta + every error path.
 *  - moveGen mid-chain promotion path.
 *  - hashPosition early-skip on bogus owner/kind.
 */

import { describe, expect, it } from 'vitest';
import { applyCheskersMove } from '../applyMove';
import {
  computeLegalMoves,
  generateBishopMoves,
  generateCamelMoves,
  generatePawnSteps,
} from '../moveGen';
import {
  CheskersSerializerCorruptionError,
  createCheskersSerializer,
} from '../cheskersSerializer';
import {
  _clearHashTableCacheForTests,
  hashPosition,
} from '../cheskersZobrist';
import { buildState } from '../testHelpers';
import {
  CheskersStartingPositionMismatchError,
} from '../startingPosition';
import {
  createCheskersConfig,
  type CheskersConfig,
  type CheskersMove,
} from '../types';
import type { ClassifiedPiece } from '../../state';
import type { NodeId } from '../../../boardGeometry';

const CFG = createCheskersConfig();

// ---------------------------------------------------------------------------
// applyMove error throws
// ---------------------------------------------------------------------------

describe('applyCheskersMove — error throws', () => {
  it('throws when pawn-step references a square with no piece', () => {
    const state = buildState({ pieces: { d2: 'P' }, turn: 'white' });
    const bogus: CheskersMove = {
      kind: 'pawn-step',
      from: 'a3', // empty
      to: 'b4',
      piece: 'pawn',
      capture: [],
    };
    expect(() => {
      applyCheskersMove(state, bogus, CFG);
    }).toThrow(/no piece at a3/);
  });

  it('throws when pawn-jump references a square with no piece', () => {
    const state = buildState({ pieces: { d4: 'P', e5: 'p' }, turn: 'white' });
    const bogus: CheskersMove = {
      kind: 'pawn-jump',
      from: 'a3', // empty
      to: 'b4',
      piece: 'pawn',
      capture: ['e5'],
    };
    expect(() => {
      applyCheskersMove(state, bogus, CFG);
    }).toThrow(/no piece at a3/);
  });

  it('throws when bishop-displace references a square with no piece', () => {
    const state = buildState({ pieces: { d4: 'B' }, turn: 'white' });
    const bogus: CheskersMove = {
      kind: 'bishop-displace',
      from: 'a3', // empty
      to: 'b4',
      piece: 'bishop',
      capture: ['b4'],
    };
    expect(() => {
      applyCheskersMove(state, bogus, CFG);
    }).toThrow(/no piece at a3/);
  });

  it('throws when move references an unparsable label', () => {
    const state = buildState({ pieces: { d2: 'P' }, turn: 'white' });
    const bogus: CheskersMove = {
      kind: 'pawn-step',
      from: 'NOT-VALID',
      to: 'c3',
      piece: 'pawn',
      capture: [],
    };
    expect(() => {
      applyCheskersMove(state, bogus, CFG);
    }).toThrow(/unparsable notation token/);
  });

  it('throws when piece has invalid owner', () => {
    const node = CFG.boardGeometry.coordinateLabels.parseNotation('d2') as NodeId;
    const pieces = new Map<NodeId, ClassifiedPiece>();
    pieces.set(node, { owner: 'gray' as 'white', kind: 'pawn' });
    const state = buildState({ pieces: { d2: 'P' }, turn: 'white' });
    const corrupted = { ...state, pieces };
    const move: CheskersMove = {
      kind: 'pawn-step',
      from: 'd2',
      to: 'c3',
      piece: 'pawn',
      capture: [],
    };
    expect(() => {
      applyCheskersMove(corrupted, move, CFG);
    }).toThrow(/invalid piece owner/);
  });

  it('throws when piece has invalid kind', () => {
    const node = CFG.boardGeometry.coordinateLabels.parseNotation('d2') as NodeId;
    const pieces = new Map<NodeId, ClassifiedPiece>();
    pieces.set(node, { owner: 'white', kind: 'queen' as 'pawn' });
    const state = buildState({ pieces: { d2: 'P' }, turn: 'white' });
    const corrupted = { ...state, pieces };
    const move: CheskersMove = {
      kind: 'pawn-step',
      from: 'd2',
      to: 'c3',
      piece: 'pawn',
      capture: [],
    };
    expect(() => {
      applyCheskersMove(corrupted, move, CFG);
    }).toThrow(/invalid piece kind/);
  });

  it('camel-leap step path applies (cover the camel-leap branch in applyStep)', () => {
    const state = buildState({ pieces: { d4: 'C' }, turn: 'white' });
    const moves = computeLegalMoves(state, CFG);
    const leap = moves.find((m) => m.kind === 'camel-leap') as CheskersMove;
    expect(leap).toBeDefined();
    const next = applyCheskersMove(state, leap, CFG);
    expect(next.plyCount).toBe(1);
  });

  it('king-step path applies', () => {
    const state = buildState({ pieces: { d4: 'K' }, turn: 'white' });
    const moves = computeLegalMoves(state, CFG);
    const step = moves.find((m) => m.kind === 'king-step') as CheskersMove;
    expect(step).toBeDefined();
    const next = applyCheskersMove(state, step, CFG);
    expect(next.plyCount).toBe(1);
  });

  it('bishop-slide step path applies', () => {
    const state = buildState({ pieces: { d4: 'B' }, turn: 'white' });
    const moves = computeLegalMoves(state, CFG);
    const slide = moves.find((m) => m.kind === 'bishop-slide') as CheskersMove;
    expect(slide).toBeDefined();
    const next = applyCheskersMove(state, slide, CFG);
    expect(next.plyCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// moveGen — pawn promotion choice knob
// ---------------------------------------------------------------------------

describe('moveGen — pawn promotion choice', () => {
  it('knob target=choice emits one move per choice in choices', () => {
    const variant: CheskersConfig = {
      ...CFG,
      pawnPromotion: { target: 'choice', choices: ['king', 'bishop', 'camel'] },
    };
    const state = buildState({
      config: variant,
      pieces: { a7: 'P' },
      turn: 'white',
    });
    const moves = computeLegalMoves(state, variant);
    const promotionMoves = moves.filter((m) => m.promotion !== undefined);
    expect(promotionMoves).toHaveLength(3);
    const promoTargets = new Set(promotionMoves.map((m) => m.promotion));
    expect(promoTargets.has('king')).toBe(true);
    expect(promoTargets.has('bishop')).toBe(true);
    expect(promoTargets.has('camel')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Direction-vocabulary edge cases
// ---------------------------------------------------------------------------

describe('moveGen — direction edge cases', () => {
  it('Pawn at the back rank (no forward step possible — already there)', () => {
    // White Pawn at b8 = (0, 1). White moves NW/NE = (-1, ...) off-board. 0 steps.
    const state = buildState({ pieces: { b8: 'P' }, turn: 'white' });
    const moves = generatePawnSteps(state, CFG, [
      { node: CFG.boardGeometry.coordinateLabels.parseNotation('b8') as NodeId, owner: 'white' },
    ]);
    expect(moves).toHaveLength(0);
  });

  it('Bishop with no slides available (corner blocked by friendly + edges)', () => {
    // Bishop at a1, friendly at b2 → no slides (NE blocked, others off-board).
    const state = buildState({ pieces: { a1: 'B', b2: 'P' }, turn: 'white' });
    const moves = generateBishopMoves(state, CFG, [
      { node: CFG.boardGeometry.coordinateLabels.parseNotation('a1') as NodeId, owner: 'white' },
    ]);
    expect(moves).toHaveLength(0);
  });

  it('Camel with all destinations off-board (corner)', () => {
    const state = buildState({ pieces: { h8: 'C' }, turn: 'white' });
    // h8 = (0, 7). (3, 1) destinations: (-3, ±) and (-1, ±) off the top; (1, 4) = e7 and (3, 6) = g5 in-bounds (and dark).
    // Actually (1, 4): (1+4)=5 odd dark ✓ = e7. (3, 6): (3+6)=9 odd dark ✓ = g5.
    // (1, 8) and (3, 8) off; (-1, 6) (-1, 8) (-3, 6) (-3, 8) off.
    // So h8 has 2 destinations.
    const moves = generateCamelMoves(state, CFG, [
      { node: CFG.boardGeometry.coordinateLabels.parseNotation('h8') as NodeId, owner: 'white' },
    ]);
    expect(moves).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Serializer rich-move round-trip + remaining error paths
// ---------------------------------------------------------------------------

describe('cheskersSerializer — rich-move round-trip', () => {
  const ser = createCheskersSerializer(CFG);

  it('round-trips a state whose moveHistory contains a step with promotion', () => {
    const start = buildState({ pieces: { a7: 'P' }, turn: 'white' });
    const moves = computeLegalMoves(start, CFG);
    const promoteMove = moves.find((m) => m.promotion === 'king') as CheskersMove;
    const next = applyCheskersMove(start, promoteMove, CFG);
    const json = ser.toJSON(next);
    const back = ser.fromJSON(json);
    expect(ser.toJSON(back)).toEqual(json);
  });

  it('round-trips a state whose moveHistory contains a Camel leap with offset meta', () => {
    const start = buildState({ pieces: { d4: 'C' }, turn: 'white' });
    const moves = computeLegalMoves(start, CFG);
    const leap = moves.find((m) => m.kind === 'camel-leap') as CheskersMove;
    const next = applyCheskersMove(start, leap, CFG);
    const json = ser.toJSON(next);
    const back = ser.fromJSON(json);
    expect(ser.toJSON(back)).toEqual(json);
  });

  it('round-trips a state whose moveHistory contains a Pawn jump with full meta', () => {
    const start = buildState({
      pieces: { d4: 'P', e5: 'p' },
      turn: 'white',
    });
    const moves = computeLegalMoves(start, CFG);
    const cap = moves.find((m) => m.kind === 'pawn-jump') as CheskersMove;
    const next = applyCheskersMove(start, cap, CFG);
    const json = ser.toJSON(next);
    const back = ser.fromJSON(json);
    expect(ser.toJSON(back)).toEqual(json);
  });

  it('round-trips a multi-step history (5 moves chained)', () => {
    let state = buildState({ pieces: { d2: 'P', e7: 'p' }, turn: 'white' });
    for (let i = 0; i < 5; i += 1) {
      const moves = computeLegalMoves(state, CFG);
      if (moves.length === 0) break;
      state = applyCheskersMove(state, moves[0] as CheskersMove, CFG);
    }
    const json = ser.toJSON(state);
    const back = ser.fromJSON(json);
    expect(ser.toJSON(back)).toEqual(json);
  });
});

describe('cheskersSerializer — decodeMove error paths', () => {
  const ser = createCheskersSerializer(CFG);

  function basePayloadWithMove(move: unknown): Record<string, unknown> {
    return {
      schemaVersion: 1,
      gameId: 'cheskers',
      serializationType: 'chess',
      boardSize: 8,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 1,
      squares: '_'.repeat(32),
      moveHistory: [move],
      repetitionTable: [],
      kingCount: { white: 0, black: 0 },
    };
  }

  it('throws when moveHistory entry is not an object', () => {
    expect(() => ser.fromJSON(basePayloadWithMove('a string'))).toThrow(
      CheskersSerializerCorruptionError,
    );
  });

  it('throws on invalid move kind', () => {
    expect(() =>
      ser.fromJSON(
        basePayloadWithMove({ kind: 'mystery', from: '1', to: '2', piece: 'pawn', capture: [] }),
      ),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on non-string from/to', () => {
    expect(() =>
      ser.fromJSON(
        basePayloadWithMove({ kind: 'pawn-step', from: 1, to: 2, piece: 'pawn', capture: [] }),
      ),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on invalid piece kind in move record', () => {
    expect(() =>
      ser.fromJSON(
        basePayloadWithMove({
          kind: 'pawn-step',
          from: '1',
          to: '2',
          piece: 'queen',
          capture: [],
        }),
      ),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on capture not an array', () => {
    expect(() =>
      ser.fromJSON(
        basePayloadWithMove({
          kind: 'pawn-jump',
          from: '1',
          to: '2',
          piece: 'pawn',
          capture: 'not-an-array',
        }),
      ),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on capture entry not a string', () => {
    expect(() =>
      ser.fromJSON(
        basePayloadWithMove({
          kind: 'pawn-jump',
          from: '1',
          to: '2',
          piece: 'pawn',
          capture: [42],
        }),
      ),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on meta.path entry not int', () => {
    expect(() =>
      ser.fromJSON(
        basePayloadWithMove({
          kind: 'pawn-step',
          from: '1',
          to: '2',
          piece: 'pawn',
          capture: [],
          meta: { path: ['foo'] },
        }),
      ),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on meta.directions entry not string', () => {
    expect(() =>
      ser.fromJSON(
        basePayloadWithMove({
          kind: 'pawn-step',
          from: '1',
          to: '2',
          piece: 'pawn',
          capture: [],
          meta: { directions: [42] },
        }),
      ),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on meta.camelOffset entries not numbers', () => {
    expect(() =>
      ser.fromJSON(
        basePayloadWithMove({
          kind: 'camel-leap',
          from: '1',
          to: '2',
          piece: 'camel',
          capture: [],
          meta: { camelOffset: ['a', 'b'] },
        }),
      ),
    ).toThrow(CheskersSerializerCorruptionError);
  });

  it('decodes a move record carrying every optional meta field (Pawn jump)', () => {
    const decoded = ser.fromJSON(
      basePayloadWithMove({
        kind: 'pawn-jump',
        from: '18',
        to: '4',
        piece: 'pawn',
        capture: ['15', '8'],
        promotion: 'king',
        meta: {
          owner: 'white',
          fromNode: 35,
          toNode: 7,
          path: [35, 21, 7],
          directions: ['ne', 'ne'],
        },
      }),
    );
    expect(decoded.moveHistory).toHaveLength(1);
    const m = decoded.moveHistory[0] as CheskersMove;
    expect(m.promotion).toBe('king');
    expect(m.meta?.owner).toBe('white');
    expect(m.meta?.path).toEqual([35, 21, 7]);
    expect(m.meta?.directions).toEqual(['ne', 'ne']);
  });

  it('decodes a Camel-leap move with camelOffset', () => {
    const decoded = ser.fromJSON(
      basePayloadWithMove({
        kind: 'camel-leap',
        from: '18',
        to: '10',
        piece: 'camel',
        capture: [],
        meta: { camelOffset: [-3, -1] },
      }),
    );
    const m = decoded.moveHistory[0] as CheskersMove;
    expect(m.meta?.camelOffset).toEqual([-3, -1]);
  });

  it('throws on kingCount not an object', () => {
    const start = buildState({ pieces: { d4: 'K', e5: 'k' }, turn: 'white' });
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, kingCount: 'huh' };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('throws on kingCount entries not numbers', () => {
    const start = buildState({ pieces: { d4: 'K', e5: 'k' }, turn: 'white' });
    const json = ser.toJSON(start) as object;
    const tampered = { ...json, kingCount: { white: 'a', black: 'b' } };
    expect(() => ser.fromJSON(tampered)).toThrow(CheskersSerializerCorruptionError);
  });

  it('accepts kingCount undefined (optional field)', () => {
    const start = buildState({ pieces: { d4: 'K', e5: 'k' }, turn: 'white' });
    const json = ser.toJSON(start) as Record<string, unknown>;
    delete json.kingCount;
    expect(() => ser.fromJSON(json)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Zobrist edge cases
// ---------------------------------------------------------------------------

describe('hashPosition — defensive skips', () => {
  it('skips pieces with invalid owner (defensive)', () => {
    _clearHashTableCacheForTests();
    const node = CFG.boardGeometry.coordinateLabels.parseNotation('d4') as NodeId;
    const pieces = new Map<NodeId, ClassifiedPiece>();
    pieces.set(node, { owner: 'gray' as 'white', kind: 'pawn' });
    const hashWithBogus = hashPosition(pieces, 'white', CFG);
    const hashEmpty = hashPosition(new Map(), 'white', CFG);
    expect(hashWithBogus).toBe(hashEmpty);
  });

  it('skips pieces with invalid kind (defensive)', () => {
    _clearHashTableCacheForTests();
    const node = CFG.boardGeometry.coordinateLabels.parseNotation('d4') as NodeId;
    const pieces = new Map<NodeId, ClassifiedPiece>();
    pieces.set(node, { owner: 'white', kind: 'queen' as 'pawn' });
    const hashWithBogus = hashPosition(pieces, 'white', CFG);
    const hashEmpty = hashPosition(new Map(), 'white', CFG);
    expect(hashWithBogus).toBe(hashEmpty);
  });
});

// ---------------------------------------------------------------------------
// Starting position error path
// ---------------------------------------------------------------------------

describe('CheskersStartingPositionMismatchError', () => {
  it('has the expected name + message', () => {
    const err = new CheskersStartingPositionMismatchError(24, 22);
    expect(err.name).toBe('CheskersStartingPositionMismatchError');
    expect(err.message).toContain('expected 24');
    expect(err.message).toContain('got 22');
  });
});

// ---------------------------------------------------------------------------
// Repetition arithmetic
// ---------------------------------------------------------------------------

describe('Cheskers meta — repetitionTable arithmetic via apply', () => {
  it('repetition count for the post-move position increments by 1', () => {
    const state = buildState({ pieces: { d2: 'P' }, turn: 'white' });
    const moves = computeLegalMoves(state, CFG);
    const next = applyCheskersMove(state, moves[0] as CheskersMove, CFG);
    expect(next.meta.repetitionTable.length).toBeGreaterThan(0);
    const totalAfter = next.meta.repetitionTable.reduce((s, [, c]) => s + c, 0);
    const totalBefore = state.meta.repetitionTable.reduce((s, [, c]) => s + c, 0);
    expect(totalAfter).toBe(totalBefore + 1);
  });
});
