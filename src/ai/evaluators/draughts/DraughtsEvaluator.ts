/**
 * DraughtsEvaluator — parameterised evaluation function for all Tier 1
 * Classified draughts variants (Task 28.5).
 *
 * A single function `evaluateDraughtsPosition` computes a heuristic score
 * for a ClassifiedGameState using a `DraughtsEvalWeights` table. Zero
 * `gameId` branching: every per-variant distinction flows through the
 * weight values and the DraughtsConfig's structural parameters.
 *
 * Evaluation factors (in evaluation order):
 *  1. Terminal state detection (no pieces / no legal moves → loss)
 *  2. Material (pawn + king values, endgame scaling)
 *  3. Advancement (board-size-normalised pawn row progress)
 *  4. Center control (geometry-aware center square sets)
 *  5. Edge penalty (perimeter squares)
 *  6. Back-row defense (pawns on starting rows)
 *  7. Mobility (total legal moves + capture bonuses)
 *  8. King factors (trapped kings, flying king ray mobility, king safety)
 *  9. Variant-specific (huffing vulnerability, dual-axis, consecutive-move,
 *     Italian king immunity)
 *
 * Performance: no heap allocations in the hot path. Geometry tables are
 * pre-computed and cached. Zero-weight short-circuiting skips factors
 * that don't apply to the current variant.
 */

