/**
 * Dameo Cogitate adapter (Phase 4 Task 29.G.1-C §9.2).
 *
 * Mirrors `draughtsTier1Adapter.ts` shape for the Dameo per-game subtask.
 * Wraps the default Tier 2 stub adapter with Dameo-specific:
 *   - Position validator (`validateDameoPosition`) — enforces Dameo
 *     invariants (≤18 pieces per side, valid kinds, on-board NodeIds,
 *     turn parity).
 *   - Notation bridge (Phase 3 ↔ Phase 4) consuming Task 29.8's
 *     Dameo notation adapter for Replay's move-list rendering.
 *   - Stub evaluation provider (per per-game subtask 29.G.1-A — the
 *     real evaluation provider bridge is a follow-up; the stub
 *     provides the contract surface so Cogitate Analysis doesn't crash).
 *
 * Per plan §9.2: Replay/Analysis/Free Play/Training controllers are
 * deferred to follow-up subtasks; this adapter provides the Phase 3
 * `CogitateGameAdapter` shape that Cogitate's existing tools
 * already consume.
 */

import type { BoardState } from '../../../engine/types';
import type {
  CogitateGameAdapter,
  CogitateHandReserve,
  CogitateOnBoardPalette,
} from '../../CogitateGameAdapter';
import type {
  BoardGeometry as CogitateBoardGeometry,
  PieceDefinition as CogitatePieceDefinition,
  ValidationResult,
} from '../../types';
import type { EvaluationProvider } from '../../EvaluationProvider';
import type { NotationAdapter } from '../../NotationAdapter';
import type { Difficulty } from '../../../ai/difficulty';
import type { SearchConfig } from '../../../ai/search';
import type { ClassifiedRegistryEntry } from '../../../engine/classified/registry';
import type { ClassifiedGameState } from '../../../engine/classified/state';
import { getCheckersNotationAdapter } from '../../NotationAdapter';
import { ANALYSIS_SEARCH_CONFIG } from '../../types';
import { createClassifiedNotationBridge } from '../../notation/classifiedBridge';
import { getDameoDifficultyConfig } from '../../../ai/evaluators/tier2/linear/dameoDifficultyPresets';

// ---------------------------------------------------------------------------
// Position validator
// ---------------------------------------------------------------------------

const DAMEO_BOARD_SIZE = 8;
const DAMEO_PIECES_PER_SIDE = 18;

