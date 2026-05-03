import { describe, expect, it } from 'vitest';
import { ZAMMA_HAND_VERIFIED_SCENARIOS } from '../fixtures/zamma.handVerified';
import { applyAlquerqueMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildState, configFor, pieceSpecAt } from '../testHelpers';
import type { AlquerqueMove } from '../types';

describe('applyAlquerqueMove — Zamma canonical fixtures', () => {
  const config = configFor('zamma');
  for (const scenario of ZAMMA_HAND_VERIFIED_SCENARIOS) {
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
      const next = applyAlquerqueMove(state, move as AlquerqueMove, config);

      for (const [label, spec] of Object.entries(can.expectedPieces)) {
        expect(pieceSpecAt(next, label, config)).toBe(spec);
      }

      // Verify no surprising occupied intersections.
      const expectedNodes = new Set(
        Object.keys(can.expectedPieces).map(
          (label) => config.boardGeometry.coordinateLabels.parseNotation(label) as unknown as number,
        ),
      );
      const sourceNode = config.boardGeometry.coordinateLabels.parseNotation(can.from);
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

describe('applyAlquerqueMove — invariants', () => {
  const config = configFor('zamma');

  it('input state is never mutated', () => {
    const state = buildState({ config, pieces: { e5: 'm' } });
    const moves = computeLegalMoves(state, config);
    const move = moves[0];
    expect(move).toBeDefined();
    const piecesSnap = JSON.stringify([...state.pieces.entries()]);
    applyAlquerqueMove(state, move as AlquerqueMove, config);
    expect(JSON.stringify([...state.pieces.entries()])).toBe(piecesSnap);
  });

  it('plyCount increments by 1', () => {
    const state = buildState({ config, pieces: { e5: 'm' } });
    const next = applyAlquerqueMove(
      state,
      computeLegalMoves(state, config)[0] as AlquerqueMove,
      config,
    );
    expect(next.plyCount).toBe(1);
  });

  it('halfMoveClock resets to 0 on capture', () => {
    const state = buildState({
      config,
      pieces: { e5: 'm', e6: 'b' },
      halfMoveClock: 7,
    });
    const moves = computeLegalMoves(state, config);
    const next = applyAlquerqueMove(state, moves[0] as AlquerqueMove, config);
    expect(next.meta.halfMoveClock).toBe(0);
  });

  it('halfMoveClock increments on a step', () => {
    const state = buildState({
      config,
      pieces: { e5: 'm' },
      halfMoveClock: 3,
    });
    const moves = computeLegalMoves(state, config);
    const next = applyAlquerqueMove(state, moves[0] as AlquerqueMove, config);
    expect(next.meta.halfMoveClock).toBe(4);
  });

  it('turn toggles after each move', () => {
    const state = buildState({ config, turn: 'white', pieces: { e5: 'm' } });
    const next = applyAlquerqueMove(
      state,
      computeLegalMoves(state, config)[0] as AlquerqueMove,
      config,
    );
    expect(next.turn).toBe('black');
  });

  it('moveHistory grows by 1', () => {
    const state = buildState({ config, pieces: { e5: 'm' } });
    const next = applyAlquerqueMove(
      state,
      computeLegalMoves(state, config)[0] as AlquerqueMove,
      config,
    );
    expect(next.moveHistory).toHaveLength(state.moveHistory.length + 1);
  });

  it('capture chain removes ALL victims atomically at terminal commit', () => {
    const state = buildState({
      config,
      pieces: { e5: 'm', e6: 'b', e8: 'b' },
    });
    const moves = computeLegalMoves(state, config);
    const cap = moves.find((m) => m.kind === 'capture' && m.capture.length === 2);
    expect(cap).toBeDefined();
    const next = applyAlquerqueMove(state, cap as AlquerqueMove, config);
    expect(pieceSpecAt(next, 'e6', config)).toBe('_');
    expect(pieceSpecAt(next, 'e8', config)).toBe('_');
    expect(pieceSpecAt(next, 'e9', config)).toBe('M'); // promoted at terminal landing
  });

  it('promotion fires at terminal step-arrival on row 0', () => {
    const state = buildState({ config, pieces: { e8: 'm' } });
    const moves = computeLegalMoves(state, config);
    const stepToE9 = moves.find((m) => m.from === '77' || m.to === '5');
    void stepToE9;
    // Find the move via algebraic.
    const e9Move = moves.find((m) => {
      const dest = config.boardGeometry.coordinateLabels.parseNotation(m.to);
      return dest === (4 as never); // e9 = NodeId 4
    });
    expect(e9Move).toBeDefined();
    expect(e9Move?.promotion).toBe('mullah');
  });
});
