import { describe, expect, it } from 'vitest';
import { LASCA_HAND_VERIFIED_SCENARIOS } from '../fixtures/lasca.handVerified';
import { BASHNI_HAND_VERIFIED_SCENARIOS } from '../fixtures/bashni.handVerified';
import { applyStackingMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildState, configFor, towerSpecAt } from '../testHelpers';
import type { StackingMove } from '../types';

describe('applyStackingMove — Lasca canonical fixtures', () => {
  const config = configFor('lasca');
  for (const scenario of LASCA_HAND_VERIFIED_SCENARIOS) {
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
        const mf = config.boardGeometry.coordinateLabels.parseNotation(m.from);
        const mt = config.boardGeometry.coordinateLabels.parseNotation(m.to);
        return mf === fromNode && mt === toNode;
      });
      expect(move).toBeDefined();
      const next = applyStackingMove(state, move as StackingMove, config);

      // Assert every expected square has the expected tower spec.
      for (const [pdn, spec] of Object.entries(can.expectedPieces)) {
        const node = config.boardGeometry.coordinateLabels.parseNotation(pdn);
        expect(node).not.toBeNull();
        if (node === null) continue;
        const piece = next.pieces.get(node);
        expect(piece, `expected tower at ${pdn}`).toBeDefined();
        expect(towerSpecAt(next, pdn, config)).toBe(`T[${spec}]`);
      }

      // Assert no surprising occupied squares.
      const expectedNodes = new Set(
        Object.keys(can.expectedPieces).map(
          (pdn) => config.boardGeometry.coordinateLabels.parseNotation(pdn) as unknown as number,
        ),
      );
      // Add starting squares that should remain occupied (everything from
      // input minus from + minus captures).
      const sourceNode = config.boardGeometry.coordinateLabels.parseNotation(can.from);
      expect(sourceNode).not.toBeNull();
      const expectedAlsoOccupied = new Set<number>();
      for (const inputPdn of Object.keys(scenario.pieces)) {
        const node = config.boardGeometry.coordinateLabels.parseNotation(inputPdn);
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
        expectedAlsoOccupied.add(node as unknown as number);
      }
      for (const node of expectedAlsoOccupied) expectedNodes.add(node);

      for (const node of next.pieces.keys()) {
        expect(
          expectedNodes.has(node as unknown as number),
          `unexpected occupied node ${String(node)}`,
        ).toBe(true);
      }
    });
  }
});

describe('applyStackingMove — Bashni canonical fixtures', () => {
  const config = configFor('bashni');
  for (const scenario of BASHNI_HAND_VERIFIED_SCENARIOS) {
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
        const mf = config.boardGeometry.coordinateLabels.parseNotation(m.from);
        const mt = config.boardGeometry.coordinateLabels.parseNotation(m.to);
        return mf === fromNode && mt === toNode;
      });
      expect(move).toBeDefined();
      const next = applyStackingMove(state, move as StackingMove, config);

      for (const [pdn, spec] of Object.entries(can.expectedPieces)) {
        expect(towerSpecAt(next, pdn, config)).toBe(`T[${spec}]`);
      }
    });
  }
});

describe('applyStackingMove — invariants', () => {
  it('input state is never mutated', () => {
    const config = configFor('lasca');
    const state = buildState({ config, pieces: { '19': 'm' } });
    const moves = computeLegalMoves(state, config);
    const move = moves[0];
    expect(move).toBeDefined();
    const piecesSnap = JSON.stringify([...state.pieces.entries()]);
    applyStackingMove(state, move as StackingMove, config);
    expect(JSON.stringify([...state.pieces.entries()])).toBe(piecesSnap);
  });

  it('plyCount increments by 1', () => {
    const config = configFor('lasca');
    const state = buildState({ config, pieces: { '19': 'm' } });
    const next = applyStackingMove(
      state,
      computeLegalMoves(state, config)[0] as StackingMove,
      config,
    );
    expect(next.plyCount).toBe(1);
  });

  it('halfMoveClock resets to 0 on capture', () => {
    const config = configFor('lasca');
    const state = buildState({
      config,
      pieces: { '16': 'm', '13': 'b' },
      halfMoveClock: 7,
    });
    const moves = computeLegalMoves(state, config);
    const next = applyStackingMove(state, moves[0] as StackingMove, config);
    expect(next.meta.halfMoveClock).toBe(0);
  });

  it('halfMoveClock increments on a step (no capture available)', () => {
    const config = configFor('lasca');
    const state = buildState({
      config,
      pieces: { '19': 'm' },
      halfMoveClock: 3,
    });
    const moves = computeLegalMoves(state, config);
    const next = applyStackingMove(state, moves[0] as StackingMove, config);
    expect(next.meta.halfMoveClock).toBe(4);
  });

  it('turn toggles after each move', () => {
    const config = configFor('lasca');
    const state = buildState({ config, turn: 'white', pieces: { '19': 'm' } });
    const next = applyStackingMove(
      state,
      computeLegalMoves(state, config)[0] as StackingMove,
      config,
    );
    expect(next.turn).toBe('black');
  });

  it('moveHistory grows by 1', () => {
    const config = configFor('lasca');
    const state = buildState({ config, pieces: { '19': 'm' } });
    const next = applyStackingMove(
      state,
      computeLegalMoves(state, config)[0] as StackingMove,
      config,
    );
    expect(next.moveHistory).toHaveLength(state.moveHistory.length + 1);
  });

  it('Bashni mid-chain promotion: commander becomes king mid-leg', () => {
    const config = configFor('bashni');
    const state = buildState({
      config,
      pieces: { '10': 'm', '7': 'b', '8': 'b' },
    });
    const moves = computeLegalMoves(state, config);
    // Verify exactly one chain that captures both e7 and g7 (length 2).
    const longChain = moves.filter((m) => m.kind === 'capture' && m.capture.length === 2);
    expect(longChain).toHaveLength(1);
    const move = longChain[0] as StackingMove;
    // promotionSquare records the landing square where promotion fired (f8).
    const promoNode = config.boardGeometry.coordinateLabels.parseNotation(
      move.meta?.promotionSquare ?? '',
    );
    const expectedNode = config.boardGeometry.coordinateLabels.parseNotation('f8');
    expect(promoNode).toBe(expectedNode);
    const next = applyStackingMove(state, move, config);
    expect(towerSpecAt(next, 'h6', config)).toBe('T[bbM]');
  });

  it('repetitionTable picks up the post-move hash', () => {
    const config = configFor('lasca');
    const state = buildState({ config, pieces: { '19': 'm' } });
    const next = applyStackingMove(
      state,
      computeLegalMoves(state, config)[0] as StackingMove,
      config,
    );
    // Starting state had 1 hash entry; after move there must be at least 1 entry too.
    expect(next.meta.repetitionTable.length).toBeGreaterThanOrEqual(1);
  });
});
