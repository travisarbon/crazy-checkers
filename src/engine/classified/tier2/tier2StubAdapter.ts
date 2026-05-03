/**
 * Tier 2 stub Cogitate adapter (Task 29.7).
 *
 * Mirrors the non-draughts branch of `createDefaultClassifiedAdapter` —
 * provides a working `CogitateGameAdapter` that satisfies the contract
 * shape but reports `supportsEvaluation: false` and throws descriptive
 * errors for unsupported ops.
 *
 * Used specifically for Tier 2 games whose `ruleSetFamily === 'draughts'`
 * (currently only Harzdame). The default adapter would otherwise dispatch
 * to the Tier 1 draughts adapter, which then tries to look up Tier 1
 * evaluator weights for the gameId and fails with "No evaluation weights
 * registered for draughts variant: harzdame."
 *
 * Per-game subtask C-block adapters supersede this stub.
 */

import type { BoardState } from '../../types';
import type {
  CogitateGameAdapter,
  CogitateHandReserve,
  CogitateOnBoardPalette,
} from '../../../cogitate/CogitateGameAdapter';
import type {
  BoardGeometry as CogitateBoardGeometry,
  PieceDefinition as CogitatePieceDefinition,
  ValidationResult,
} from '../../../cogitate/types';
import type { EvaluationProvider } from '../../../cogitate/EvaluationProvider';
import { getCheckersNotationAdapter } from '../../../cogitate/NotationAdapter';
import { ANALYSIS_SEARCH_CONFIG } from '../../../cogitate/types';
import type { ClassifiedRegistrationSpec } from '../registrationSpec';

interface AdapterInput {
  readonly gameId: string;
  readonly modeId: string;
  readonly ruleSet: ClassifiedRegistrationSpec['ruleSet'];
  readonly boardGeometry: ClassifiedRegistrationSpec['boardGeometry'];
}

function synthesiseCogitateGeometry(entry: AdapterInput): CogitateBoardGeometry {
  const dims = entry.boardGeometry.dimensions;
  if (dims.square) {
    const size = dims.square.size;
    const playable =
      entry.boardGeometry.playableMask !== undefined ? (size * size) / 2 : size * size;
    return {
      gridType: entry.boardGeometry.indexing === 'intersections' ? 'full-square' : 'diagonal-square',
      rows: size,
      cols: size,
      playableSquares: playable,
      darkSquaresOnly: entry.boardGeometry.playableMask !== undefined,
    };
  }
  return {
    gridType: 'full-square',
    rows: 1,
    cols: 1,
    playableSquares: entry.boardGeometry.adjacency.nodeCount(),
    darkSquaresOnly: false,
  };
}

function stubEvaluationProvider(): EvaluationProvider {
  return {
    isAvailable: false,
    providerType: 'classified-tier2-stub',
    evaluate() {
      return null;
    },
    getTopMoves() {
      return [];
    },
  };
}

export function createTier2StubAdapter(entry: AdapterInput): CogitateGameAdapter {
  const geometry = synthesiseCogitateGeometry(entry);
  const notation = getCheckersNotationAdapter();
  const evaluationProvider = stubEvaluationProvider();
  const palette: readonly CogitatePieceDefinition[] = [];

  const throwNotSupported = (method: string): never => {
    throw new Error(
      `Tier 2 stub adapter (${entry.gameId}): ${method} is unsupported. ` +
        `Supply a bespoke adapter via per-game subtask 29.G.x-C.`,
    );
  };

  return {
    modeId: entry.modeId,
    getBoard: (): BoardState => throwNotSupported('getBoard'),
    serializeBoard: (): string => throwNotSupported('serializeBoard'),
    getRuleSet: () => throwNotSupported('getRuleSet'),
    getAIConfig: () => ANALYSIS_SEARCH_CONFIG,
    getPiecePalette: () => palette,
    getBoardGeometry: () => geometry,
    getStartingPosition: (): BoardState => throwNotSupported('getStartingPosition'),
    validatePosition: (): ValidationResult => ({
      isLegal: true,
      warnings: [],
      errors: [],
    }),
    getNotationAdapter: () => notation,
    supportsEvaluation: () => false,
    getEvaluationRange: () => [-1, 1] as const,
    getEvaluationProvider: () => evaluationProvider,

    getOnBoardPalette: (): CogitateOnBoardPalette => entry.ruleSet.pieceVocabulary.onBoard,
    getHandPalette: (): CogitateHandReserve => entry.ruleSet.pieceVocabulary.inHand,
  };
}
