import { describe, expect, it } from 'vitest';
import { GameEndReason, GameResultType } from '../../../types';
import { checkCustodianGameOver } from '../gameOver';
import { buildState } from '../testHelpers';
import { hashPosition, hashToHex } from '../custodianZobrist';
import { createMakYekConfig } from '../makYekConfig';
import { createHasamiShogiConfig } from '../hasamiShogiConfig';
import { createRekConfig } from '../rekConfig';
import { createDaiHasamiShogiConfig } from '../daiHasamiShogiConfig';

const MAK = createMakYekConfig();
const HSG = createHasamiShogiConfig();
const REK = createRekConfig();
const DH = createDaiHasamiShogiConfig();

describe('checkCustodianGameOver — Mak-yek "no-pieces"', () => {
  it('white loses when white has no pieces', () => {
    const state = buildState({ config: MAK, turn: 'white', pieces: { e4: 'b' } });
    expect(checkCustodianGameOver(state, MAK)).toEqual({
      type: GameResultType.BlackWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('returns null mid-game', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'm', d5: 'b' } });
    expect(checkCustodianGameOver(state, MAK)).toBeNull();
  });
});

describe('checkCustodianGameOver — Hasami Shogi "reduce-below" (threshold 1)', () => {
  it('opponent reduced to 1 piece triggers win for the side that has more', () => {
    // Black at 1 piece, white at 2 pieces. Threshold 1. opponentCount(black) = 1 ≤ 1 → white wins.
    const state = buildState({
      config: HSG,
      turn: 'white',
      pieces: { e5: 'm', e6: 'm', a1: 'b' },
    });
    expect(checkCustodianGameOver(state, HSG)).toEqual({
      type: GameResultType.WhiteWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('returns null when both sides have > 1 piece', () => {
    const state = buildState({
      config: HSG,
      pieces: { a1: 'm', a2: 'm', i1: 'b', i2: 'b' },
    });
    expect(checkCustodianGameOver(state, HSG)).toBeNull();
  });
});

describe('checkCustodianGameOver — Rek "capture-king"', () => {
  it('white loses when white has no King', () => {
    const state = buildState({ config: REK, turn: 'white', pieces: { e4: 'm', a1: 'k' } });
    expect(checkCustodianGameOver(state, REK)).toEqual({
      type: GameResultType.BlackWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('returns null when both sides have a King', () => {
    const state = buildState({ config: REK, pieces: { a1: 'K', h8: 'k' } });
    // Both kings have rook moves; computeLegalMoves > 0; gameOver returns null.
    expect(checkCustodianGameOver(state, REK)).toBeNull();
  });
});

describe('checkCustodianGameOver — Dai Hasami "reduce-below-or-line-formation"', () => {
  it('opponent of just-moved-side reduced to ≤ 4 triggers win for just-moved side', () => {
    // state.turn = 'black' (so just-moved side = white). Black has 4 pieces ≤ 4.
    // Engine: justMovedOpponentCount = blackCount = 4 ≤ 4 → win for justMoved (white).
    const state = buildState({
      config: DH,
      turn: 'black',
      pieces: { e5: 'm', e6: 'm', a1: 'b', a2: 'b', a3: 'b', a4: 'b' },
    });
    expect(checkCustodianGameOver(state, DH)).toEqual({
      type: GameResultType.WhiteWin,
      reason: GameEndReason.NoPiecesLeft,
    });
  });

  it('line-formation win triggers for the side that just moved', () => {
    const state = buildState({
      config: DH,
      turn: 'black',
      pieces: { a5: 'm', b5: 'm', c5: 'm', d5: 'm', e5: 'm', a1: 'b', a2: 'b', a3: 'b', a4: 'b', a6: 'b' },
    });
    // Manually populate winningLines as if applyMove had set it.
    const seeded = {
      ...state,
      meta: {
        ...state.meta,
        winningLines: Object.freeze([
          Object.freeze([4 * 9 + 0, 4 * 9 + 1, 4 * 9 + 2, 4 * 9 + 3, 4 * 9 + 4]),
        ]),
      },
    };
    // The side that just moved is the opponent of state.turn = white.
    const result = checkCustodianGameOver(seeded, DH);
    expect(result?.type).toBe(GameResultType.WhiteWin);
  });
});

describe('checkCustodianGameOver — universal terminal cases', () => {
  it('stalemate-as-loss: side with pieces but no legal moves loses (Mak-yek)', () => {
    // Mak-yek win condition is 'no-pieces' (not reduce-below), so the stalemate
    // branch fires before any premature reduce-below trigger.
    // White at h8 (corner). Black blocks the only two non-edge directions
    // (g8 west, h7 south). N + E are off-board. White: 0 slides.
    // Black has 2 pieces, white has 1 — neither side at zero pieces.
    const state = buildState({
      config: MAK,
      turn: 'white',
      pieces: { h8: 'm', h7: 'b', g8: 'b' },
    });
    expect(checkCustodianGameOver(state, MAK)).toEqual({
      type: GameResultType.BlackWin,
      reason: GameEndReason.NoLegalMoves,
    });
  });

  it('threefold repetition draws', () => {
    const state = buildState({
      config: MAK,
      turn: 'white',
      pieces: { e4: 'm', a1: 'b' },
      skipRepetitionSeed: true,
    });
    const hash = hashPosition(state.pieces, state.turn, MAK);
    const entry: readonly [string, number] = Object.freeze([hashToHex(hash), 3]);
    const seeded = {
      ...state,
      meta: {
        ...state.meta,
        repetitionTable: Object.freeze([entry]),
      },
    };
    expect(checkCustodianGameOver(seeded, MAK)).toEqual({
      type: GameResultType.Draw,
      reason: GameEndReason.Repetition,
    });
  });
});
