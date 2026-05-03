import { describe, expect, it } from 'vitest';
import { ZAMMA_HAND_VERIFIED_SCENARIOS } from '../fixtures/zamma.handVerified';
import {
  computeLegalMoves,
  generateCaptureMoves,
  generateSimpleMoves,
} from '../moveGen';
import { buildStartingState } from '../startingPosition';
import { buildState, configFor } from '../testHelpers';

function nodeIdEqual(label: string, target: string, geom: import('../../../boardGeometry').BoardGeometry): boolean {
  const a = geom.coordinateLabels.parseNotation(label);
  const b = geom.coordinateLabels.parseNotation(target);
  return a !== null && b !== null && (a as unknown as number) === (b as unknown as number);
}

describe('moveGen — Zamma hand-verified fixtures', () => {
  const config = configFor('zamma');
  for (const scenario of ZAMMA_HAND_VERIFIED_SCENARIOS) {
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
  const config = configFor('zamma');

  it('captures suppress simple steps when present', () => {
    const state = buildState({ config, pieces: { e5: 'm', e6: 'b' } });
    const moves = computeLegalMoves(state, config);
    expect(moves.every((m) => m.kind === 'capture')).toBe(true);
  });

  it('Zamma men cannot capture diagonally from a no-diagonals node', () => {
    // d5 = (r=4, c=3), r+c=7 odd → no diagonals.
    const state = buildState({ config, pieces: { d5: 'm', c6: 'b' } });
    const captures = generateCaptureMoves(state, config);
    expect(captures).toHaveLength(0);
  });

  it('Zamma men CAN capture diagonally from a has-diagonals node', () => {
    const state = buildState({ config, pieces: { e5: 'm', d6: 'b' } });
    const captures = generateCaptureMoves(state, config);
    expect(captures.length).toBeGreaterThanOrEqual(1);
  });

  it('Zamma men cannot capture backward (forward-only default)', () => {
    const state = buildState({ config, pieces: { e5: 'm', e4: 'b' } });
    const captures = generateCaptureMoves(state, config);
    expect(captures).toHaveLength(0);
  });

  it('Mullah captures backward (Mullahs ignore forward-only)', () => {
    const state = buildState({ config, pieces: { e5: 'M', e4: 'b' } });
    const captures = generateCaptureMoves(state, config);
    expect(captures).toHaveLength(1);
  });

  it('moves are sorted deterministically', () => {
    const state = buildState({ config, pieces: { e5: 'm', d5: 'm' } });
    const moves1 = computeLegalMoves(state, config);
    const moves2 = computeLegalMoves(state, config);
    expect(moves1).toEqual(moves2);
  });

  it('simple-move generator returns no moves when only opponent pieces exist', () => {
    const state = buildState({ config, turn: 'white', pieces: { e6: 'b' } });
    expect(generateSimpleMoves(state, config)).toHaveLength(0);
  });

  it('multi-jump chain along orthogonal column for a man', () => {
    const state = buildState({
      config,
      pieces: { e5: 'm', e6: 'b', e8: 'b' },
    });
    const moves = computeLegalMoves(state, config);
    const longChain = moves.find((m) => m.kind === 'capture' && m.capture.length === 2);
    expect(longChain).toBeDefined();
  });

  it('starting position has at least one legal move', () => {
    const start = buildStartingState(config);
    const moves = computeLegalMoves(start, config);
    expect(moves.length).toBeGreaterThan(0);
  });
});
