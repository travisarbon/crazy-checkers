import { describe, expect, it } from 'vitest';
import { GameEndReason, GameResultType } from '../../../types';
import { checkCheskersGameOver } from '../gameOver';
import { hashPosition, hashToHex } from '../cheskersZobrist';
import { buildState } from '../testHelpers';
import { createCheskersConfig, type CheskersMeta } from '../types';

const CFG = createCheskersConfig();

describe('checkCheskersGameOver — eliminate-all-kings', () => {
  it('white wins when black has zero Kings (white to move)', () => {
    const state = buildState({
      pieces: { d4: 'P', e5: 'K', a8: 'p' },
      turn: 'white',
    });
    // Black has only a Pawn (no Kings) → white wins.
    const result = checkCheskersGameOver(state, CFG);
    expect(result?.type).toBe(GameResultType.WhiteWin);
    expect(result?.reason).toBe(GameEndReason.NoPiecesLeft);
  });

  it('black wins when white has zero Kings (black to move)', () => {
    const state = buildState({
      pieces: { d4: 'P', a1: 'k', h8: 'B' },
      turn: 'black',
    });
    // White has Pawn + Bishop (no Kings) → black wins.
    const result = checkCheskersGameOver(state, CFG);
    expect(result?.type).toBe(GameResultType.BlackWin);
    expect(result?.reason).toBe(GameEndReason.NoPiecesLeft);
  });

  it('returns Draw when both sides have zero Kings (corner case)', () => {
    const state = buildState({
      pieces: { d4: 'P', a8: 'p' },
      turn: 'white',
    });
    const result = checkCheskersGameOver(state, CFG);
    expect(result?.type).toBe(GameResultType.Draw);
  });
});

describe('checkCheskersGameOver — stalemate-as-loss', () => {
  it('side with no legal moves loses (opponent wins)', () => {
    // Construct a position where white King has no legal moves but pieces remain.
    // White King at a1 (corner), surrounded by friendly Pawns at b2 (NE blocking).
    // a1 = (7, 0). NE = (6, 1) = b2. NW/SW/SE off-board (corner).
    // So King at a1 has no moves if b2 is friendly. Plus white needs no other piece moves.
    // A lone King at a1 with friendly Pawn at b2: King a1 NE → b2 (occupied). 0 King moves.
    // But the Pawn at b2 has its own moves: NE = c3 (empty). So total moves = 1.
    // To get stalemate, occupy b2 with friendly + ALSO block the Pawn's moves.
    // Trickier — let's use a simpler stalemate: white King at a1 + black King somewhere far + completely blocking surroundings.
    // Actually for the test we just need the engine's no-legal-moves branch to fire.
    // Use: white King at a1 + nothing else playable. White also has a Pawn at b2 which CAN move.
    // We need ZERO legal moves. Construct: white King at a1, white Pawn at b2 + g7 (forced to step), black King at h8.
    // The white Pawn b2 could move NE to c3 (legal). So this doesn't stalemate.
    //
    // Easiest verifiable stalemate: white at the bottom-right corner with all surrounding squares blocked.
    // White King at a1 + white Pawns at b2 (no legal NE step because b2's NE = c3 is empty so it's legal).
    //
    // Skip the construction — use a known-stalemate via manipulation. Place a single white King with
    // black King + black Pawns blocking all 4 escape diagonals.
    //
    // Actually the simplest stalemate: white has only a King at a1 and a Pawn at b2; black has only kings at d8 + f8.
    // White King a1 NE → b2 (blocked). White Pawn b2 NE → c3 (free). 1 move. Not stalemate.
    //
    // Try: white has no movable pieces. Place white King at a1, white Pawn at b2.
    // White Pawn at the back rank has no forward moves (already promoted).
    // Place white Pawn at a1? a1 = (7, 0). Forward = NE/NW = (6, 1) = b2 / (6, -1) off.
    // If b2 is occupied by friendly, Pawn at a1 has 0 moves.
    // King at a1 — can't be both King and Pawn at same square.
    // Try: white King at h1 + white Pawn at g3 surrounded.
    // h1 = (7, 7). NW = (6, 6) = g2 (light, not playable in dark-only).
    // Wait — g2 = (6, 6). (6+6)=12 even → LIGHT. So h1 NW destination is light → reject.
    // King at h1 has 0 NW moves. Other directions: NE off (col 8), SE off (row 8), SW = (6, 6) light off-mask.
    // So King at h1 has 0 step moves — ALWAYS, due to dark-only mask geometry.
    // Place a Pawn somewhere with no moves. White Pawn at h8? h8 = (0, 7). Forward = (-1, ...) off-board. 0 moves.
    // Stalemate setup: white King at h1, white Pawn at h8 + black has at least one King so total kings > 0 for both.
    // But black King somewhere to satisfy "kings present" for both sides.
    const state = buildState({
      pieces: { h1: 'K', h8: 'P', d8: 'k' },
      turn: 'white',
    });
    const result = checkCheskersGameOver(state, CFG);
    expect(result).not.toBeNull();
    expect(result?.type).toBe(GameResultType.BlackWin);
    expect(result?.reason).toBe(GameEndReason.NoLegalMoves);
  });
});

describe('checkCheskersGameOver — repetition', () => {
  it('returns Draw / Repetition when current position has count ≥ 3 in the table', () => {
    const state = buildState({
      pieces: { d4: 'K', e5: 'k' },
      turn: 'white',
    });
    const currentHash = hashPosition(state.pieces, state.turn, CFG);
    const seededTable: readonly (readonly [string, number])[] = Object.freeze([
      Object.freeze<readonly [string, number]>([hashToHex(currentHash), 3]),
    ]);
    const meta: CheskersMeta = {
      ...state.meta,
      repetitionTable: seededTable,
    };
    const repeated = { ...state, meta };
    const result = checkCheskersGameOver(repeated, CFG);
    expect(result?.type).toBe(GameResultType.Draw);
    expect(result?.reason).toBe(GameEndReason.Repetition);
  });

  it('does NOT trigger when count is 2 (one shy of threefold)', () => {
    const state = buildState({
      pieces: { d4: 'K', e5: 'k' },
      turn: 'white',
    });
    const currentHash = hashPosition(state.pieces, state.turn, CFG);
    const seededTable: readonly (readonly [string, number])[] = Object.freeze([
      Object.freeze<readonly [string, number]>([hashToHex(currentHash), 2]),
    ]);
    const meta: CheskersMeta = {
      ...state.meta,
      repetitionTable: seededTable,
    };
    const repeated = { ...state, meta };
    const result = checkCheskersGameOver(repeated, CFG);
    expect(result).toBeNull();
  });
});

describe('checkCheskersGameOver — mid-game returns null', () => {
  it('returns null when both sides have kings and active side has legal moves', () => {
    const state = buildState({
      pieces: { d4: 'K', e5: 'k' },
      turn: 'white',
    });
    expect(checkCheskersGameOver(state, CFG)).toBeNull();
  });
});

describe('checkCheskersGameOver — kingCount cache fallback', () => {
  it('recomputes kingCount when meta cache is absent', () => {
    const state = buildState({
      pieces: { d4: 'K', a8: 'k' },
      turn: 'white',
    });
    // Strip the kingCount from meta to exercise the fallback branch.
    const stripped = {
      ...state,
      meta: { ...state.meta, kingCount: undefined },
    };
    expect(checkCheskersGameOver(stripped, CFG)).toBeNull();
  });
});
