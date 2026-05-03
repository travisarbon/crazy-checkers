import { describe, expect, it } from 'vitest';
import { HARZDAME_HAND_VERIFIED_SCENARIOS } from '../fixtures/harzdame.handVerified';
import {
  computeLegalMoves,
  filterMaximumCapture,
  generateCaptureMoves,
  generateStepMoves,
  maxCaptureChainLength,
} from '../moveGen';
import { buildState } from '../testHelpers';
import { createHarzdameConfig, type HarzdameConfig } from '../types';

const CFG = createHarzdameConfig();

function nodeIdEqual(label: string, target: string, geom: import('../../../boardGeometry').BoardGeometry): boolean {
  const a = geom.coordinateLabels.parseNotation(label);
  const b = geom.coordinateLabels.parseNotation(target);
  return a !== null && b !== null && (a as unknown as number) === (b as unknown as number);
}

describe('moveGen — Harzdame hand-verified fixtures', () => {
  for (const scenario of HARZDAME_HAND_VERIFIED_SCENARIOS) {
    describe(`${scenario.id}: ${scenario.description}`, () => {
      const state = buildState({
        config: CFG,
        turn: scenario.turn,
        pieces: scenario.pieces,
      });
      const moves = computeLegalMoves(state, CFG);
      if (scenario.expectedMoveCount !== undefined) {
        it(`has ${String(scenario.expectedMoveCount)} legal moves`, () => {
          expect(moves).toHaveLength(scenario.expectedMoveCount as number);
        });
      }
      if (scenario.expectedCaptureCount !== undefined) {
        it(`has ${String(scenario.expectedCaptureCount)} legal capture chains`, () => {
          expect(moves.filter((m) => m.kind === 'capture')).toHaveLength(
            scenario.expectedCaptureCount as number,
          );
        });
      }
      if (scenario.canonical) {
        it('contains the canonical move', () => {
          const can = scenario.canonical;
          if (!can) throw new Error('unreachable');
          const match = moves.find(
            (m) =>
              (can.kind === undefined || m.kind === can.kind) &&
              nodeIdEqual(m.from, can.from, CFG.boardGeometry) &&
              nodeIdEqual(m.to, can.to, CFG.boardGeometry),
          );
          expect(match).toBeDefined();
          if (can.captures && match) {
            const matchCapsAsNodes = match.capture.map((c) =>
              CFG.boardGeometry.coordinateLabels.parseNotation(c) as unknown as number,
            );
            const expectedCapsAsNodes = can.captures.map((c) =>
              CFG.boardGeometry.coordinateLabels.parseNotation(c) as unknown as number,
            );
            expect(matchCapsAsNodes).toEqual(expectedCapsAsNodes);
          }
        });
      }
      it('returns a defined move array', () => {
        expect(Array.isArray(moves)).toBe(true);
      });
    });
  }
});

