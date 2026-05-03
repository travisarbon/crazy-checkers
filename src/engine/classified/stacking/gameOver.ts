/**
 * Game-over detection for stacking-draughts (Phase 4 Task 29.1).
 *
 * Returns a `GameResult` for the active position or `null` if play continues.
 * Three terminal cases:
 *  - **No commanders:** active side has zero towers ⇒ opponent wins
 *    (`NoPiecesLeft`).
 *  - **No legal moves:** active side has towers but cannot move (every
 *    capture chain blocked, every step blocked) ⇒ opponent wins
 *    (`NoLegalMoves`). Stalemate is a loss in stacking draughts (matches
 *    American Rules and Tier 1 conventions).
 *  - **Threefold repetition:** the post-move repetition tracker shows the
 *    current position has occurred ≥ 3 times ⇒ draw (`Repetition`).
 *
 * Per the Tier 2 playbook the 50-move rule is NOT implemented for Lasca or
 * Bashni — the canonical rule sets do not impose one. The `halfMoveClock`
 * field exists for diagnostics only.
 */

import type { GameResult } from '../../types';
import { GameEndReason, GameResultType } from '../../types';
import type { StackingDraughtsConfig, StackingGameState, StackingOwner } from './types';
import { hashPosition, repetitionCount } from './stackingZobrist';
import { computeLegalMoves } from './moveGen';

export function checkStackingGameOver(
  state: StackingGameState,
  config: StackingDraughtsConfig,
): GameResult | null {
  const mover: StackingOwner = state.turn;
  const opponent: StackingOwner = mover === 'white' ? 'black' : 'white';

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

function winFor(owner: StackingOwner, reason: GameEndReason): GameResult {
  return {
    type: owner === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin,
    reason,
  };
}

function draw(reason: GameEndReason): GameResult {
  return { type: GameResultType.Draw, reason };
}
