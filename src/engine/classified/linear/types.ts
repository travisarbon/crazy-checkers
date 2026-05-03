/**
 * Linear-movement engine type vocabulary (Phase 4 Task 29.2).
 *
 * Pure data contract for Tier 2 game #11 Dameo. The engine is intentionally
 * generic so Tier 5 #47 Epaminondas and Expansion Tier 9 Bushka can later
 * instantiate it with their own `LinearMovementConfig`. The engine never
 * branches on `gameId` — every per-variant divergence travels through
 * configuration knobs.
 *
 * Authoritative references:
 *  - Documentation/Phase 4/Task 29/Task_29_2_LinearMovementEngine_Implementation_Plan.md §4
 *  - Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md §3.4, §4.1, §15.2 (Open Question 7)
 *  - src/engine/classified/draughts/* — Tier 1 idioms (immutable state, recursive capture chain).
 */

import type { BoardGeometry, NodeId } from '../../boardGeometry';
import { squareGeometry } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { ClassifiedMove } from '../ClassifiedRuleSet';

// ---------------------------------------------------------------------------
// Owner + commander vocabulary
// ---------------------------------------------------------------------------

export type LinearOwner = 'white' | 'black';
export type LinearPieceKind = 'man' | 'king';

/** Linear-movement piece — narrow alias for the Phase 4 ClassifiedPiece shape. */
export interface LinearPiece extends ClassifiedPiece {
  readonly owner: LinearOwner;
  readonly kind: LinearPieceKind;
}

// ---------------------------------------------------------------------------
// Direction vocabulary
// ---------------------------------------------------------------------------

/** Compass directions — orthogonal (N/S/E/W) plus diagonal (NE/NW/SE/SW). */
export type LinearDirection = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export const ORTHOGONAL_DIRS: readonly LinearDirection[] = Object.freeze([
  'N',
  'S',
  'E',
  'W',
] as const);

export const DIAGONAL_DIRS: readonly LinearDirection[] = Object.freeze([
  'NE',
  'NW',
  'SE',
  'SW',
] as const);

export const ALL_DIRS: readonly LinearDirection[] = Object.freeze([
  ...ORTHOGONAL_DIRS,
  ...DIAGONAL_DIRS,
] as const);

// ---------------------------------------------------------------------------
// Move shape — specialises ClassifiedMove
// ---------------------------------------------------------------------------

export type LinearMoveKind = 'step' | 'group-advance' | 'capture';

