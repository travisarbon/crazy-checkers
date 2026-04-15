/**
 * createDefaultClassifiedAdapter — default Cogitate adapter generator
 * (Task 27.4 §4.6).
 *
 * Produces a `CogitateGameAdapter` that satisfies every Phase 3 method in
 * the interface plus the Task 27.4 T7-08 extensions (`getOnBoardPalette`,
 * `getHandPalette`). Games that need bespoke Cogitate behaviour (Training
 * move-quality heuristics, Analysis evaluation, etc.) still author their
 * own adapter and pass it via `ClassifiedRegistrationSpec.adapter`.
 *
 * Methods that don't apply to arbitrary Classified games (e.g. `getBoard`
 * on an 8×8 diagonal-square string format) throw a descriptive error so
 * misuse is loud — Task 38 / per-tier tasks override as needed.
 */

import type { BoardState } from '../types';
import type {
  CogitateGameAdapter,
  CogitateHandReserve,
  CogitateOnBoardPalette,
} from '../../cogitate/CogitateGameAdapter';
import type {
  BoardGeometry as CogitateBoardGeometry,
  PieceDefinition as CogitatePieceDefinition,
  ValidationResult,
} from '../../cogitate/types';
import type { EvaluationProvider } from '../../cogitate/EvaluationProvider';
import { getCheckersNotationAdapter } from '../../cogitate/NotationAdapter';
import { ANALYSIS_SEARCH_CONFIG } from '../../cogitate/types';
import type { ClassifiedRegistryEntry } from './registry';

// ---------------------------------------------------------------------------
// Cogitate-geometry synthesiser
// ---------------------------------------------------------------------------

function synthesiseCogitateGeometry(entry: ClassifiedRegistryEntry): CogitateBoardGeometry {
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
  if (dims.rectangle) {
    return {
      gridType: 'full-square',
      rows: dims.rectangle.height,
      cols: dims.rectangle.width,
      playableSquares: dims.rectangle.width * dims.rectangle.height,
      darkSquaresOnly: false,
    };
  }
  if (dims.hexRhombus) {
    const s = dims.hexRhombus.size;
    return { gridType: 'hex', rows: s, cols: s, playableSquares: s * s, darkSquaresOnly: false };
  }
  // Generic fallback — consumers that care should supply a bespoke adapter.
  return {
    gridType: 'full-square',
    rows: 1,
    cols: 1,
    playableSquares: entry.boardGeometry.adjacency.nodeCount(),
    darkSquaresOnly: false,
  };
}

// ---------------------------------------------------------------------------
// Piece-palette mapping (ClassifiedRuleSet PieceVocabulary → Phase 3 shape)
// ---------------------------------------------------------------------------

function mapToCogitatePalette(
  entry: ClassifiedRegistryEntry,
): readonly CogitatePieceDefinition[] {
  const vocab = entry.ruleSet.pieceVocabulary;
  const out: CogitatePieceDefinition[] = [];
  for (const def of [...vocab.onBoard, ...vocab.inHand]) {
    // Skip pieces that don't have a clear checkers-style color/type mapping.
    // Phase 3 PieceDefinition expects PieceColor + PieceType; Task 27.5 will
    // introduce the Phase 4 PieceRegistry that resolves pieceId → SVG. Until
    // then, callers that consume getPiecePalette expect the Phase 3 shape
    // and Classified-specific pieces simply don't appear.
    void def;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stub EvaluationProvider — reports unavailable by default
// ---------------------------------------------------------------------------

function stubEvaluationProvider(): EvaluationProvider {
  return {
    isAvailable: false,
    providerType: 'classified-default',
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

export function createDefaultClassifiedAdapter(
  entry: ClassifiedRegistryEntry,
): CogitateGameAdapter {
  const geometry = synthesiseCogitateGeometry(entry);
  const palette = mapToCogitatePalette(entry);
  const notation = getCheckersNotationAdapter();
  const evaluationProvider = stubEvaluationProvider();

  const throwNotSupported = (method: string): never => {
    throw new Error(
      `CogitateGameAdapter.${method} is not supported by the default Classified adapter ` +
        `for "${entry.gameId}". Supply a bespoke adapter via ` +
        `ClassifiedRegistrationSpec.adapter, or wait for Task 27.6 / Task 38.`,
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

    // Task 27.4 T7-08 extensions
    getOnBoardPalette: (): CogitateOnBoardPalette => entry.ruleSet.pieceVocabulary.onBoard,
    getHandPalette: (): CogitateHandReserve => entry.ruleSet.pieceVocabulary.inHand,
  };
}