describe('moveGen — invariants', () => {
  it('Harzdame men move forward only — backward step is suppressed', () => {
    // White at PDN 17 = (4, 1). NE = (3, 2) = PDN 13. SE = (5, 2) = PDN 22.
    // Both empty. Verify SW (5, 0) = PDN 21 and NW (3, 0) = PDN 13... wait NW = (3, 0) but PDN 13 = (3, 0)? Yes — NW = (3, 0) = PDN 13.
    // OK actually PDN 13 = (r=3, c=0). So NE from 17 = (3, 2) = PDN 14? Let me recheck.
    // Actually from spike output: PDN 13 = (3, 0). NE from 17 (r=4,c=1) = (3, 2). What PDN is (3, 2)? Row 3 dark squares: c=0 and c=2 (since (r+c)%2 must be 1, r=3 odd so c even — c=0,2,4,6 → PDN 13,14,15,16). Yes PDN 14 = (3, 2).
    // And SE from 17 = (5, 2). Row 5: dark c=0,2,4,6 → PDN 21,22,23,24. PDN 22 = (5, 2). Yes.
    // So NE → PDN 14; SE → PDN 22.
    const state = buildState({ pieces: { '17': 'm' } });
    const moves = generateStepMoves(state, CFG);
    expect(moves).toHaveLength(2);
    // Verify NW + SW are NOT in the legal set.
    const targets = moves.map((m) => m.to).sort();
    expect(targets).toContain('14');
    expect(targets).toContain('22');
  });

  it('Harzdame men capture in all 4 directions', () => {
    // Setup white at 18 (r=4, c=3) with black neighbors in all 4 diagonals
    // such that each direction admits a jump landing on an empty square.
    //   NE: black at PDN 15 (r=3, c=4); landing past = (r=2, c=5) = PDN 11.
    //   NW: black at PDN 14 (r=3, c=2); landing past = (r=2, c=1) = PDN 9.
    //   SE: black at PDN 23 (r=5, c=4); landing past = (r=6, c=5) = PDN 27.
    //   SW: black at PDN 22 (r=5, c=2); landing past = (r=6, c=1) = PDN 25.
    // Verify ≥ 4 capture chains.
    const state = buildState({
      pieces: {
        '18': 'm',
        '15': 'b',
        '14': 'b',
        '23': 'b',
        '22': 'b',
      },
    });
    const captures = generateCaptureMoves(state, CFG);
    // The chains may extend beyond a single jump (immediate-removal allows
    // the man to land then continue). Just verify ≥ 4 distinct chains exist.
    expect(captures.length).toBeGreaterThanOrEqual(4);
  });

  it('flying king moves enumerate the entire ray until obstruction', () => {
    const state = buildState({ pieces: { '18': 'M' } });
    const moves = generateStepMoves(state, CFG);
    // From PDN 18 = (4, 3): NE=4, NW=3, SE=3, SW=3 = 13.
    expect(moves).toHaveLength(13);
  });

  it('flying king capture has multiple landings past the victim', () => {
    // King at PDN 18 = (4, 3). Black at PDN 15 = (3, 4) — NE neighbour.
    // Landings past 15 along NE: 11, 8, 4 (all empty) → 3 capture chains.
    const state = buildState({ pieces: { '18': 'M', '15': 'b' } });
    const captures = generateCaptureMoves(state, CFG);
    expect(captures.length).toBeGreaterThanOrEqual(3);
  });

  it('capture obligation drops simple steps', () => {
    const state = buildState({ pieces: { '18': 'm', '14': 'b' } });
    const moves = computeLegalMoves(state, CFG);
    expect(moves.every((m) => m.kind === 'capture')).toBe(true);
  });

  it('maximumCaptureMandatory knob OFF: short and long chains coexist', () => {
    // Two white men producing different-length chains:
    //   • 18 has a 2-leg NE chain 18 → over 15 → 11 → over 8 → 4.
    //   • 22 has a 1-leg NW chain 22 → over 17 → 13.
    // With maxCaptureMandatory=false (default), both surface as legal options.
    // (Within a single piece, chains MUST extend to local exhaustion under
    // immediate-removal semantics — the partial 18→11 is not surfaced.)
    const state = buildState({
      pieces: { '18': 'm', '22': 'm', '15': 'b', '8': 'b', '17': 'b' },
    });
    const captures = generateCaptureMoves(state, CFG);
    const lens = captures.map((c) => c.capture.length);
    expect(lens).toContain(1);
    expect(lens).toContain(2);
  });

  it('maximumCaptureMandatory knob ON: only longest chain surfaces', () => {
    const variant: HarzdameConfig = { ...CFG, maximumCaptureMandatory: true };
    const state = buildState({
      config: variant,
      pieces: { '18': 'm', '15': 'b', '8': 'b' },
    });
    const captures = generateCaptureMoves(state, variant);
    const filtered = filterMaximumCapture(captures, variant);
    expect(filtered.every((m) => m.capture.length === 2)).toBe(true);
  });

  it('moves are sorted deterministically', () => {
    const state = buildState({ pieces: { '17': 'm', '18': 'm', '14': 'b' } });
    const moves1 = computeLegalMoves(state, CFG);
    const moves2 = computeLegalMoves(state, CFG);
    expect(moves1).toEqual(moves2);
  });

  it('maxCaptureChainLength returns the position-max', () => {
    // Same setup as the maxCaptureMandatory tests — two-leg NE chain available.
    const state = buildState({
      pieces: { '18': 'm', '15': 'b', '8': 'b' },
    });
    expect(maxCaptureChainLength(state, CFG)).toBe(2);
  });

  it('maxCaptureChainLength returns 0 for a position with no captures', () => {
    const state = buildState({ pieces: { '17': 'm' } });
    expect(maxCaptureChainLength(state, CFG)).toBe(0);
  });
});
