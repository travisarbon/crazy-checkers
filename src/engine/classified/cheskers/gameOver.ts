/**
 * Game-over detection for Cheskers (Phase 4 Task 29.6).
 *
 * Three terminal cases (per playbook §4.10 + plan §1.4):
 *  - **Eliminate-all-kings (default winCondition):** if either side has zero
 *    Kings on the board, the side with kings wins. Reason `'no-pieces-left'`
 *    (closest GameEndReason for "no kings"; documented as such).
 *  - **No legal moves (stalemate-as-loss):** active side has pieces but no
 *    legal moves → opponent wins.
 *  - **Threefold repetition:** the post-move repetition tracker shows the
 *    current position has occurred ≥ 3 times → draw.
 *
 * No 50-move rule (playbook §4.10 silent). `halfMoveClock` is diagnostic only.
 */

import type { GameResult } from '../../types';
import { GameEndReason, GameResultType } from '../../types';
import type { CheskersConfig, CheskersGameState, CheskersOwner } from './types';
import { hashPosition, repetitionCount } from './cheskersZobrist';
import { computeLegalMoves } from './moveGen';

export function checkCheskersGameOver(
  state: CheskersGameState,
  config: CheskersConfig,
): GameResult | null {
  const mover: CheskersOwner = state.turn;
  const opponent: CheskersOwner = mover === 'white' ? 'black' : 'white';

  // Eliminate-all-kings — fast-path via meta.kingCount cache when present.
  const kingCount = computeKingCount(state);
  if (kingCount.white === 0 && kingCount.black === 0) {
    // Both sides simultaneously have zero kings (corner case — only possible
    // via direct construction, not normal play). Treat as draw by mutual
    // annihilation; Cheskers playbook §4.10 doesn't define this corner, so
    // pick the most-conservative interpretation.
    return draw(GameEndReason.NoPiecesLeft);
  }
  if (kingCount.white === 0) return winFor('black', GameEndReason.NoPiecesLeft);
  if (kingCount.black === 0) return winFor('white', GameEndReason.NoPiecesLeft);

  // Stalemate-as-loss.
  const legal = computeLegalMoves(state, config);
  if (legal.length === 0) {
    return winFor(opponent, GameEndReason.NoLegalMoves);
  }

  // Threefold repetition.
  const currentHash = hashPosition(state.pieces, mover, config);
  if (repetitionCount(state.meta.repetitionTable, currentHash) >= 3) {
    return draw(GameEndReason.Repetition);
  }

  return null;
}

function computeKingCount(
  state: CheskersGameState,
): { readonly white: number; readonly black: number } {
  if (state.meta.kingCount) return state.meta.kingCount;
  let white = 0;
  let black = 0;
  for (const piece of state.pieces.values()) {
    if (piece.kind !== 'king') continue;
    if (piece.owner === 'white') white += 1;
    else if (piece.owner === 'black') black += 1;
  }
  return { white, black };
}

function winFor(owner: CheskersOwner, reason: GameEndReason): GameResult {
  return {
    type: owner === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin,
    reason,
  };
}

function draw(reason: GameEndReason): GameResult {
  return { type: GameResultType.Draw, reason };
}
