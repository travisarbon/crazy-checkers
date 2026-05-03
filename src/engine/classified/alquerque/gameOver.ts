/**
 * Game-over detection for the alquerque-engine (Phase 4 Task 29.3).
 *
 * Three terminal cases:
 *  - **No pieces:** active side has zero pieces ⇒ opponent wins
 *    (`NoPiecesLeft`).
 *  - **No legal moves:** active side has pieces but cannot move ⇒ opponent
 *    wins (`NoLegalMoves`). Stalemate is a loss in Zamma (matches American
 *    Rules and Tier 1).
 *  - **Threefold repetition:** the post-move repetition tracker shows the
 *    current position has occurred ≥ 3 times ⇒ draw (`Repetition`).
 *
 * Per playbook §4.5 Zamma does not define a 50-move rule; the
 * `halfMoveClock` field exists for diagnostics only.
 */

import type { GameResult } from '../../types';
import { GameEndReason, GameResultType } from '../../types';
import type { AlquerqueConfig, AlquerqueGameState, AlquerqueOwner } from './types';
import { hashPosition, repetitionCount } from './alquerqueZobrist';
import { computeLegalMoves } from './moveGen';

export function checkAlquerqueGameOver(
  state: AlquerqueGameState,
  config: AlquerqueConfig,
): GameResult | null {
  const mover: AlquerqueOwner = state.turn;
  const opponent: AlquerqueOwner = mover === 'white' ? 'black' : 'white';

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

function winFor(owner: AlquerqueOwner, reason: GameEndReason): GameResult {
  return {
    type: owner === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin,
    reason,
  };
}

function draw(reason: GameEndReason): GameResult {
  return { type: GameResultType.Draw, reason };
}
