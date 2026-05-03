import { describe, expect, it } from 'vitest';
import { DAMEO_HAND_VERIFIED_SCENARIOS } from '../fixtures/dameo.handVerified';
import { applyLinearMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildState, configFor, pieceSpecAt } from '../testHelpers';
import type { LinearMove } from '../types';

describe('applyLinearMove — Dameo canonical fixtures', () => {
  const config = configFor('dameo');
  for (const scenario of DAMEO_HAND_VERIFIED_SCENARIOS) {
    if (!scenario.canonical) continue;
    const can = scenario.canonical;
    it(`${scenario.id}: applying ${can.from}→${can.to} produces the expected pieces map`, () => {
      const state = buildState({
        config,
        turn: scenario.turn,
        pieces: scenario.pieces,
      });
      const moves = computeLegalMoves(state, config);
      const fromNode = config.boardGeometry.coordinateLabels.parseNotation(can.from);
      const toNode = config.boardGeometry.coordinateLabels.parseNotation(can.to);
      const move = moves.find((m) => {
        if (can.kind && m.kind !== can.kind) return false;
        const mf = config.boardGeometry.coordinateLabels.parseNotation(m.from);
        const mt = config.boardGeometry.coordinateLabels.parseNotation(m.to);
        return mf === fromNode && mt === toNode;
      });
      expect(move).toBeDefined();
      const next = applyLinearMove(state, move as LinearMove, config);

      for (const [label, spec] of Object.entries(can.expectedPieces)) {
        expect(pieceSpecAt(next, label, config)).toBe(spec);
      }

      // Verify no surprising occupied squares.
      const expectedNodes = new Set(
        Object.keys(can.expectedPieces).map(
          (label) => config.boardGeometry.coordinateLabels.parseNotation(label) as unknown as number,
        ),
      );
      const sourceNode = config.boardGeometry.coordinateLabels.parseNotation(can.from);
      // Add the input pieces minus from/captures/group-members.
      for (const inputLabel of Object.keys(scenario.pieces)) {
        const node = config.boardGeometry.coordinateLabels.parseNotation(inputLabel);
        if (node === null) continue;
        if ((node as unknown as number) === (sourceNode as unknown as number)) continue;
        if (
          can.captures &&
          can.captures.some(
            (c) =>
              (config.boardGeometry.coordinateLabels.parseNotation(c) as unknown as number) ===
              (node as unknown as number),
          )
        ) {
          continue;
        }
        expectedNodes.add(node as unknown as number);
      }

      for (const node of next.pieces.keys()) {
        expect(
          expectedNodes.has(node as unknown as number),
          `unexpected occupied node ${String(node)}`,
        ).toBe(true);
      }
    });
  }
});

describe('applyLinearMove — invariants', () => {
  const config = configFor('dameo');

  it('input state is never mutated', () => {
    const state = buildState({ config, pieces: { e3: 'm' } });
    const moves = computeLegalMoves(state, config);
    const move = moves[0];
    expect(move).toBeDefined();
    const piecesSnap = JSON.stringify([...state.pieces.entries()]);
    applyLinearMove(state, move as LinearMove, config);
    expect(JSON.stringify([...state.pieces.entries()])).toBe(piecesSnap);
  });

  it('plyCount increments by 1', () => {
    const state = buildState({ config, pieces: { e3: 'm' } });
    const next = applyLinearMove(
      state,
      computeLegalMoves(state, config)[0] as LinearMove,
      config,
    );
    expect(next.plyCount).toBe(1);
  });

  it('halfMoveClock resets to 0 on capture', () => {
    const state = buildState({
      config,
      pieces: { e3: 'm', e4: 'b' },
      halfMoveClock: 7,
    });
    const moves = computeLegalMoves(state, config);
    const next = applyLinearMove(state, moves[0] as LinearMove, config);
    expect(next.meta.halfMoveClock).toBe(0);
  });

  it('halfMoveClock increments on a step', () => {
    const state = buildState({
      config,
      pieces: { e3: 'm' },
      halfMoveClock: 3,
    });
    const moves = computeLegalMoves(state, config);
    const next = applyLinearMove(state, moves[0] as LinearMove, config);
    expect(next.meta.halfMoveClock).toBe(4);
  });

  it('turn toggles after each move', () => {
    const state = buildState({ config, turn: 'white', pieces: { e3: 'm' } });
    const next = applyLinearMove(
      state,
      computeLegalMoves(state, config)[0] as LinearMove,
      config,
    );
    expect(next.turn).toBe('black');
  });

  it('moveHistory grows by 1', () => {
    const state = buildState({ config, pieces: { e3: 'm' } });
    const next = applyLinearMove(
      state,
      computeLegalMoves(state, config)[0] as LinearMove,
      config,
    );
    expect(next.moveHistory).toHaveLength(state.moveHistory.length + 1);
  });

  it('group-advance translates every member forward by one square', () => {
    const state = buildState({
      config,
      pieces: { c3: 'm', d3: 'm', e3: 'm' },
    });
    const moves = computeLegalMoves(state, config);
    const groupMove = moves.find((m) => m.kind === 'group-advance');
    expect(groupMove).toBeDefined();
    const next = applyLinearMove(state, groupMove as LinearMove, config);
    // Every member should be one row forward (algebraic rank +1).
    expect(pieceSpecAt(next, 'c4', config)).toBe('m');
    expect(pieceSpecAt(next, 'd4', config)).toBe('m');
    expect(pieceSpecAt(next, 'e4', config)).toBe('m');
    expect(pieceSpecAt(next, 'c3', config)).toBe('_');
    expect(pieceSpecAt(next, 'd3', config)).toBe('_');
    expect(pieceSpecAt(next, 'e3', config)).toBe('_');
  });

  it('capture chain removes ALL victims atomically at terminal commit', () => {
    const state = buildState({
      config,
      pieces: { e3: 'm', e4: 'b', e6: 'b' },
    });
    const moves = computeLegalMoves(state, config);
    const cap = moves.find((m) => m.kind === 'capture' && m.capture.length === 2);
    expect(cap).toBeDefined();
    const next = applyLinearMove(state, cap as LinearMove, config);
    expect(pieceSpecAt(next, 'e4', config)).toBe('_');
    expect(pieceSpecAt(next, 'e6', config)).toBe('_');
    expect(pieceSpecAt(next, 'e7', config)).toBe('m');
  });
});
