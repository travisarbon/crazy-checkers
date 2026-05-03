import { describe, expect, it } from 'vitest';
import { MAK_YEK_HAND_VERIFIED_SCENARIOS } from '../fixtures/makYek.handVerified';
import { HASAMI_SHOGI_HAND_VERIFIED_SCENARIOS } from '../fixtures/hasamiShogi.handVerified';
import { REK_HAND_VERIFIED_SCENARIOS } from '../fixtures/rek.handVerified';
import { DAI_HASAMI_SHOGI_HAND_VERIFIED_SCENARIOS } from '../fixtures/daiHasamiShogi.handVerified';
import {
  computeLegalMoves,
  generateJumpMoves,
  generateSlideMoves,
} from '../moveGen';
import { buildState } from '../testHelpers';
import { createMakYekConfig } from '../makYekConfig';
import { createHasamiShogiConfig } from '../hasamiShogiConfig';
import { createRekConfig } from '../rekConfig';
import { createDaiHasamiShogiConfig } from '../daiHasamiShogiConfig';

const MAK = createMakYekConfig();
const HSG = createHasamiShogiConfig();
const REK = createRekConfig();
const DH = createDaiHasamiShogiConfig();

function nodeIdEqual(label: string, target: string, geom: import('../../../boardGeometry').BoardGeometry): boolean {
  const a = geom.coordinateLabels.parseNotation(label);
  const b = geom.coordinateLabels.parseNotation(target);
  return a !== null && b !== null && (a as unknown as number) === (b as unknown as number);
}

describe('moveGen — Mak-yek hand-verified fixtures', () => {
  for (const scenario of MAK_YEK_HAND_VERIFIED_SCENARIOS) {
    describe(`${scenario.id}: ${scenario.description}`, () => {
      const state = buildState({
        config: MAK,
        turn: scenario.turn,
        pieces: scenario.pieces,
      });
      const moves = computeLegalMoves(state, MAK);
      if (scenario.expectedMoveCount !== undefined) {
        it(`has ${String(scenario.expectedMoveCount)} legal moves`, () => {
          expect(moves).toHaveLength(scenario.expectedMoveCount as number);
        });
      }
      if (scenario.canonical) {
        it('contains the canonical move', () => {
          const can = scenario.canonical;
          if (!can) throw new Error('unreachable');
          const match = moves.find(
            (m) =>
              (can.kind === undefined || m.kind === can.kind) &&
              nodeIdEqual(m.from, can.from, MAK.boardGeometry) &&
              nodeIdEqual(m.to, can.to, MAK.boardGeometry),
          );
          expect(match).toBeDefined();
        });
      }
      it('returns a defined move array', () => {
        expect(Array.isArray(moves)).toBe(true);
      });
    });
  }
});

describe('moveGen — Hasami Shogi hand-verified fixtures', () => {
  for (const scenario of HASAMI_SHOGI_HAND_VERIFIED_SCENARIOS) {
    describe(`${scenario.id}: ${scenario.description}`, () => {
      const state = buildState({
        config: HSG,
        turn: scenario.turn,
        pieces: scenario.pieces,
      });
      const moves = computeLegalMoves(state, HSG);
      if (scenario.expectedMoveCount !== undefined) {
        it(`has ${String(scenario.expectedMoveCount)} legal moves`, () => {
          expect(moves).toHaveLength(scenario.expectedMoveCount as number);
        });
      }
      it('returns a defined move array', () => {
        expect(Array.isArray(moves)).toBe(true);
      });
    });
  }
});

describe('moveGen — Rek hand-verified fixtures', () => {
  for (const scenario of REK_HAND_VERIFIED_SCENARIOS) {
    describe(`${scenario.id}: ${scenario.description}`, () => {
      const state = buildState({
        config: REK,
        turn: scenario.turn,
        pieces: scenario.pieces,
      });
      const moves = computeLegalMoves(state, REK);
      if (scenario.expectedMoveCount !== undefined) {
        it(`has ${String(scenario.expectedMoveCount)} legal moves`, () => {
          expect(moves).toHaveLength(scenario.expectedMoveCount as number);
        });
      }
      it('returns a defined move array', () => {
        expect(Array.isArray(moves)).toBe(true);
      });
    });
  }
});

describe('moveGen — Dai Hasami Shogi hand-verified fixtures', () => {
  for (const scenario of DAI_HASAMI_SHOGI_HAND_VERIFIED_SCENARIOS) {
    describe(`${scenario.id}: ${scenario.description}`, () => {
      const state = buildState({
        config: DH,
        turn: scenario.turn,
        pieces: scenario.pieces,
      });
      const moves = computeLegalMoves(state, DH);
      if (scenario.expectedMoveCount !== undefined) {
        it(`has ${String(scenario.expectedMoveCount)} legal moves`, () => {
          expect(moves).toHaveLength(scenario.expectedMoveCount as number);
        });
      }
      it('returns a defined move array', () => {
        expect(Array.isArray(moves)).toBe(true);
      });
    });
  }
});

describe('moveGen — invariants', () => {
  it('Mak-yek slide blocked by friendly is suppressed', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'm', e6: 'm' } });
    const slides = generateSlideMoves(state, MAK);
    // e4 N can reach e5 only (e6 blocks).
    const e4N = slides.filter((m) => m.from === 'e4' && (m.to === 'e7' || m.to === 'e8'));
    expect(e4N).toHaveLength(0);
  });

  it('Mak-yek slide cannot land on enemy', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'm', e6: 'b' } });
    const slides = generateSlideMoves(state, MAK);
    expect(slides.some((m) => m.from === 'e4' && m.to === 'e6')).toBe(false);
  });

  it('Dai Hasami non-capturing single-jump produces a jump move', () => {
    const state = buildState({ config: DH, pieces: { e5: 'm', e6: 'm' } });
    const jumps = generateJumpMoves(state, DH);
    expect(jumps.length).toBeGreaterThanOrEqual(1);
  });

  it('Dai Hasami jump suppressed when landing is occupied', () => {
    const state = buildState({ config: DH, pieces: { e5: 'm', e6: 'b', e7: 'm' } });
    const jumps = generateJumpMoves(state, DH);
    expect(jumps.some((m) => m.from === 'e5' && m.to === 'e7')).toBe(false);
  });

  it('Hasami Shogi has no jump moves (jump disabled in config)', () => {
    const state = buildState({ config: HSG, pieces: { e5: 'm', e6: 'm' } });
    const jumps = generateJumpMoves(state, HSG);
    expect(jumps).toHaveLength(0);
  });

  it('moves are sorted deterministically', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'm', a1: 'b' } });
    const moves1 = computeLegalMoves(state, MAK);
    const moves2 = computeLegalMoves(state, MAK);
    expect(moves1).toEqual(moves2);
  });

  it('no capture obligation: simple steps remain when captures exist', () => {
    // White can step OR capture; both are in the legal-move list.
    const state = buildState({ config: MAK, pieces: { d8: 'm', e4: 'b', f4: 'm' } });
    const moves = computeLegalMoves(state, MAK);
    // Some moves don't trigger capture; some do. The list should include both.
    expect(moves.length).toBeGreaterThan(1);
  });
});
