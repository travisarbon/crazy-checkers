import { describe, expect, it } from 'vitest';
import { GameEndReason, GameResultType } from '../../../types';
import { checkStackingGameOver } from '../gameOver';
import { applyStackingMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildState, configFor } from '../testHelpers';
import { hashPosition, hashToHex } from '../stackingZobrist';
import type { StackingMove } from '../types';

describe('checkStackingGameOver — Lasca', () => {
  const config = configFor('lasca');

  it('white loses when white has no commanders (NoPiecesLeft)', () => {
    const state = buildState({ config, turn: 'white', pieces: { '13': 'b' } });
    expect(checkStackingGameOver(state, config)).toEqual({
      type: GameResultType.BlackWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('black loses when black has no commanders (NoPiecesLeft)', () => {
    const state = buildState({ config, turn: 'black', pieces: { '13': 'm' } });
    expect(checkStackingGameOver(state, config)).toEqual({
      type: GameResultType.WhiteWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('white loses when white has no legal moves (NoLegalMoves)', () => {
    // White man at a1 (22) blocked by friendly at b2 (19) — no step, no jump.
    // Black has a piece elsewhere so we don't trip the NoPiecesLeft branch.
    // But 19 also moves — so this isn't a pure NoLegalMoves. Let me set up a tighter trap.
    // Simpler: white king at corner a1 with friendly at b2; black king at h8 (4).
    // White: a1 step to b2 blocked (friendly). a1 has no other diagonals. b2 (19) has steps to a3/c3/a1/c1 — all empty so b2 has 4 steps.
    // So NoLegalMoves requires every white commander to be immobilised. Use just a1 white piece.
    // White at 22 alone (no friendly to block) → step a1→b2 always available. So we need b2 blocked by black.
    // White at 22 (a1=m) + black at 19 (b2=b). White: a1 step to b2 blocked (occupied black) — but JUMP! a1 over b2 lands on c3 (16, empty) → capture available.
    // To block both step and jump: put another black at 16 (c3) so the landing is occupied. Then capture impossible.
    const state = buildState({
      config,
      turn: 'white',
      pieces: { '22': 'm', '19': 'b', '16': 'b' },
    });
    const moves = computeLegalMoves(state, config);
    expect(moves).toHaveLength(0);
    expect(checkStackingGameOver(state, config)).toEqual({
      type: GameResultType.BlackWin,
      reason: GameEndReason.NoLegalMoves,
    });
  });

  it('returns null mid-game', () => {
    const state = buildState({ config, pieces: { '19': 'm', '5': 'b' } });
    expect(checkStackingGameOver(state, config)).toBeNull();
  });

  it('detects threefold repetition (draw)', () => {
    // Construct a state with a manually-seeded repetition table where the
    // current position appears 3 times.
    const pieces = { '19': 'm', '5': 'b' };
    const state = buildState({ config, pieces, skipRepetitionSeed: true });
    const hash = hashPosition(state.pieces, state.turn, config);
    const entry: readonly [string, number] = Object.freeze([hashToHex(hash), 3]);
    const seeded = {
      ...state,
      meta: {
        ...state.meta,
        repetitionTable: Object.freeze([entry]),
      },
    };
    expect(checkStackingGameOver(seeded, config)).toEqual({
      type: GameResultType.Draw,
      reason: GameEndReason.Repetition,
    });
  });
});

describe('checkStackingGameOver — Bashni', () => {
  const config = configFor('bashni');

  it('white wins when black has no commanders', () => {
    const state = buildState({ config, turn: 'black', pieces: { '15': 'm' } });
    expect(checkStackingGameOver(state, config)).toEqual({
      type: GameResultType.WhiteWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('returns null on a typical mid-game position', () => {
    const state = buildState({ config, pieces: { '22': 'm', '14': 'b' } });
    expect(checkStackingGameOver(state, config)).toBeNull();
  });
});

describe('checkStackingGameOver — interaction with applyMove', () => {
  it('applying the only legal move leads to a continuing position', () => {
    const config = configFor('lasca');
    const state = buildState({ config, pieces: { '19': 'm', '5': 'b' } });
    const moves = computeLegalMoves(state, config);
    const next = applyStackingMove(state, moves[0] as StackingMove, config);
    expect(checkStackingGameOver(next, config)).toBeNull();
  });
});
