import { describe, expect, it } from 'vitest';
import { GameEndReason, GameResultType } from '../../../types';
import { checkHarzdameGameOver } from '../gameOver';
import { hashPosition, hashToHex } from '../harzdameZobrist';
import { buildState } from '../testHelpers';
import { createHarzdameConfig, type HarzdameMeta } from '../types';

const CFG = createHarzdameConfig();

describe('checkHarzdameGameOver — no-pieces wins', () => {
  it('white wins when black has no pieces (white to move)', () => {
    const state = buildState({ pieces: { '17': 'm' } });
    const result = checkHarzdameGameOver(state, CFG);
    expect(result).not.toBeNull();
    expect(result?.type).toBe(GameResultType.WhiteWin);
    expect(result?.reason).toBe(GameEndReason.NoPiecesLeft);
  });

  it('black wins when white has no pieces (black to move)', () => {
    const state = buildState({ pieces: { '5': 'b' }, turn: 'black' });
    const result = checkHarzdameGameOver(state, CFG);
    expect(result).not.toBeNull();
    expect(result?.type).toBe(GameResultType.BlackWin);
    expect(result?.reason).toBe(GameEndReason.NoPiecesLeft);
  });

  it('white-to-move with no white pieces ⇒ black wins', () => {
    const state = buildState({ pieces: { '5': 'b' }, turn: 'white' });
    const result = checkHarzdameGameOver(state, CFG);
    expect(result).not.toBeNull();
    expect(result?.type).toBe(GameResultType.BlackWin);
    expect(result?.reason).toBe(GameEndReason.NoPiecesLeft);
  });

  it('black-to-move with no black pieces ⇒ white wins', () => {
    const state = buildState({ pieces: { '17': 'm' }, turn: 'black' });
    const result = checkHarzdameGameOver(state, CFG);
    expect(result).not.toBeNull();
    expect(result?.type).toBe(GameResultType.WhiteWin);
    expect(result?.reason).toBe(GameEndReason.NoPiecesLeft);
  });
});

describe('checkHarzdameGameOver — stalemate-as-loss', () => {
  it('white at PDN 4 (corner, no moves) loses on its turn (opponent black wins)', () => {
    // PDN 4 = (0, 7) — top-right corner. White moves NE/SE; both off-board.
    // Black has a piece elsewhere so it isn't a no-pieces case.
    const state = buildState({
      pieces: { '4': 'm', '32': 'b' },
      turn: 'white',
    });
    const result = checkHarzdameGameOver(state, CFG);
    expect(result).not.toBeNull();
    expect(result?.type).toBe(GameResultType.BlackWin);
    expect(result?.reason).toBe(GameEndReason.NoLegalMoves);
  });

  it('black with no legal moves loses (white wins)', () => {
    // PDN 5 = (1, 0) — black movement diagonals SW/NW both run off the left
    // edge, so a lone black-man at PDN 5 has zero legal moves on black's turn.
    const state = buildState({
      pieces: { '5': 'b', '17': 'm' },
      turn: 'black',
    });
    const result = checkHarzdameGameOver(state, CFG);
    expect(result).not.toBeNull();
    expect(result?.type).toBe(GameResultType.WhiteWin);
    expect(result?.reason).toBe(GameEndReason.NoLegalMoves);
  });
});

describe('checkHarzdameGameOver — repetition', () => {
  it('returns Draw / Repetition when current position has count ≥ 3 in the table', () => {
    const state = buildState({ pieces: { '17': 'M', '32': 'b' } });
    const currentHash = hashPosition(state.pieces, state.turn, CFG);
    const seededTable: readonly (readonly [string, number])[] = Object.freeze([
      Object.freeze<readonly [string, number]>([hashToHex(currentHash), 3]),
    ]);
    const meta: HarzdameMeta = {
      ...state.meta,
      repetitionTable: seededTable,
    };
    const repeated = { ...state, meta };
    const result = checkHarzdameGameOver(repeated, CFG);
    expect(result).not.toBeNull();
    expect(result?.type).toBe(GameResultType.Draw);
    expect(result?.reason).toBe(GameEndReason.Repetition);
  });

  it('does NOT trigger when count is 2 (one shy of threefold)', () => {
    const state = buildState({ pieces: { '17': 'M', '32': 'b' } });
    const currentHash = hashPosition(state.pieces, state.turn, CFG);
    const seededTable: readonly (readonly [string, number])[] = Object.freeze([
      Object.freeze<readonly [string, number]>([hashToHex(currentHash), 2]),
    ]);
    const meta: HarzdameMeta = {
      ...state.meta,
      repetitionTable: seededTable,
    };
    const repeated = { ...state, meta };
    const result = checkHarzdameGameOver(repeated, CFG);
    expect(result).toBeNull();
  });
});

describe('checkHarzdameGameOver — mid-game returns null', () => {
  it('returns null when both sides have pieces and the active side has legal moves', () => {
    const state = buildState({ pieces: { '17': 'm', '5': 'b' } });
    expect(checkHarzdameGameOver(state, CFG)).toBeNull();
  });

  it('returns null in the starting position', () => {
    const state = buildState({
      pieces: { '17': 'm', '18': 'm', '5': 'b', '6': 'b' },
    });
    expect(checkHarzdameGameOver(state, CFG)).toBeNull();
  });
});
