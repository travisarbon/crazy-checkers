/**
 * Tier 1 Cogitate adapter factory for Classified draughts (Task 28.6 §3).
 *
 * `createDraughtsTier1Adapter(entry)` produces a `CogitateGameAdapter`
 * parameterised by the ClassifiedRegistryEntry. Replaces the default
 * throw-everywhere stub with working implementations for all Phase 3
 * Cogitate methods.
 *
 * Preconditions:
 *  - `entry.ruleSet.ruleSetFamily === 'draughts'`
 *  - `entry.ruleSet.notationAdapter` is defined
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
import { getDraughtsDifficultyConfig } from '../../../ai/evaluators/draughts/difficultyPresets';
import type { SearchConfig } from '../../../ai/search';
import type { ClassifiedRegistryEntry } from '../../../engine/classified/registry';
import type { ClassifiedGameState } from '../../../engine/classified/state';
import type { DraughtsConfig, DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsConfig, boardSizeOf } from '../../../engine/classified/draughts/DraughtsConfig';
import { createClassifiedNotationBridge } from '../../notation/classifiedBridge';
import { createDraughtsEvaluationProviderBridge } from './draughtsEvaluationProviderBridge';

// ---------------------------------------------------------------------------
// Board geometry synthesis
// ---------------------------------------------------------------------------

function synthesiseDraughtsGeometry(
  entry: ClassifiedRegistryEntry,
): CogitateBoardGeometry {
  const dims = entry.boardGeometry.dimensions;
  const size = dims.square?.size ?? 8;
  const hasMask = entry.boardGeometry.playableMask !== undefined;
  const playable = hasMask ? (size * size) / 2 : size * size;
  return {
    gridType: hasMask ? 'diagonal-square' : 'full-square',
    rows: size,
    cols: size,
    playableSquares: playable,
    darkSquaresOnly: hasMask,
  };
}

// ---------------------------------------------------------------------------
// Position validation
// ---------------------------------------------------------------------------

function validateDraughtsPosition(
  board: BoardState,
  config: DraughtsConfig,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must be a ClassifiedGameState (duck-type check via pieces Map).
  const candidate = board as unknown as Record<string, unknown>;
  if (
    !('pieces' in candidate) ||
    !(candidate.pieces instanceof Map)
  ) {
    errors.push('Position must be a ClassifiedGameState with a pieces Map');
    return { isLegal: false, errors, warnings };
  }

  const state = board as unknown as ClassifiedGameState;
  const pieces = state.pieces;
  const boardSize = boardSizeOf(config);
  const hasMask = config.boardGeometry.playableMask !== undefined;

  let whiteCount = 0;
  let blackCount = 0;

  for (const [nodeId, piece] of pieces) {
    const idx = nodeId as number;
    const r = Math.floor(idx / boardSize);
    const c = idx % boardSize;

    // Dark-square check for diagonal-only boards.
    if (hasMask && (r + c) % 2 !== 1) {
      errors.push(`Piece at (${String(r)},${String(c)}) is not on a dark square`);
    }

    if (piece.owner === 'white') whiteCount++;
    else if (piece.owner === 'black') blackCount++;

    // Promotion-row check: men should not be on their promotion row.
    if (piece.kind === 'man') {
      const promotionRow = piece.owner === 'white' ? 0 : boardSize - 1;
      if (r === promotionRow) {
        warnings.push(
          `Man at (${String(r)},${String(c)}) is on promotion row (should be king)`,
        );
      }
    }
  }

  if (whiteCount === 0 && blackCount === 0) {
    errors.push('No pieces on board');
  }
  if (whiteCount > config.piecesPerSide) {
    errors.push(
      `Too many White pieces (${String(whiteCount)} > ${String(config.piecesPerSide)})`,
    );
  }
  if (blackCount > config.piecesPerSide) {
    errors.push(
      `Too many Black pieces (${String(blackCount)} > ${String(config.piecesPerSide)})`,
    );
  }

  // Turn validity.
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
// Public factory
// ---------------------------------------------------------------------------

const RAW_EVAL_RANGE: readonly [number, number] = [-1, 1];

/**
 * Creates a Cogitate adapter for a Tier 1 Classified draughts game.
 *
 * @param entry - The ClassifiedRegistryEntry for the draughts variant.
 * @returns A fully functional CogitateGameAdapter.
 */
export function createDraughtsTier1Adapter(
  entry: ClassifiedRegistryEntry,
): CogitateGameAdapter {
  const gameId = entry.gameId as unknown as DraughtsGameId;
  const config = createDraughtsConfig(gameId);

  // Memoised bridges — created once per adapter.
  const notationAdapter = entry.ruleSet.notationAdapter;
  const notation: NotationAdapter = notationAdapter
    ? createClassifiedNotationBridge(notationAdapter)
    : { moveToString: () => '', stringToMove: () => null, formatMoveNumber: (_p, n) => n };

  const evaluationProvider: EvaluationProvider =
    createDraughtsEvaluationProviderBridge(gameId);

  const geometry = synthesiseDraughtsGeometry(entry);
  const palette: readonly CogitatePieceDefinition[] = [];

  return {
    modeId: entry.modeId,

    getBoard(): BoardState {
      // For Classified games, return the starting position as the "board".
      // The actual state is a ClassifiedGameState, not a Phase 1 BoardState.
      return entry.ruleSet.startingPosition() as unknown as BoardState;
    },

    serializeBoard(board: BoardState): string {
      return JSON.stringify(entry.ruleSet.serializer.toJSON(board as unknown as ClassifiedGameState));
    },

    getRuleSet() {
      // Return a minimal RuleSet-compatible shim that throws on use.
      // Classified games don't satisfy the Phase 1 RuleSet interface;
      // callers should use the ClassifiedRuleSet via the registry instead.
      throw new Error(
        `CogitateGameAdapter.getRuleSet() is not supported for Classified game "${entry.gameId}". ` +
        'Use the ClassifiedRuleSet from the registry directly.',
      );
    },

    getAIConfig(difficulty: Difficulty): SearchConfig {
      const diffConfig = getDraughtsDifficultyConfig(config, difficulty);
      return {
        maxDepth: diffConfig.maxDepth,
        timeLimitMs: diffConfig.timeLimitMs,
        quiescenceEnabled: diffConfig.quiescenceEnabled,
        quiescenceMaxDepth: diffConfig.quiescenceMaxDepth,
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
      return validateDraughtsPosition(board, config);
    },

    getNotationAdapter(): NotationAdapter {
      return notation;
    },

    supportsEvaluation(): boolean {
      return true;
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
