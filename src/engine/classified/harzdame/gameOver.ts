/**
 * Game-over detection for Harzdame (Phase 4 Task 29.5).
 *
 * Three terminal cases:
 *  - **No pieces:** active side has zero pieces ⇒ opponent wins.
 *  - **No legal moves:** active side has pieces but cannot move ⇒ opponent
 *    wins (`stalemateIsLoss: true`).
 *  - **Threefold repetition:** the post-move repetition tracker shows the
 *    current position has occurred ≥ 3 times ⇒ draw.
 *
 * No 50-move rule (playbook §4.2 silent). `halfMoveClock` is diagnostic only.
 */

import type { GameResult } from '../../types';
import { GameEndReason, GameResultType } from '../../types';
import type { HarzdameConfig, HarzdameGameState, HarzdameOwner } from './types';
import { hashPosition, repetitionCount } from './harzdameZobrist';
import { computeLegalMoves } from './moveGen';

export function checkHarzdameGameOver(
  state: HarzdameGameState,
  config: HarzdameConfig,
): GameResult | null {
  const mover: HarzdameOwner = state.turn;
  const opponent: HarzdameOwner = mover === 'white' ? 'black' : 'white';

  let moverHas = false;
  let opponentHas = false;
  for (const piece of state.pieces.values()) {
    if (piece.owner === mover) moverHas = true;
    else if (piece.owner === opponent) opponentHas = true;
    if (moverHas && opponentHas) break;
  }
  if (!moverHas) return winFor(opponent, GameEndReason.NoPiecesLeft);
  if (!opponentHas) return winFor(mover, GameEndReason.NoPiecesLeft);

  const legal = computeLegalMoves(state, config);
  if (legal.length === 0) {
    return winFor(opponent, GameEndReason.NoLegalMoves);
  }

  const currentHash = hashPosition(state.pieces, mover, config);
  if (repetitionCount(state.meta.repetitionTable, currentHash) >= 3) {
    return draw(GameEndReason.Repetition);
  }

  return null;
}

function winFor(owner: HarzdameOwner, reason: GameEndReason): GameResult {
  return {
    type: owner === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin,
    reason,
  };
}

function draw(reason: GameEndReason): GameResult {
  return { type: GameResultType.Draw, reason };
}
