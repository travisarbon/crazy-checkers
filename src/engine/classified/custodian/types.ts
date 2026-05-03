/**
 * Custodian-engine type vocabulary (Phase 4 Task 29.4).
 *
 * Pure data contract for four Tier 2 games that share a single
 * capture-mode-toggle engine: Mak-yek, Hasami Shogi, Rek, Dai Hasami Shogi.
 * Every per-game divergence travels through `CustodianConfig` knobs — the
 * engine modules NEVER branch on `gameId`.
 *
 * Authoritative references:
 *  - Documentation/Phase 4/Task 29/Task_29_4_CustodianCaptureEngine_Implementation_Plan.md §4
 *  - Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md §3.3, §4.6, §4.7, §4.8, §4.9
 *  - src/engine/classified/{stacking,linear,alquerque}/* — Tier 2 engine-author template.
 */

import type { BoardGeometry, NodeId } from '../../boardGeometry';
import { squareGeometry } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { ClassifiedMove } from '../ClassifiedRuleSet';

// ---------------------------------------------------------------------------
// Owner + piece vocabulary
// ---------------------------------------------------------------------------

export type CustodianOwner = 'white' | 'black';
export type CustodianPieceKind = 'man' | 'king';

/** Custodian-engine piece — narrow alias for the Phase 4 ClassifiedPiece shape. */
export interface CustodianPiece extends ClassifiedPiece {
  readonly owner: CustodianOwner;
  readonly kind: CustodianPieceKind;
}

// ---------------------------------------------------------------------------
// Game id closed enumeration
// ---------------------------------------------------------------------------

export type CustodianGameId =
  | 'mak-yek'
  | 'hasami-shogi'
  | 'rek'
  | 'dai-hasami-shogi';

// ---------------------------------------------------------------------------
// Move shape — specialises ClassifiedMove
// ---------------------------------------------------------------------------

export type CustodianMoveKind = 'slide' | 'jump';

export interface CustodianMove extends ClassifiedMove {
  readonly kind: CustodianMoveKind;
  readonly from: string;
  readonly to: string;
  readonly piece: CustodianPieceKind;
  /** Captures discovered during apply, ordered: custodian → intervention → corner → line → immobilization. */
  readonly capture: readonly string[];
  readonly meta?: {
    readonly owner?: CustodianOwner;
    readonly fromNode?: number;
    readonly toNode?: number;
    /** Per-mode capture breakdown for ARIA + Cogitate replay narration. */
    readonly captureBreakdown?: {
      readonly custodian?: readonly number[];
      readonly intervention?: readonly number[];
      readonly corner?: readonly number[];
      readonly immobilization?: readonly number[];
      readonly line?: readonly number[];
    };
    /** Dai Hasami: the 5-in-a-row line that triggered the win, if any. */
    readonly winningLine?: readonly number[];
  };
}

// ---------------------------------------------------------------------------
// Win condition discriminator
// ---------------------------------------------------------------------------

export type CustodianWinCondition =
  | { readonly kind: 'no-pieces' }
  | { readonly kind: 'reduce-below'; readonly threshold: number }
  | { readonly kind: 'capture-king' }
  | {
      readonly kind: 'reduce-below-or-line-formation';
      readonly captureThreshold: number;
      readonly lineLength: number;
      readonly lineAxes: readonly ('horizontal' | 'vertical' | 'diagonal')[];
      readonly excludeOwnStartingRanks: number;
    };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CustodianStartingPositionDescriptor {
  /** Per-side rank indices (counted from each side's home rank) on which 'man' fills all files. */
  readonly menRanks: readonly number[];
  /** Optional king placements (Rek only). */
  readonly kings?: ReadonlyArray<{
    readonly side: CustodianOwner;
    /** Absolute row index (0..size-1). */
    readonly rank: number;
    /** Absolute column index (0..size-1). */
    readonly file: number;
  }>;
  /**
   * Per-side rank indices (counted from each side's home) where a 'man' must NOT
   * be placed (gap). Used by Rek to leave the King's slot empty for the King.
   * Indexed against the same logical "menRanks" filling — entries here are
   * positions otherwise filled by men but reserved for the King.
   */
  readonly menGapsForKing?: ReadonlyArray<{
    readonly side: CustodianOwner;
    readonly rank: number;
    readonly file: number;
  }>;
  /** For verification: total piece count expected per side (men + king). */
  readonly piecesPerSide: number;
}

