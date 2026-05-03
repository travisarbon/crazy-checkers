import { describe, expect, it } from 'vitest';
import { applyCustodianMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildState, pieceSpecAt } from '../testHelpers';
import { createMakYekConfig } from '../makYekConfig';
import { createHasamiShogiConfig } from '../hasamiShogiConfig';
import { createRekConfig } from '../rekConfig';
import { createDaiHasamiShogiConfig } from '../daiHasamiShogiConfig';
import type { CustodianMove } from '../types';

const MAK = createMakYekConfig();
const HSG = createHasamiShogiConfig();
const REK = createRekConfig();
const DH = createDaiHasamiShogiConfig();

describe('applyCustodianMove — Mak-yek', () => {
  it('slide with custodian capture removes the sandwiched opponent', () => {
    const state = buildState({
      config: MAK,
      pieces: { d8: 'm', f4: 'm', e4: 'b' },
    });
    const moves = computeLegalMoves(state, MAK);
    const move = moves.find((m) => m.from === 'd8' && m.to === 'd4') as CustodianMove;
    expect(move).toBeDefined();
    const next = applyCustodianMove(state, move, MAK);
    expect(pieceSpecAt(next, 'e4', MAK)).toBe('_');
    expect(pieceSpecAt(next, 'd4', MAK)).toBe('m');
    expect(pieceSpecAt(next, 'f4', MAK)).toBe('m');
  });

  it('slide with custodian + intervention combined removes 3 opponents', () => {
    const state = buildState({
      config: MAK,
      pieces: { e1: 'm', e5: 'b', e6: 'm', d4: 'b', f4: 'b' },
    });
    const moves = computeLegalMoves(state, MAK);
    const move = moves.find((m) => m.from === 'e1' && m.to === 'e4') as CustodianMove;
    expect(move).toBeDefined();
    const next = applyCustodianMove(state, move, MAK);
    expect(pieceSpecAt(next, 'd4', MAK)).toBe('_');
    expect(pieceSpecAt(next, 'e5', MAK)).toBe('_');
    expect(pieceSpecAt(next, 'f4', MAK)).toBe('_');
    expect(pieceSpecAt(next, 'e4', MAK)).toBe('m');
    expect(next.moveHistory[0]?.capture).toHaveLength(3);
  });

  it('slide with no captures leaves piece counts unchanged', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'm' } });
    const moves = computeLegalMoves(state, MAK);
    const move = moves[0] as CustodianMove;
    const next = applyCustodianMove(state, move, MAK);
    expect(next.pieces.size).toBe(state.pieces.size);
  });
});

describe('applyCustodianMove — Hasami Shogi corner capture', () => {
  it('removes opponent at corner when a move triggers the corner pattern', () => {
    const state = buildState({
      config: HSG,
      pieces: { a1: 'b', a2: 'm', b1: 'm', i9: 'm' },
    });
    const moves = computeLegalMoves(state, HSG);
    const move = moves.find((m) => m.from === 'i9' && m.to === 'c9') as CustodianMove;
    expect(move).toBeDefined();
    const next = applyCustodianMove(state, move, HSG);
    expect(pieceSpecAt(next, 'a1', HSG)).toBe('_');
    expect(pieceSpecAt(next, 'c9', HSG)).toBe('m');
  });
});

describe('applyCustodianMove — Rek immobilization', () => {
  it('removes the entire immobilized opponent group atomically', () => {
    const state = buildState({
      config: REK,
      pieces: { a8: 'm', h1: 'b', g1: 'm', h2: 'm', a1: 'K', h8: 'k' },
    });
    const moves = computeLegalMoves(state, REK);
    // Any white move triggers the post-move immobilization scan.
    const move = moves[0] as CustodianMove;
    const next = applyCustodianMove(state, move, REK);
    expect(pieceSpecAt(next, 'h1', REK)).toBe('_');
  });
});

