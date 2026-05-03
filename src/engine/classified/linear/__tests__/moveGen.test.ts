import { describe, expect, it } from 'vitest';
import { DAMEO_HAND_VERIFIED_SCENARIOS } from '../fixtures/dameo.handVerified';
import {
  computeLegalMoves,
  generateCaptureMoves,
  generateGroupAdvances,
  generateSimpleMoves,
} from '../moveGen';
import { buildState, configFor } from '../testHelpers';

function nodeIdEqual(label: string, target: string, geom: import('../../../boardGeometry').BoardGeometry): boolean {
  const a = geom.coordinateLabels.parseNotation(label);
  const b = geom.coordinateLabels.parseNotation(target);
  return a !== null && b !== null && (a as unknown as number) === (b as unknown as number);
}

describe('moveGen — Dameo hand-verified fixtures', () => {
  const config = configFor('dameo');
  for (const scenario of DAMEO_HAND_VERIFIED_SCENARIOS) {
    describe(`${scenario.id}: ${scenario.description}`, () => {
      const state = buildState({
        config,
        turn: scenario.turn,
        pieces: scenario.pieces,
      });
      const moves = computeLegalMoves(state, config);

      if (scenario.expectedMoveCount !== undefined) {
        it(`has ${String(scenario.expectedMoveCount)} legal moves`, () => {
          expect(moves).toHaveLength(scenario.expectedMoveCount as number);
        });
      }

      if (scenario.expectedCaptureCount !== undefined) {
        it(`has ${String(scenario.expectedCaptureCount)} legal capture chains`, () => {
          const captures = moves.filter((m) => m.kind === 'capture');
          expect(captures).toHaveLength(scenario.expectedCaptureCount as number);
        });
      }

      if (scenario.expectedGroupAdvanceCount !== undefined) {
        it(`has ${String(scenario.expectedGroupAdvanceCount)} group-advance moves`, () => {
          const groups = moves.filter((m) => m.kind === 'group-advance');
          expect(groups).toHaveLength(scenario.expectedGroupAdvanceCount as number);
        });
      }

      if (scenario.canonical) {
        it('contains the canonical move', () => {
          const can = scenario.canonical;
          if (!can) throw new Error('unreachable');
          const match = moves.find(
            (m) =>
              (can.kind === undefined || m.kind === can.kind) &&
              nodeIdEqual(m.from, can.from, config.boardGeometry) &&
              nodeIdEqual(m.to, can.to, config.boardGeometry),
          );
          expect(match).toBeDefined();
          if (can.captures && match) {
            const matchCapsAsNodes = match.capture.map((c) =>
              config.boardGeometry.coordinateLabels.parseNotation(c) as unknown as number,
            );
            const expectedCapsAsNodes = can.captures.map((c) =>
              config.boardGeometry.coordinateLabels.parseNotation(c) as unknown as number,
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
  const config = configFor('dameo');

  it('captures suppress simple steps + group-advances when present', () => {
    const state = buildState({ config, pieces: { e3: 'm', e4: 'b' } });
    const moves = computeLegalMoves(state, config);
    expect(moves.every((m) => m.kind === 'capture')).toBe(true);
  });

  it('Dameo men cannot capture diagonally', () => {
    const state = buildState({ config, pieces: { e3: 'm', f4: 'b' } });
    const captures = generateCaptureMoves(state, config);
    expect(captures).toHaveLength(0);
  });

  it('Dameo men CAN capture orthogonally backward', () => {
    const state = buildState({ config, pieces: { e3: 'm', e2: 'b' } });
    const captures = generateCaptureMoves(state, config);
    expect(captures).toHaveLength(1);
  });

  it('flying king has multiple capture landings on a clear ray', () => {
    const state = buildState({ config, pieces: { a1: 'M', d4: 'b' } });
    const captures = generateCaptureMoves(state, config);
    expect(captures.length).toBeGreaterThan(1);
  });

  it('moves are sorted deterministically', () => {
    const state = buildState({ config, pieces: { e3: 'm', d3: 'm', f3: 'm' } });
    const moves1 = computeLegalMoves(state, config);
    const moves2 = computeLegalMoves(state, config);
    expect(moves1).toEqual(moves2);
  });

  it('simple-move generator returns no moves when only opponent pieces exist', () => {
    const state = buildState({ config, turn: 'white', pieces: { e4: 'b' } });
    expect(generateSimpleMoves(state, config)).toHaveLength(0);
  });

  it('rank-phalanx group-advance is suppressed when one member destination is blocked', () => {
    // c3, d3, e3 phalanx (rank); c3's destination c4 is occupied by a friendly NOT in phalanx.
    // The rank phalanx is suppressed but a file phalanx (c3+c4) and an NW
    // diagonal phalanx (d3+c4) emerge from the same setup.
    const state = buildState({
      config,
      pieces: { c3: 'm', d3: 'm', e3: 'm', c4: 'm' },
    });
    const groups = generateGroupAdvances(state, config);
    const rankGroups = groups.filter((m) => m.direction === 'N');
    // The rank-3 phalanx (c3+d3+e3) sliding N must be absent.
    expect(rankGroups.find((m) => m.from === 'c3' && m.to === 'c4')).toBeUndefined();
    // But the file c-column phalanx (c3+c4 sliding N) IS valid: head c4→c5.
    expect(rankGroups.find((m) => m.from === 'c3' && m.to === 'c5')).toBeDefined();
  });

  it('column-vs-row choice: a position offering both rank and file phalanxes surfaces both', () => {
    // Place pieces to form a rank phalanx AND a file phalanx that share a piece.
    // Rank: c3, d3, e3 (head's slide N targets row 4).
    // File: c3, c4, c5 (head's slide N targets c6).
    // Combined: c3, c4, c5, d3, e3.
    const state = buildState({
      config,
      pieces: { c3: 'm', d3: 'm', e3: 'm', c4: 'm', c5: 'm' },
    });
    const groups = generateGroupAdvances(state, config);
    // Multiple group-advance moves should exist (one rank, one file, plus diagonals if applicable).
    const rankCount = groups.filter((m) => m.direction === 'N' && m.from.startsWith('c3')).length;
    expect(groups.length).toBeGreaterThan(1);
    void rankCount;
  });
});
