import { describe, expect, it } from 'vitest';
import { LASCA_HAND_VERIFIED_SCENARIOS } from '../fixtures/lasca.handVerified';
import { BASHNI_HAND_VERIFIED_SCENARIOS } from '../fixtures/bashni.handVerified';
import { computeLegalMoves, generateJumpSequences, generateSimpleMoves } from '../moveGen';
import { buildState, configFor } from '../testHelpers';

function nodeIdEqual(label: string, target: string, geom: import('../../../boardGeometry').BoardGeometry): boolean {
  const a = geom.coordinateLabels.parseNotation(label);
  const b = geom.coordinateLabels.parseNotation(target);
  return a !== null && b !== null && (a as unknown as number) === (b as unknown as number);
}

describe('moveGen — Lasca hand-verified fixtures', () => {
  const config = configFor('lasca');
  for (const scenario of LASCA_HAND_VERIFIED_SCENARIOS) {
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

      if (scenario.canonical) {
        it('contains the canonical move', () => {
          const can = scenario.canonical;
          if (!can) throw new Error('unreachable');
          const match = moves.find(
            (m) =>
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

describe('moveGen — Bashni hand-verified fixtures', () => {
  const config = configFor('bashni');
  for (const scenario of BASHNI_HAND_VERIFIED_SCENARIOS) {
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

      if (scenario.canonical) {
        it('contains the canonical move', () => {
          const can = scenario.canonical;
          if (!can) throw new Error('unreachable');
          const match = moves.find(
            (m) =>
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
  it('Lasca: capture obligation suppresses simple steps when jumps exist', () => {
    const config = configFor('lasca');
    const state = buildState({
      config,
      pieces: { '16': 'm', '13': 'b' }, // c3 jumps d4 to e5.
    });
    const moves = computeLegalMoves(state, config);
    expect(moves.every((m) => m.kind === 'capture')).toBe(true);
  });

  it('Lasca: max-mandatory pruning keeps only the longest chain', () => {
    const config = configFor('lasca');
    const state = buildState({
      config,
      pieces: { '16': 'm', '13': 'b', '7': 'b', '20': 'b' },
    });
    const moves = computeLegalMoves(state, config);
    expect(moves).toHaveLength(1);
    expect(moves[0]?.capture).toHaveLength(2);
  });

  it('Bashni: NO max-mandatory pruning — multiple lengths coexist', () => {
    const config = configFor('bashni');
    // White man at c3 with two single-jump options (forward + backward).
    const state = buildState({
      config,
      pieces: { '22': 'm', '17': 'b', '26': 'b' },
    });
    const moves = computeLegalMoves(state, config);
    expect(moves.filter((m) => m.kind === 'capture')).toHaveLength(2);
  });

  it('Lasca: men cannot capture backward', () => {
    const config = configFor('lasca');
    // White man at c5 with a black man behind (b4) — c5 should not be able to jump backward.
    const state = buildState({
      config,
      pieces: { '9': 'm', '12': 'b' },
    });
    const jumps = generateJumpSequences(state, config);
    expect(jumps).toHaveLength(0);
  });

  it('Bashni: men CAN capture backward', () => {
    const config = configFor('bashni');
    const state = buildState({
      config,
      pieces: { '22': 'm', '26': 'b' },
    });
    const jumps = generateJumpSequences(state, config);
    expect(jumps).toHaveLength(1);
  });

  it('moves are sorted deterministically', () => {
    const config = configFor('lasca');
    const state = buildState({
      config,
      pieces: { '17': 'M' },
    });
    const moves = computeLegalMoves(state, config);
    const moves2 = computeLegalMoves(state, config);
    expect(moves).toEqual(moves2);
  });

  it('simple-move generator returns no moves when only opponent pieces exist', () => {
    const config = configFor('lasca');
    const state = buildState({ config, turn: 'white', pieces: { '13': 'b' } });
    expect(generateSimpleMoves(state, config)).toHaveLength(0);
  });
});