describe('applyCustodianMove — Dai Hasami', () => {
  it('5-in-a-row outside own starting ranks populates winningLines', () => {
    // White starting ranks for Dai Hasami = rows 0..1.
    // Place 4 white men at a5..d5 and 1 white at f5 (the 5th could be the just-moved piece).
    // Move to complete the 5-in-a-row: place white at e1 (some safe square),
    // then move e1 → e5? But e1 to e5 must be a legal slide (file e clear).
    //
    // Simpler: place 4 white men at a5..d5 already, then move e1 → e5 (last step
    // completing 5-in-a-row on row 5 = a5,b5,c5,d5,e5).
    //
    // Wait — we need to ensure e5 is empty pre-move and e1 has a clear slide to e5.
    const state = buildState({
      config: DH,
      pieces: { a5: 'm', b5: 'm', c5: 'm', d5: 'm', e1: 'm' },
    });
    const moves = computeLegalMoves(state, DH);
    const move = moves.find((m) => m.from === 'e1' && m.to === 'e5') as CustodianMove;
    expect(move).toBeDefined();
    const next = applyCustodianMove(state, move, DH);
    expect(next.meta.winningLines).not.toBeNull();
    expect(next.meta.winningLines?.length).toBeGreaterThan(0);
  });

  it('5-in-a-row inside own starting ranks does NOT populate winningLines', () => {
    // White starting ranks = rows 0..1 (a9..i8). 5-in-a-row on row 9 is excluded.
    // Position white at a9..d9 and stage move to complete e9.
    // Need a white piece that can slide to e9 — e1 → e9 (file e clear).
    const state = buildState({
      config: DH,
      pieces: { a9: 'm', b9: 'm', c9: 'm', d9: 'm', e1: 'm' },
    });
    const moves = computeLegalMoves(state, DH);
    const move = moves.find((m) => m.from === 'e1' && m.to === 'e9') as CustodianMove;
    expect(move).toBeDefined();
    const next = applyCustodianMove(state, move, DH);
    expect(next.meta.winningLines).toBeNull();
  });
});

describe('applyCustodianMove — invariants', () => {
  it('input state is never mutated', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'm' } });
    const moves = computeLegalMoves(state, MAK);
    const piecesSnap = JSON.stringify([...state.pieces.entries()]);
    applyCustodianMove(state, moves[0] as CustodianMove, MAK);
    expect(JSON.stringify([...state.pieces.entries()])).toBe(piecesSnap);
  });

  it('plyCount increments by 1', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'm' } });
    const next = applyCustodianMove(
      state,
      computeLegalMoves(state, MAK)[0] as CustodianMove,
      MAK,
    );
    expect(next.plyCount).toBe(1);
  });

  it('halfMoveClock resets to 0 on capture', () => {
    const state = buildState({
      config: MAK,
      pieces: { d8: 'm', f4: 'm', e4: 'b' },
      halfMoveClock: 7,
    });
    const moves = computeLegalMoves(state, MAK);
    const move = moves.find((m) => m.from === 'd8' && m.to === 'd4') as CustodianMove;
    const next = applyCustodianMove(state, move, MAK);
    expect(next.meta.halfMoveClock).toBe(0);
  });

  it('halfMoveClock increments on a non-capture move', () => {
    const state = buildState({
      config: MAK,
      pieces: { e4: 'm' },
      halfMoveClock: 3,
    });
    const moves = computeLegalMoves(state, MAK);
    const next = applyCustodianMove(state, moves[0] as CustodianMove, MAK);
    expect(next.meta.halfMoveClock).toBe(4);
  });

  it('turn toggles after each move', () => {
    const state = buildState({ config: MAK, turn: 'white', pieces: { e4: 'm' } });
    const next = applyCustodianMove(
      state,
      computeLegalMoves(state, MAK)[0] as CustodianMove,
      MAK,
    );
    expect(next.turn).toBe('black');
  });
});