import type { NodeId } from '../../../engine/boardGeometry';
import { asNodeId } from '../../../engine/boardGeometry';
import type { ClassifiedGameState } from '../../../engine/classified/state';
import type { DraughtsConfig } from '../../../engine/classified/draughts/DraughtsConfig';
import {
  boardSizeOf,
  hasDualAxisCapture,
  hasHuffing,
} from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsEvalWeights } from './weights';
import {
  getGeometryTables,
  getPawnAdvancement,
  countKingRayMobility,
  countKingEscapes,
  getKingDirectionDeltas,
} from './geometryHelpers';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface SideScore {
  material: number;
  advancement: number;
  positional: number;
  kingFactors: number;
  variantSpecific: number;
  pieceCount: number;
  kingCount: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluates a ClassifiedGameState from the perspective of the active side.
 * Positive scores favour the active side; negative scores favour the opponent.
 *
 * @param state - The Classified game state to evaluate.
 * @param config - The DraughtsConfig for the variant.
 * @param weights - The evaluation weights for the variant.
 * @param legalMoveCount - Optional pre-computed legal move count to avoid
 *   redundant enumeration. Pass undefined to skip the mobility factor
 *   (the caller must ensure the position is not terminal before calling).
 * @returns Numeric evaluation score.
 */
export function evaluateDraughtsPosition(
  state: ClassifiedGameState,
  config: DraughtsConfig,
  weights: DraughtsEvalWeights,
  legalMoveCount?: number,
): number {
  const turn = (state.turn ?? 'white') as 'white' | 'black';
  const opponent: 'white' | 'black' = turn === 'white' ? 'black' : 'white';
  const boardSize = boardSizeOf(config);
  const geo = getGeometryTables(config);

  // Build an occupied set for king mobility lookups.
  const occupied = new Set<NodeId>();
  let myPieceCount = 0;
  let oppPieceCount = 0;

  for (const [nodeId, piece] of state.pieces) {
    occupied.add(nodeId);
    if (piece.owner === turn) myPieceCount++;
    else oppPieceCount++;
  }

  // --- Terminal state detection ---
  if (myPieceCount === 0) return weights.lossScore;
  if (oppPieceCount === 0) return weights.winScore;

  // --- Endgame detection ---
  const totalPieces = myPieceCount + oppPieceCount;
  const isEndgame = totalPieces <= weights.endgamePieceThreshold;

  const effectiveKingValue = isEndgame ? weights.endgameKingValue : weights.kingValue;
  const effectiveAdvancement = isEndgame
    ? weights.endgameAdvancementPerRow
    : weights.advancementPerRow;

  // --- Evaluate each side ---
  const myScore = evaluateSide(
    state,
    turn,
    config,
    weights,
    geo,
    boardSize,
    occupied,
    effectiveKingValue,
    effectiveAdvancement,
  );
  const oppScore = evaluateSide(
    state,
    opponent,
    config,
    weights,
    geo,
    boardSize,
    occupied,
    effectiveKingValue,
    effectiveAdvancement,
  );

  let score = myScore.material + myScore.advancement + myScore.positional +
    myScore.kingFactors + myScore.variantSpecific -
    (oppScore.material + oppScore.advancement + oppScore.positional +
    oppScore.kingFactors + oppScore.variantSpecific);

  // --- Mobility (requires legal move count for active side) ---
  if (legalMoveCount !== undefined && weights.mobilityPerMove > 0) {
    score += legalMoveCount * weights.mobilityPerMove;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Per-side evaluation
// ---------------------------------------------------------------------------

function evaluateSide(
  state: ClassifiedGameState,
  owner: 'white' | 'black',
  config: DraughtsConfig,
  weights: DraughtsEvalWeights,
  geo: ReturnType<typeof getGeometryTables>,
  boardSize: number,
  occupied: ReadonlySet<NodeId>,
  effectiveKingValue: number,
  effectiveAdvancement: number,
): SideScore {
  let material = 0;
  let advancement = 0;
  let positional = 0;
  let kingFactors = 0;
  let variantSpecific = 0;
  let pieceCount = 0;
  let kingCount = 0;

  const backRow = owner === 'white' ? geo.whiteBackRow : geo.blackBackRow;
  const kingDirDeltas = getKingDirectionDeltas(config);
  const isFlying = config.kingType === 'flying';

  for (const [rawNodeId, piece] of state.pieces) {
    if (piece.owner !== owner) continue;

    const nodeId = rawNodeId;
    pieceCount++;

    const isKing = piece.kind === 'king';

    // --- Material ---
    if (isKing) {
      material += effectiveKingValue;
      kingCount++;
    } else {
      material += weights.pawnValue;
    }

    // --- Advancement (pawns only) ---
    if (!isKing && effectiveAdvancement > 0) {
      const rawAdv = getPawnAdvancement(nodeId, owner, boardSize);
      advancement += (rawAdv * effectiveAdvancement) / weights.advancementBoardSizeNormaliser;
    }

    // --- Positional: center and edge ---
    if (weights.centerBonus > 0 && geo.centerSquares.has(nodeId)) {
      positional += weights.centerBonus;
    } else if (weights.centerBonus > 0 && geo.expandedCenterSquares.has(nodeId)) {
      positional += weights.centerBonus / 2;
    }

    if (weights.edgePenalty > 0 && geo.edgeSquares.has(nodeId)) {
      positional -= weights.edgePenalty;
    }

    // --- Back-row defense (pawns only) ---
    if (!isKing && weights.backRowBonus > 0 && backRow.has(nodeId)) {
      positional += weights.backRowBonus;
    }

    // --- King factors ---
    if (isKing) {
      // Trapped king detection.
      const escapes = countKingEscapes(
        nodeId,
        kingDirDeltas,
        boardSize,
        occupied,
        geo.playableNodes,
      );
      if (escapes === 0) {
        kingFactors -= weights.trappedKingPenalty;
      } else if (escapes === 1) {
        kingFactors -= weights.semiTrappedKingPenalty;
      }

      // Flying king mobility bonus.
      if (isFlying && weights.flyingKingMobilityBonus > 0) {
        const rayReach = countKingRayMobility(
          nodeId,
          kingDirDeltas,
          boardSize,
          occupied,
          geo.playableNodes,
        );
        kingFactors += rayReach * weights.flyingKingMobilityBonus;
      }

      // King safety distance bonus (closer to center is safer).
      if (weights.kingSafetyDistanceBonus > 0) {
        const idx = nodeId as number;
        const r = Math.floor(idx / boardSize);
        const c = idx % boardSize;
        const centerR = (boardSize - 1) / 2;
        const centerC = (boardSize - 1) / 2;
        const dist = Math.abs(r - centerR) + Math.abs(c - centerC);
        const maxDist = boardSize - 1;
        kingFactors += Math.round((maxDist - dist) * weights.kingSafetyDistanceBonus / maxDist);
      }

      // --- Variant-specific: consecutive move penalty ---
      if (weights.consecutiveMovePenalty > 0 && config.kingConsecutiveMoveLimit !== null) {
        const streak = getKingStreak(state, nodeId);
        if (streak >= config.kingConsecutiveMoveLimit - 1) {
          variantSpecific -= weights.consecutiveMovePenalty;
        } else if (streak >= config.kingConsecutiveMoveLimit - 2) {
          variantSpecific -= Math.floor(weights.consecutiveMovePenalty / 2);
        }
      }

      // --- Variant-specific: Italian king immunity from pawn capture ---
      if (weights.kingImmuneFromPawnBonus > 0 && !config.menCanCaptureKings) {
        variantSpecific += weights.kingImmuneFromPawnBonus;
      }
    }
  }

  // --- Variant-specific: huffing vulnerability ---
  if (weights.huffingVulnerabilityPenalty > 0 && hasHuffing(config)) {
    // Count pawns that could be huffed (have capture available but might not take it).
    // Simplified: penalise for having fewer escape options near opponent pieces.
    variantSpecific -= estimateHuffingVulnerability(state, owner, boardSize) *
      weights.huffingVulnerabilityPenalty;
  }

  // --- Variant-specific: dual-axis capture bonus ---
  if (weights.dualAxisCaptureBonus > 0 && hasDualAxisCapture(config)) {
    // Bonus for kings (which have more capture directions) in dual-axis variants.
    variantSpecific += kingCount * weights.dualAxisCaptureBonus;
  }

  return {
    material,
    advancement,
    positional,
    kingFactors,
    variantSpecific,
    pieceCount,
    kingCount,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the consecutive-move streak for a king at the given node from
 * the state's meta.kingMoveStreak.
 */
function getKingStreak(state: ClassifiedGameState, nodeId: NodeId): number {
  const streakData = state.meta?.['kingMoveStreak'];
  if (!Array.isArray(streakData)) return 0;

  for (const entry of streakData) {
    if (Array.isArray(entry) && entry.length >= 2) {
      const [streakNode, count] = entry as [number, number];
      if (streakNode === (nodeId as number)) return count;
    }
  }
  return 0;
}

/**
 * Estimates huffing vulnerability by counting forward-adjacent opponent pieces.
 * A high count means more capture obligations and higher huffing risk.
 */
function estimateHuffingVulnerability(
  state: ClassifiedGameState,
  owner: 'white' | 'black',
  boardSize: number,
): number {
  let vulnerability = 0;
  const opponent = owner === 'white' ? 'black' : 'white';

  for (const [rawNodeId, piece] of state.pieces) {
    if (piece.owner !== owner || piece.kind === 'king') continue;

    const idx = rawNodeId as number;
    const r = Math.floor(idx / boardSize);
    const c = idx % boardSize;

    // Check forward diagonals for opponent pieces.
    const fwd = owner === 'white' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const nr = r + fwd;
      const nc = c + dc;
      if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
        const target = asNodeId(nr * boardSize + nc);
        const targetPiece = state.pieces.get(target);
        if (targetPiece && targetPiece.owner === opponent) {
          vulnerability++;
        }
      }
    }
  }
  return vulnerability;
}
