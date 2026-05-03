import { describe, expect, it } from 'vitest';
import { GameEndReason, GameResultType } from '../../../types';
import { checkLinearGameOver } from '../gameOver';
import { applyLinearMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildState, configFor } from '../testHelpers';
import { hashPosition, hashToHex } from '../linearZobrist';
import type { LinearMove } from '../types';

describe('checkLinearGameOver', () => {
  const config = configFor('dameo');

  it('white loses when white has no pieces (NoPiecesLeft)', () => {
    const state = buildState({ config, turn: 'white', pieces: { e4: 'b' } });
    expect(checkLinearGameOver(state, config)).toEqual({
      type: GameResultType.BlackWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('black loses when black has no pieces (NoPiecesLeft)', () => {
    const state = buildState({ config, turn: 'black', pieces: { e4: 'm' } });
    expect(checkLinearGameOver(state, config)).toEqual({
      type: GameResultType.WhiteWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('white loses when white has no legal moves (NoLegalMoves)', () => {
    // White man at h8 (top-right corner). Block its only viable step (W to g8)
    // with a black opponent, and block the capture-landing past g8 (f8) so the
    // W jump is also impossible. Other directions from h8 are off-board.
    // Black has additional pieces (g7) so we don't trip NoPiecesLeft.
    const state = buildState({
      config,
      turn: 'white',
      pieces: { h8: 'm', g8: 'b', f8: 'b', g7: 'b' },
    });
    const moves = computeLegalMoves(state, config);
    expect(moves).toHaveLength(0);
    expect(checkLinearGameOver(state, config)).toEqual({
      type: GameResultType.BlackWin,
      reason: GameEndReason.NoLegalMoves,
    });
  });

  it('returns null mid-game', () => {
    const state = buildState({ config, pieces: { e3: 'm', e6: 'b' } });
    expect(checkLinearGameOver(state, config)).toBeNull();
  });

  it('detects threefold repetition (draw)', () => {
    const pieces = { e3: 'm', e6: 'b' };
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
    expect(checkLinearGameOver(seeded, config)).toEqual({
      type: GameResultType.Draw,
      reason: GameEndReason.Repetition,
    });
  });

  it('mid-game continues after one ply', () => {
    const state = buildState({ config, pieces: { e3: 'm', e6: 'b' } });
    const moves = computeLegalMoves(state, config);
    const next = applyLinearMove(state, moves[0] as LinearMove, config);
    expect(checkLinearGameOver(next, config)).toBeNull();
  });
});
