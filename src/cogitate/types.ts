/**
 * Shared Cogitate type definitions (Task 21.1).
 *
 * All types consumed by Cogitate adapters, providers, and UI components live here
 * to avoid circular dependencies.
 */

import type { Move, PieceColor, PieceType, Square } from '../engine/types';
import type { SearchConfig } from '../ai/search';

// ---------------------------------------------------------------------------
// Board geometry
// ---------------------------------------------------------------------------

/** Board geometry descriptor. Drives renderer selection and sizing. */
export interface BoardGeometry {
  readonly gridType:
    | 'diagonal-square'
    | 'full-square'
    | 'hex'
    | 'ring'
    | 'cross'
    | 'dot'
    | 'rhombus'
    | 'mancala';
  readonly rows: number;
  readonly cols: number;
  /** Total number of playable cells (e.g., 32 for 8×8 diagonal). */
  readonly playableSquares: number;
  /** Whether only dark squares are used (true for draughts family). */
  readonly darkSquaresOnly: boolean;
}

/** Standard 8×8 diagonal-square geometry shared across all draughts-family modes. */
export const DRAUGHTS_BOARD_GEOMETRY: BoardGeometry = {
  gridType: 'diagonal-square',
  rows: 8,
  cols: 8,
  playableSquares: 32,
  darkSquaresOnly: true,
};

// ---------------------------------------------------------------------------
// Piece palette (Free Play editor)
// ---------------------------------------------------------------------------

/** Piece definition for the Free Play position editor palette. */
export interface PieceDefinition {
  readonly color: PieceColor;
  readonly type: PieceType;
  readonly displayName: string;
  /** SVG icon identifier or render key for the piece. */
  readonly renderKey: string;
}

// ---------------------------------------------------------------------------
// Position validation
// ---------------------------------------------------------------------------

/** Position validation result. */
export interface ValidationResult {
  readonly isLegal: boolean;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Evaluation results
// ---------------------------------------------------------------------------

/** Normalized evaluation result from an EvaluationProvider. */
export interface NormalizedEvaluation {
  /** Score in range [-1.0, +1.0]. +1.0 = decisive White advantage. */
  readonly score: number;
  /** Raw score before normalization (for display). */
  readonly rawScore: number;
  /** Whether the evaluation comes from a terminal state (game over). */
  readonly isTerminal: boolean;
  /** Confidence level: 1.0 for minimax (deterministic). */
  readonly confidence: number;
}

/** A single evaluated move. */
export interface EvaluatedMove {
  readonly move: Move;
  readonly notation: string;
  readonly score: number;
  readonly normalizedScore: number;
}

/** Full analysis result for a single position. */
export interface AnalysisResult {
  /** Normalized evaluation of the best move from this position. */
  readonly evaluation: number;
  /** The engine's recommended best move. */
  readonly bestMove: Move | null;
  /** Best move in human-readable notation. */
  readonly bestMoveNotation: string;
  /** Principal variation (best play line). */
  readonly principalVariation: readonly Move[];
  /** PV as notation strings. */
  readonly pvNotation: readonly string[];
  /** Top alternative moves with evaluations. */
  readonly alternativeMoves: readonly EvaluatedMove[];
  /** Search depth reached. */
  readonly depth: number;
  /** Number of nodes evaluated. */
  readonly nodesEvaluated: number;
  /** Raw best-move score before normalization. */
  readonly rawScore: number;
  /** Normalized eval drop vs. the best move (populated by Analysis tool). */
  readonly evalDrop?: number;
  /** Classified move quality (populated by Analysis tool). */
  readonly moveQuality?: MoveQuality;
}

// ---------------------------------------------------------------------------
// Move quality classification
// ---------------------------------------------------------------------------

export type MoveQuality = 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export const MOVE_QUALITY_THRESHOLDS = {
  brilliant: { minLegalMoves: 3, notForcedCapture: true, secondBestGap: 0.1 },
  good: { maxEvalDrop: 0.05 },
  inaccuracy: { minEvalDrop: 0.05, maxEvalDrop: 0.15 },
  mistake: { minEvalDrop: 0.15, maxEvalDrop: 0.3 },
  blunder: { minEvalDrop: 0.3 },
} as const;

// ---------------------------------------------------------------------------
// Search configs
// ---------------------------------------------------------------------------

/** Standard analysis search configuration. */
export const ANALYSIS_SEARCH_CONFIG: SearchConfig = {
  maxDepth: 8,
  timeLimitMs: 3000,
  quiescenceEnabled: true,
  quiescenceMaxDepth: 4,
};

/** Deep analysis configuration (player-requested on specific positions). */
export const DEEP_ANALYSIS_SEARCH_CONFIG: SearchConfig = {
  maxDepth: 12,
  timeLimitMs: 10000,
  quiescenceEnabled: true,
  quiescenceMaxDepth: 6,
};

// ---------------------------------------------------------------------------
// Evaluation normalization
// ---------------------------------------------------------------------------

/**
 * Sigmoid constant mapping raw evaluation scores to [-1.0, +1.0].
 *
 *   normalized = rawScore / (|rawScore| + K)
 *
 * With the EVAL_WEIGHTS pawn value = 100, a 3-piece material edge is raw ~300;
 * K = 250 places that around ±0.55. Tuned to feel linear in the typical
 * mid-game range rather than saturating instantly.
 */
export const EVAL_BAR_SIGMOID_K = 250;

/** Threshold above which a raw score is treated as terminal (forced win/loss). */
export const EVAL_TERMINAL_THRESHOLD = 9000;

// ---------------------------------------------------------------------------
// Diagram overlays (Free Play / Analysis)
// ---------------------------------------------------------------------------

export type DiagramColor = 'green' | 'red' | 'blue';

export interface DiagramArrow {
  readonly from: Square;
  readonly to: Square;
  readonly color: DiagramColor;
}

export interface DiagramHighlight {
  readonly square: Square;
  readonly color: DiagramColor;
}

export interface DiagramAnnotation {
  readonly square: Square;
  readonly text: string;
}

export interface DiagramOverlayState {
  readonly arrows: readonly DiagramArrow[];
  readonly highlights: readonly DiagramHighlight[];
  readonly annotations: readonly DiagramAnnotation[];
}
