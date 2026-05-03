/**
 * Alquerque-engine type vocabulary (Phase 4 Task 29.3).
 *
 * Pure data contract for Tier 2 game #15 Zamma. The engine is intentionally
 * generic so Expansion Tier 9 #19 Bagh-Chal (5×5 alquerque-like topology)
 * and Wave 3 Morabaraba (which shares the alternating-diagonal sub-graph
 * logic) can later instantiate the engine or its sub-modules. The engine
 * never branches on `gameId` — every per-variant divergence travels through
 * configuration knobs.
 *
 * Authoritative references:
 *  - Documentation/Phase 4/Task 29/Task_29_3_AlquerqueGridEngine_Implementation_Plan.md §4
 *  - Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md §3.5, §4.5, §5.2
 *  - src/engine/classified/draughts/* — Tier 1 idioms (immutable state, recursive capture chain).
 */

import type { BoardGeometry, NodeId } from '../../boardGeometry';
import { alquerqueGeometry } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { ClassifiedMove } from '../ClassifiedRuleSet';

// ---------------------------------------------------------------------------
// Owner + commander vocabulary
// ---------------------------------------------------------------------------

export type AlquerqueOwner = 'white' | 'black';
export type AlquerquePieceKind = 'man' | 'mullah';

/** Alquerque-engine piece — narrow alias for the Phase 4 ClassifiedPiece shape. */
export interface AlquerquePiece extends ClassifiedPiece {
  readonly owner: AlquerqueOwner;
  readonly kind: AlquerquePieceKind;
}

// ---------------------------------------------------------------------------
// Direction vocabulary
// ---------------------------------------------------------------------------

/** Compass directions — orthogonal (N/S/E/W) plus diagonal (NE/NW/SE/SW). */
export type AlquerqueDirection = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export const ORTHOGONAL_ALQ_DIRS: readonly AlquerqueDirection[] = Object.freeze([
  'N',
  'S',
  'E',
  'W',
] as const);

export const DIAGONAL_ALQ_DIRS: readonly AlquerqueDirection[] = Object.freeze([
  'NE',
  'NW',
  'SE',
  'SW',
] as const);

export const ALL_ALQ_DIRS: readonly AlquerqueDirection[] = Object.freeze([
  ...ORTHOGONAL_ALQ_DIRS,
  ...DIAGONAL_ALQ_DIRS,
] as const);

// ---------------------------------------------------------------------------
// Move shape — specialises ClassifiedMove
// ---------------------------------------------------------------------------

export type AlquerqueMoveKind = 'step' | 'capture';