export interface CustodianConfig {
  readonly gameId: CustodianGameId;
  readonly displayName: string;
  readonly boardGeometry: BoardGeometry;
  readonly boardSize: 8 | 9;

  // Movement
  readonly movement: {
    readonly slide: 'rook';
    /** Dai Hasami only. */
    readonly nonCapturingAdjacentJump: boolean;
  };

  // Capture mode toggles
  readonly capture: {
    readonly custodian: boolean;
    readonly intervention: boolean;
    readonly corner: boolean;
    readonly immobilization: boolean;
    /** Mak-yek line-capture interpretation knob (default 'single-piece'). */
    readonly lineCapture: 'single-piece' | 'whole-line';
    /** Rek immobilization-scope knob (default 'group'). */
    readonly immobilizationScope: 'piece' | 'group';
  };

  // Pieces
  readonly pieceTypes: readonly CustodianPieceKind[];
  readonly startingPosition: CustodianStartingPositionDescriptor;

  // Termination
  readonly winCondition: CustodianWinCondition;
  readonly stalemateIsLoss: true;
  readonly enableThreefoldDraw: true;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export class CustodianConfigInvariantError extends Error {
  readonly gameId: CustodianGameId;
  readonly invariant: string;
  constructor(gameId: CustodianGameId, invariant: string, message: string) {
    super(`[${gameId}] ${invariant}: ${message}`);
    this.name = 'CustodianConfigInvariantError';
    this.gameId = gameId;
    this.invariant = invariant;
  }
}

export function validateCustodianConfig(config: CustodianConfig): void {
  const { gameId, boardSize } = config;
  const dim = config.boardGeometry.dimensions.square;
  if (!dim) {
    throw new CustodianConfigInvariantError(
      gameId,
      'boardGeometry must be square',
      `expected a square geometry, got ${config.boardGeometry.kind}`,
    );
  }
  if (dim.size !== boardSize) {
    throw new CustodianConfigInvariantError(
      gameId,
      'boardGeometry size matches boardSize',
      `geometry is ${String(dim.size)}×${String(dim.size)}, config declares ${String(boardSize)}`,
    );
  }
  if (config.boardGeometry.playableMask !== undefined) {
    throw new CustodianConfigInvariantError(
      gameId,
      'boardGeometry must be full-board (no playableMask)',
      'custodian games use ALL squares; a dark-only mask is incompatible',
    );
  }
  if (config.pieceTypes.includes('king') && config.winCondition.kind !== 'capture-king') {
    // Soft warning rather than hard error — non-Rek games may include 'king'
    // in the vocabulary for future extension. Strict for now.
    throw new CustodianConfigInvariantError(
      gameId,
      "pieceTypes 'king' requires winCondition 'capture-king'",
      'kings only meaningfully exist as a target for capture-king',
    );
  }
}

// ---------------------------------------------------------------------------
// Derived game state
// ---------------------------------------------------------------------------

/**
 * Repetition table is encoded as a sorted [hashHex, count] tuple list so the
 * default ClassifiedGameState meta serializer (JSON-only) round-trips
 * cleanly. Mirrors Tasks 29.1/29.2/29.3.
 */
export interface CustodianMeta extends Record<string, unknown> {
  readonly turnTag: CustodianOwner;
  readonly halfMoveClock: number;
  readonly repetitionTable: readonly (readonly [string, number])[];
  /** Dai Hasami: cached per-side 5-in-a-row line set after each move; null if none. */
  readonly winningLines?: readonly (readonly number[])[] | null;
}

export type CustodianGameState = ClassifiedGameState & {
  readonly turn: CustodianOwner;
  readonly plyCount: number;
  readonly moveHistory: readonly CustodianMove[];
  readonly meta: CustodianMeta;
};

// ---------------------------------------------------------------------------
// Geometry singletons (per board size)
// ---------------------------------------------------------------------------

let GEOM_8_CACHE: BoardGeometry | null = null;
let GEOM_9_CACHE: BoardGeometry | null = null;

export function geometryFor(size: 8 | 9): BoardGeometry {
  if (size === 8) {
    if (!GEOM_8_CACHE) {
      GEOM_8_CACHE = squareGeometry({ size: 8, indexing: 'squares' });
    }
    return GEOM_8_CACHE;
  }
  if (!GEOM_9_CACHE) {
    GEOM_9_CACHE = squareGeometry({ size: 9, indexing: 'squares' });
  }
  return GEOM_9_CACHE;
}

// Re-export for downstream consumers.
export type { NodeId };
