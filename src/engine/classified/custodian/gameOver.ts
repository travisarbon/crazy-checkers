/**
 * Game-over detection for the custodian-engine (Phase 4 Task 29.4).
 *
 * Dispatches by `config.winCondition.kind`:
 *   - `'no-pieces'`: side-to-move with 0 pieces ⇒ loss.
 *   - `'reduce-below'`: opponent piece count ≤ threshold ⇒ win for the side
 *     that just moved.
 *   - `'capture-king'`: side with no `kind: 'king'` piece ⇒ loss.
 *   - `'reduce-below-or-line-formation'`: combines reduce-below with the
 *     `meta.winningLines` line-formation check.
 *
 * Plus universal terminal cases:
 *   - Stalemate (`config.stalemateIsLoss === true`): side-to-move with 0
 *     legal moves ⇒ loss.
 *   - Threefold repetition (`config.enableThreefoldDraw === true`): current
 *     position has occurred ≥ 3 times ⇒ draw.
 */

import type { GameResult } from '../../types';
import { GameEndReason, GameResultType } from '../../types';
import type { CustodianConfig, CustodianGameState, CustodianOwner } from './types';
import { hashPosition, repetitionCount } from './custodianZobrist';
import { computeLegalMoves } from './moveGen';

export function checkCustodianGameOver(
  state: CustodianGameState,
  config: CustodianConfig,
): GameResult | null {
  const mover: CustodianOwner = state.turn;
  const opponent: CustodianOwner = mover === 'white' ? 'black' : 'white';

  // Win-condition dispatch — most game-over conditions are about the
  // immediate-prior-mover (the side opposite `state.turn`); the active side
  // entering this state may have already lost. Compute counts + king
  // presence once.
  let moverCount = 0;
  let opponentCount = 0;
  let moverHasKing = false;
  let opponentHasKing = false;
  for (const piece of state.pieces.values()) {
    if (piece.owner === mover) {
      moverCount += 1;
      if (piece.kind === 'king') moverHasKing = true;
    } else if (piece.owner === opponent) {
      opponentCount += 1;
      if (piece.kind === 'king') opponentHasKing = true;
    }
  }

  const justMoved: CustodianOwner = opponent;
  const justMovedCount = opponentCount;
  const justMovedOpponentCount = moverCount;
  const justMovedOpponentHasKing = moverHasKing;
  void justMovedCount;

  // Win-condition checks first (they're the primary terminal trigger). The
  // side that just moved may have triggered a win even though `state.turn`
  // has switched.
  switch (config.winCondition.kind) {
    case 'no-pieces': {
      // The side-to-move with 0 pieces loses.
      if (moverCount === 0) return winFor(opponent, GameEndReason.NoPiecesLeft);
      // Defensive: opponent could be at 0 if a self-capture engineered it.
      if (opponentCount === 0) return winFor(mover, GameEndReason.NoPiecesLeft);
      break;
    }
    case 'reduce-below': {
      const t = config.winCondition.threshold;
      if (moverCount <= t) return winFor(opponent, GameEndReason.NoPiecesLeft);
      if (opponentCount <= t) return winFor(mover, GameEndReason.NoPiecesLeft);
      break;
    }
    case 'capture-king': {
      // The side with no King has lost (their King was captured).
      if (!moverHasKing) return winFor(opponent, GameEndReason.NoPiecesLeft);
      if (!opponentHasKing) return winFor(mover, GameEndReason.NoPiecesLeft);
      break;
    }
    case 'reduce-below-or-line-formation': {
      const t = config.winCondition.captureThreshold;
      // The side that just moved wins if it formed a line.
      const winningLines = state.meta.winningLines;
      if (winningLines && winningLines.length > 0) {
        return winFor(justMoved, GameEndReason.NoLegalMoves);
      }
      // Capture-count win: opponent of the side that just moved is reduced.
      if (justMovedOpponentCount <= t) {
        return winFor(justMoved, GameEndReason.NoPiecesLeft);
      }
      if (justMovedCount <= t) {
        // Symmetric: side that just moved was reduced (e.g., via self-stalemate
        // counter-capture). Defensive — extremely rare.
        return winFor(mover, GameEndReason.NoPiecesLeft);
      }
      void justMovedOpponentHasKing;
      break;
    }
  }

  // Stalemate is universal across custodian games (`stalemateIsLoss: true`
  // is locked at the type level for all four configs).
  void config.stalemateIsLoss;
  const legal = computeLegalMoves(state, config);
  if (legal.length === 0) {
    return winFor(opponent, GameEndReason.NoLegalMoves);
  }

  // Threefold repetition is also universal (`enableThreefoldDraw: true`).
  void config.enableThreefoldDraw;
  const currentHash = hashPosition(state.pieces, mover, config);
  if (repetitionCount(state.meta.repetitionTable, currentHash) >= 3) {
    return draw(GameEndReason.Repetition);
  }

  return null;
}

function winFor(owner: CustodianOwner, reason: GameEndReason): GameResult {
  return {
    type: owner === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin,
    reason,
  };
}

function draw(reason: GameEndReason): GameResult {
  return { type: GameResultType.Draw, reason };
}