export interface AlquerqueMove extends ClassifiedMove {
  readonly kind: AlquerqueMoveKind;
  /** Origin intersection label. */
  readonly from: string;
  /** Final destination intersection label (last leg of capture chain for 'capture'). */
  readonly to: string;
  readonly piece: AlquerquePieceKind;
  /** Capture only: ordered list of jumped intersection labels (chain order). */
  readonly capture: readonly string[];
  /** Promotion fires when a man arrives on the opponent's back row. */
  readonly promotion?: 'mullah';
  readonly meta?: {
    readonly owner?: AlquerqueOwner;
    /** Capture chain: ordered NodeId integers from `from` through every leg landing to `to`. */
    readonly path?: readonly number[];
    /** Per-leg direction tags, one entry per capture leg. */
    readonly directions?: readonly AlquerqueDirection[];
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type AlquerqueGameId = 'zamma';

export interface AlquerqueConfig {
  readonly gameId: AlquerqueGameId;
  readonly displayName: string;
  readonly boardGeometry: BoardGeometry;
  readonly boardSize: 9;
  readonly piecesPerSide: 40;
  /** Per playbook §4.5: men move forward only along incident lines (white: N/NE/NW; black mirrored to S/SE/SW). */
  readonly menMovementDirections: readonly AlquerqueDirection[];
  /** Per playbook §4.5 default: men capture forward only. Flippable by config. */
  readonly menCaptureDirections: readonly AlquerqueDirection[];
  /** Mullahs move along incident lines in any direction. */
  readonly mullahMovementDirections: readonly AlquerqueDirection[];
  readonly mullahCaptureDirections: readonly AlquerqueDirection[];
  /**
   * Default false: short-range Mullahs (single-step). Flippable for future
   * authoritative sources that mandate flying-Mullah variants.
   */
  readonly mullahFlying: boolean;
  /** Captured pieces are removed only after the entire multi-jump chain commits. */
  readonly capturesRemovedAt: 'chain-end';
  /** Capture is obligatory per playbook §4.5. */
  readonly captureObligatory: true;
  /** Default false for Zamma per playbook silence; flippable. */
  readonly maximumCaptureMandatory: boolean;
  /** Default false: promotion fires only at chain terminal landing. */
  readonly midChainPromotion: boolean;
  /** Diagonal-line pattern for the underlying alquerque adjacency. */
  readonly diagonalPattern: 'alternating' | 'full';
  /** Promotion row indices for each side (row 0 = top, row 8 = bottom for Zamma). */
  readonly promotionRow: { readonly white: 0; readonly black: 8 };
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export class AlquerqueConfigInvariantError extends Error {
  readonly gameId: AlquerqueGameId;
  readonly invariant: string;
  constructor(gameId: AlquerqueGameId, invariant: string, message: string) {
    super(`[${gameId}] ${invariant}: ${message}`);
    this.name = 'AlquerqueConfigInvariantError';
    this.gameId = gameId;
    this.invariant = invariant;
  }
}

export function validateAlquerqueConfig(config: AlquerqueConfig): void {
  const { gameId, boardSize } = config;
  const dim = config.boardGeometry.dimensions.alquerque;
  if (!dim) {
    throw new AlquerqueConfigInvariantError(
      gameId,
      'boardGeometry must be alquerque',
      `expected an alquerque geometry, got ${config.boardGeometry.kind}`,
    );
  }
  if (dim.size !== boardSize) {
    throw new AlquerqueConfigInvariantError(
      gameId,
      'boardGeometry size matches boardSize',
      `geometry is ${String(dim.size)}×${String(dim.size)}, config declares ${String(boardSize)}`,
    );
  }
  if (dim.diagonalPattern !== config.diagonalPattern) {
    throw new AlquerqueConfigInvariantError(
      gameId,
      'boardGeometry diagonalPattern matches config diagonalPattern',
      `geometry has ${dim.diagonalPattern}; config declares ${config.diagonalPattern}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Derived game state
// ---------------------------------------------------------------------------

/**
 * Repetition table is encoded as a sorted [hashHex, count] tuple list so the
 * default ClassifiedGameState meta serializer (which only accepts JSON-safe
 * primitives) round-trips cleanly. Mirrors Tasks 29.1 and 29.2.
 */
export interface AlquerqueMeta extends Record<string, unknown> {
  readonly turnTag: AlquerqueOwner;
  readonly halfMoveClock: number;
  readonly repetitionTable: readonly (readonly [string, number])[];
}

export type AlquerqueGameState = ClassifiedGameState & {
  readonly turn: AlquerqueOwner;
  readonly plyCount: number;
  readonly moveHistory: readonly AlquerqueMove[];
  readonly meta: AlquerqueMeta;
};

// ---------------------------------------------------------------------------
// Predefined configs
// ---------------------------------------------------------------------------

let ZAMMA_GEOM_CACHE: BoardGeometry | null = null;
function zammaGeometry(): BoardGeometry {
  if (ZAMMA_GEOM_CACHE) return ZAMMA_GEOM_CACHE;
  ZAMMA_GEOM_CACHE = alquerqueGeometry({ size: 9, diagonalPattern: 'alternating' });
  return ZAMMA_GEOM_CACHE;
}

let ZAMMA_CONFIG_CACHE: AlquerqueConfig | null = null;

/**
 * Zamma config — 9×9 alquerque, 40 men per side trapezoid (white rows 0–3
 * + row 4 cols 0–3; black mirrored), forward-only man movement and capture,
 * short-range Mullahs, terminal-only promotion, no max-mandatory pruning.
 */
export function createZammaConfig(): AlquerqueConfig {
  if (ZAMMA_CONFIG_CACHE) return ZAMMA_CONFIG_CACHE;
  const config: AlquerqueConfig = Object.freeze({
    gameId: 'zamma',
    displayName: 'Zamma',
    boardGeometry: zammaGeometry(),
    boardSize: 9,
    piecesPerSide: 40,
    menMovementDirections: Object.freeze(['N', 'NE', 'NW'] as const),
    menCaptureDirections: Object.freeze(['N', 'NE', 'NW'] as const),
    mullahMovementDirections: Object.freeze([...ALL_ALQ_DIRS]),
    mullahCaptureDirections: Object.freeze([...ALL_ALQ_DIRS]),
    mullahFlying: false,
    capturesRemovedAt: 'chain-end',
    captureObligatory: true,
    maximumCaptureMandatory: false,
    midChainPromotion: false,
    diagonalPattern: 'alternating',
    promotionRow: Object.freeze({ white: 0, black: 8 }),
  });
  validateAlquerqueConfig(config);
  ZAMMA_CONFIG_CACHE = config;
  return config;
}

// Re-export for downstream consumers.
export type { NodeId };
