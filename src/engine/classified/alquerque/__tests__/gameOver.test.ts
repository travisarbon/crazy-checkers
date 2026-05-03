import { describe, expect, it } from 'vitest';
import { GameEndReason, GameResultType } from '../../../types';
import { checkAlquerqueGameOver } from '../gameOver';
import { applyAlquerqueMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildState, configFor } from '../testHelpers';
import { hashPosition, hashToHex } from '../alquerqueZobrist';
import type { AlquerqueMove } from '../types';

describe('checkAlquerqueGameOver', () => {
  const config = configFor('zamma');

  it('white loses when white has no pieces (NoPiecesLeft)', () => {
    const state = buildState({ config, turn: 'white', pieces: { e6: 'b' } });
    expect(checkAlquerqueGameOver(state, config)).toEqual({
      type: GameResultType.BlackWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('black loses when black has no pieces', () => {
    const state = buildState({ config, turn: 'black', pieces: { e5: 'm' } });
    expect(checkAlquerqueGameOver(state, config)).toEqual({
      type: GameResultType.WhiteWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('white loses when white has no legal moves (NoLegalMoves)', () => {
    // White man at i9 (top-right). i9 = (r=0, c=8). r+c=8 even → has diagonals.
    // Forward N off-board. NE off. NW = (r=-1, c=7) off. So 0 step moves regardless.
    // Captures: orthogonal man-capture forward (N off, NE off, NW off). 0 captures.
    // No other white pieces → 0 white moves.
    // Black: any single piece somewhere not threatening i9.
    const state = buildState({ config, turn: 'white', pieces: { i9: 'm', a1: 'B' } });
    const moves = computeLegalMoves(state, config);
    expect(moves).toHaveLength(0);
    expect(checkAlquerqueGameOver(state, config)).toEqual({
      type: GameResultType.BlackWin,
      reason: GameEndReason.NoLegalMoves,
    });
  });

  it('returns null mid-game', () => {
    const state = buildState({ config, pieces: { e5: 'm', e6: 'b' } });
    expect(checkAlquerqueGameOver(state, config)).toBeNull();
  });

  it('detects threefold repetition (draw)', () => {
    const pieces = { e5: 'm', a1: 'B' };
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
    expect(checkAlquerqueGameOver(seeded, config)).toEqual({
      type: GameResultType.Draw,
      reason: GameEndReason.Repetition,
    });
  });

  it('continues mid-game after one ply', () => {
    // Multi-piece state so applying one move does not exhaust either side.
    const state = buildState({
      config,
      pieces: { e5: 'm', d5: 'm', e7: 'b', a1: 'B' },
    });
    const moves = computeLegalMoves(state, config);
    const next = applyAlquerqueMove(state, moves[0] as AlquerqueMove, config);
    expect(checkAlquerqueGameOver(next, config)).toBeNull();
  });
});