export interface LinearMove extends ClassifiedMove {
  readonly kind: LinearMoveKind;
  /** For 'step'/'capture': single-piece origin. For 'group-advance': rear-most member. */
  readonly from: string;
  /** For 'step'/'capture': landing square. For 'group-advance': new head square. */
  readonly to: string;
  readonly piece: LinearPieceKind;
  readonly direction: LinearDirection;
  /** Group-advance only: ordered list (rear → head) of phalanx member labels. */
  readonly groupMembers?: readonly string[];
  /** Capture only: ordered list of jumped square labels (chain order). */
  readonly capture: readonly string[];
  /** Promotion = man arrived at the king row. */
  readonly promotion?: 'king';
  readonly meta?: {
    readonly owner?: LinearOwner;
    /** Capture chain: ordered list of NodeId integers from `from` through every leg landing to `to`. */
    readonly path?: readonly number[];
    /** Group-advance: NodeId integers for the member squares (rear → head). */
    readonly groupMemberNodes?: readonly number[];
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type LinearGameId = 'dameo';

export interface LinearMovementConfig {
  readonly gameId: LinearGameId;
  readonly displayName: string;
  readonly boardGeometry: BoardGeometry;
  readonly boardSize: 8;
  readonly piecesPerSide: 18;
  /** Per playbook §3.4: men move N + NE + NW + E + W (forward-only + sideways). */
  readonly menMovementDirections: readonly LinearDirection[];
  /** Per playbook §3.4: men capture orthogonally only (N/S/E/W) — NOT diagonally. */
  readonly menCaptureDirections: readonly LinearDirection[];
  /** Per playbook §3.4: kings flying queen — all 8 directions for both move + capture. */
  readonly kingMovementDirections: readonly LinearDirection[];
  readonly kingCaptureDirections: readonly LinearDirection[];
  readonly kingType: 'flying';
  /** Per Open Question 7: rank, file, AND diagonal phalanx lines are legal in Dameo. */
  readonly groupAdvanceAxes: readonly ('rank' | 'file' | 'diagonal')[];
  /** Forward-only — no sideways/backward phalanx slides. */
  readonly groupAdvanceForwardOnly: true;
  /** Captured pieces are removed only after the entire multi-jump chain commits. */
  readonly capturesRemovedAt: 'chain-end';
  readonly captureObligatory: true;
  readonly maximumCaptureMandatory: true;
  /** Promotion row indices for each side (row 0 = top of board, row 7 = bottom). */
  readonly promotionRow: { readonly white: 0; readonly black: 7 };
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export class LinearConfigInvariantError extends Error {
  readonly gameId: LinearGameId;
  readonly invariant: string;
  constructor(gameId: LinearGameId, invariant: string, message: string) {
    super(`[${gameId}] ${invariant}: ${message}`);
    this.name = 'LinearConfigInvariantError';
    this.gameId = gameId;
    this.invariant = invariant;
  }
}

export function validateLinearConfig(config: LinearMovementConfig): void {
  const { gameId, boardSize, piecesPerSide } = config;
  const dim = config.boardGeometry.dimensions.square;
  if (!dim) {
    throw new LinearConfigInvariantError(
      gameId,
      'boardGeometry must be square',
      `expected a square geometry, got ${config.boardGeometry.kind}`,
    );
  }
  if (dim.size !== boardSize) {
    throw new LinearConfigInvariantError(
      gameId,
      'boardGeometry size matches boardSize',
      `geometry is ${String(dim.size)}×${String(dim.size)}, config declares ${String(boardSize)}`,
    );
  }
  if (config.boardGeometry.playableMask !== undefined) {
    throw new LinearConfigInvariantError(
      gameId,
      'boardGeometry must be full-square (no playableMask)',
      'Dameo uses ALL 64 squares per playbook §4.1; a dark-only mask is incompatible',
    );
  }
  // piecesPerSide is type-locked to 18 and captureObligatory to true via
  // the closed `LinearMovementConfig` type literals; no runtime check needed.
  void piecesPerSide;
}

// ---------------------------------------------------------------------------
// Derived game state
// ---------------------------------------------------------------------------

/**
 * Repetition table is encoded as a sorted [hashHex, count] tuple list so the
 * default ClassifiedGameState meta serializer (which only accepts JSON-safe
 * primitives) round-trips cleanly. Mirrors Task 29.1 stacking convention.
 */
export interface LinearMeta extends Record<string, unknown> {
  readonly turnTag: LinearOwner;
  readonly halfMoveClock: number;
  readonly repetitionTable: readonly (readonly [string, number])[];
}

export type LinearGameState = ClassifiedGameState & {
  readonly turn: LinearOwner;
  readonly plyCount: number;
  readonly moveHistory: readonly LinearMove[];
  readonly meta: LinearMeta;
};

// ---------------------------------------------------------------------------
// Predefined configs
// ---------------------------------------------------------------------------

let DAMEO_GEOM_CACHE: BoardGeometry | null = null;
function dameoGeometry(): BoardGeometry {
  if (DAMEO_GEOM_CACHE) return DAMEO_GEOM_CACHE;
  DAMEO_GEOM_CACHE = squareGeometry({ size: 8, indexing: 'squares' });
  return DAMEO_GEOM_CACHE;
}

let DAMEO_CONFIG_CACHE: LinearMovementConfig | null = null;

/** Dameo config (Christian Freeling, 2000) — 8×8 full board, 18 men trapezoid, men forward+sideways, men capture orthogonally, kings fly all 8. */
export function createDameoConfig(): LinearMovementConfig {
  if (DAMEO_CONFIG_CACHE) return DAMEO_CONFIG_CACHE;
  const config: LinearMovementConfig = Object.freeze({
    gameId: 'dameo',
    displayName: 'Dameo',
    boardGeometry: dameoGeometry(),
    boardSize: 8,
    piecesPerSide: 18,
    menMovementDirections: Object.freeze(['N', 'NE', 'NW', 'E', 'W'] as const),
    menCaptureDirections: Object.freeze([...ORTHOGONAL_DIRS]),
    kingMovementDirections: Object.freeze([...ALL_DIRS]),
    kingCaptureDirections: Object.freeze([...ALL_DIRS]),
    kingType: 'flying',
    groupAdvanceAxes: Object.freeze(['rank', 'file', 'diagonal'] as const),
    groupAdvanceForwardOnly: true,
    capturesRemovedAt: 'chain-end',
    captureObligatory: true,
    maximumCaptureMandatory: true,
    promotionRow: Object.freeze({ white: 0, black: 7 }),
  });
  validateLinearConfig(config);
  DAMEO_CONFIG_CACHE = config;
  return config;
}

// Re-export for downstream consumers.
export type { NodeId };
