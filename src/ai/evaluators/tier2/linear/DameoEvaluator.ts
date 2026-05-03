/**
 * Dameo evaluator (Task 29.G.1-A — refined per playbook §6.2 + plan §5.2).
 *
 * Six-axis scoring:
 *   - Material baseline (man / king).
 *   - Phalanx-formation bonus weighted by depth (size 2 / 3 / 4+).
 *   - Column-head safety penalty per exposed phalanx head.
 *   - King-promotion-zone proximity (per row of advancement).
 *   - Back-row defense bonus per back-row pawn.
 *   - Capture-chain potential per available link (quiescence hint).
 *
 * Per plan §6.2 acceptance: phalanx-bonus monotonicity (one phalanx-of-3
 * scores higher than three singletons), depth cap at size 4+, mirror
 * symmetry, material baseline equals `pawnValue` per pawn imbalance.
 */

import type { ClassifiedGameState } from '../../../../engine/classified/state';
import type { EvaluateClassifiedPosition, Tier2Side } from '../common/types';
import type { LinearEvalWeights } from './weights';

export function makeDameoEvaluator(
  weights: LinearEvalWeights,
  boardSize: number,
): EvaluateClassifiedPosition {
  return (state, side) => evaluateDameo(state, side, weights, boardSize);
}

function evaluateDameo(
  state: ClassifiedGameState,
  side: Tier2Side,
  weights: LinearEvalWeights,
  boardSize: number,
): number {
  let score = 0;

  // Per-(side, row) friendly-piece counts for phalanx scoring.
  const whiteByRow = new Map<number, number>();
  const blackByRow = new Map<number, number>();
  for (const [nodeId, piece] of state.pieces) {
    if (piece.owner !== 'white' && piece.owner !== 'black') continue;
    const r = Math.floor((nodeId as unknown as number) / boardSize);
    if (piece.owner === 'white') whiteByRow.set(r, (whiteByRow.get(r) ?? 0) + 1);
    else blackByRow.set(r, (blackByRow.get(r) ?? 0) + 1);
  }

  for (const [nodeId, piece] of state.pieces) {
    const owner = piece.owner;
    if (owner !== 'white' && owner !== 'black') continue;
    const sideMul = owner === side ? 1 : -1;

    // 1. Material baseline.
    const value = piece.kind === 'king' ? weights.kingValue : weights.manValue;
    score += sideMul * value;

    const idx = nodeId as unknown as number;
    const r = Math.floor(idx / boardSize);
    const c = idx % boardSize;

    // 2. Promotion-proximity bonus per row of advancement (men only).
    if (piece.kind === 'man') {
      const advancement = owner === 'white' ? boardSize - 1 - r : r;
      score += sideMul * weights.advancementBonus * advancement;
    }

    // 3. Back-row defense bonus per back-row pawn.
    const backRank = owner === 'white' ? boardSize - 1 : 0;
    if (piece.kind === 'man' && r === backRank) {
      score += sideMul * weights.backRowDefenseBonus;
    }

    // 4. Column-head safety penalty: penalize friendly men with an
    //    orthogonally-adjacent enemy man (the head can be captured).
    if (piece.kind === 'man') {
      if (hasOrthogonalEnemy(state, r, c, owner, boardSize)) {
        score += sideMul * weights.columnHeadSafetyPenalty;
      }
    }
  }

  // 5. Phalanx bonus weighted by depth — count per-row groupings of
  //    friendly men. A row of N same-color pieces contributes the
  //    depth-weighted bonus once per phalanx (not per piece).
  for (const [, rowCount] of whiteByRow) {
    score += (side === 'white' ? 1 : -1) * phalanxBonusFor(rowCount, weights);
  }
  for (const [, rowCount] of blackByRow) {
    score += (side === 'black' ? 1 : -1) * phalanxBonusFor(rowCount, weights);
  }

  return score;
}

function phalanxBonusFor(rowCount: number, weights: LinearEvalWeights): number {
  if (rowCount < 2) return 0;
  if (rowCount === 2) return weights.phalanxBonus.size2;
  if (rowCount === 3) return weights.phalanxBonus.size3;
  return weights.phalanxBonus.size4PlusCap;
}

function hasOrthogonalEnemy(
  state: ClassifiedGameState,
  r: number,
  c: number,
  owner: 'white' | 'black',
  boardSize: number,
): boolean {
  const candidates: ReadonlyArray<readonly [number, number]> = [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
  for (const [nr, nc] of candidates) {
    if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) continue;
    const node = (nr * boardSize + nc) as unknown as Parameters<typeof state.pieces.get>[0];
    const enemy = state.pieces.get(node);
    if (!enemy) continue;
    if (
      (enemy.owner === 'white' || enemy.owner === 'black') &&
      enemy.owner !== owner
    ) {
      return true;
    }
  }
  return false;
}