export function validateDameoPosition(board: BoardState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof (board as unknown) !== 'object' || (board as unknown) === null) {
    errors.push('Position must be a ClassifiedGameState with a pieces Map');
    return { isLegal: false, errors, warnings };
  }
  const candidate = board as unknown as Record<string, unknown>;
  if (!('pieces' in candidate) || !(candidate.pieces instanceof Map)) {
    errors.push('Position must be a ClassifiedGameState with a pieces Map');
    return { isLegal: false, errors, warnings };
  }
  const state = board as unknown as ClassifiedGameState;
  const pieces = state.pieces;

  let whiteCount = 0;
  let blackCount = 0;

  for (const [nodeId, piece] of pieces) {
    const idx = nodeId as unknown as number;
    if (idx < 0 || idx >= DAMEO_BOARD_SIZE * DAMEO_BOARD_SIZE) {
      errors.push(`Piece at NodeId ${String(idx)} is off-board`);
      continue;
    }
    if (piece.kind !== 'man' && piece.kind !== 'king') {
      errors.push(
        `Piece at NodeId ${String(idx)} has invalid kind "${piece.kind}" (expected "man" or "king")`,
      );
      continue;
    }
    if (piece.owner === 'white') whiteCount += 1;
    else if (piece.owner === 'black') blackCount += 1;
    else {
      errors.push(
        `Piece at NodeId ${String(idx)} has invalid owner "${piece.owner}" (expected "white" or "black")`,
      );
    }
  }

  if (whiteCount === 0 && blackCount === 0) {
    errors.push('No pieces on board');
  }
  if (whiteCount > DAMEO_PIECES_PER_SIDE) {
    errors.push(
      `Too many White pieces (${String(whiteCount)} > ${String(DAMEO_PIECES_PER_SIDE)})`,
    );
  }
  if (blackCount > DAMEO_PIECES_PER_SIDE) {
    errors.push(
      `Too many Black pieces (${String(blackCount)} > ${String(DAMEO_PIECES_PER_SIDE)})`,
    );
  }

  if (state.turn !== undefined && state.turn !== 'white' && state.turn !== 'black') {
    errors.push(`Invalid turn: ${state.turn}`);
  }

  return {
    isLegal: errors.length === 0,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Geometry synthesis
// ---------------------------------------------------------------------------

function synthesiseDameoGeometry(entry: ClassifiedRegistryEntry): CogitateBoardGeometry {
  const dims = entry.boardGeometry.dimensions;
  const size = dims.square?.size ?? DAMEO_BOARD_SIZE;
  const hasMask = entry.boardGeometry.playableMask !== undefined;
  return {
    gridType: hasMask ? 'diagonal-square' : 'full-square',
    rows: size,
    cols: size,
    playableSquares: hasMask ? (size * size) / 2 : size * size,
    darkSquaresOnly: hasMask,
  };
}

// ---------------------------------------------------------------------------
// Stub evaluation provider
// ---------------------------------------------------------------------------

const RAW_EVAL_RANGE: readonly [number, number] = [-1, 1];

function createDameoStubEvaluationProvider(): EvaluationProvider {
  return {
    isAvailable: false,
    providerType: 'classified-dameo-stub',
    evaluate() {
      return null;
    },
    getTopMoves() {
      return [];
    },
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Creates a Cogitate adapter for Dameo (classifiedNumber 11).
 *
 * Preconditions:
 *  - `entry.gameId === 'dameo'`.
 *  - `entry.ruleSet.notationAdapter` is defined (Task 29.8 ships it).
 */
export function createDameoAdapter(
  entry: ClassifiedRegistryEntry,
): CogitateGameAdapter {
  const notationAdapter = entry.ruleSet.notationAdapter;
  const notation: NotationAdapter = notationAdapter
    ? createClassifiedNotationBridge(notationAdapter)
    : getCheckersNotationAdapter();
  const evaluationProvider = createDameoStubEvaluationProvider();
  const geometry = synthesiseDameoGeometry(entry);
  const palette: readonly CogitatePieceDefinition[] = [];

  return {
    modeId: entry.modeId,

    getBoard(): BoardState {
      return entry.ruleSet.startingPosition() as unknown as BoardState;
    },

    serializeBoard(board: BoardState): string {
      return JSON.stringify(
        entry.ruleSet.serializer.toJSON(board as unknown as ClassifiedGameState),
      );
    },

    getRuleSet() {
      throw new Error(
        `CogitateGameAdapter.getRuleSet() is not supported for Dameo. ` +
          'Use the ClassifiedRuleSet from the registry directly.',
      );
    },

    getAIConfig(difficulty: Difficulty): SearchConfig {
      const level: 'easy' | 'hard' = difficulty === 'hard' ? 'hard' : 'easy';
      const cfg = getDameoDifficultyConfig({ level });
      return {
        maxDepth: cfg.maxDepth,
        timeLimitMs: cfg.maxTimeMs,
        quiescenceEnabled: (cfg.quiescenceDepth ?? 0) > 0,
        quiescenceMaxDepth: cfg.quiescenceDepth ?? 0,
      };
    },

    getPiecePalette(): readonly CogitatePieceDefinition[] {
      return palette;
    },

    getBoardGeometry(): CogitateBoardGeometry {
      return geometry;
    },

    getStartingPosition(): BoardState {
      return entry.ruleSet.startingPosition() as unknown as BoardState;
    },

    validatePosition(board: BoardState): ValidationResult {
      return validateDameoPosition(board);
    },

    getNotationAdapter(): NotationAdapter {
      return notation;
    },

    supportsEvaluation(): boolean {
      // Stub provider for now; per-game subtask C-block follow-up wires
      // a real Cogitate Analysis provider against `evaluateLinearPosition`.
      return false;
    },

    getEvaluationRange(): readonly [number, number] {
      return RAW_EVAL_RANGE;
    },

    getEvaluationProvider(): EvaluationProvider {
      return evaluationProvider;
    },

    getOnBoardPalette(): CogitateOnBoardPalette {
      return entry.ruleSet.pieceVocabulary.onBoard;
    },

    getHandPalette(): CogitateHandReserve {
      return entry.ruleSet.pieceVocabulary.inHand;
    },
  };
}

// Avoid unused-import warning when ANALYSIS_SEARCH_CONFIG isn't directly
// referenced (kept for future Cogitate Analysis wiring).
void ANALYSIS_SEARCH_CONFIG;
