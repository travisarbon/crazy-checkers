/**
 * Harzdame type vocabulary (Phase 4 Task 29.5).
 *
 * Pure data contract for Tier 2 #12 Harzdame (Harz Draughts, Benedikt
 * Rosenau, 2010). Harzdame is bespoke — its asymmetric men movement,
 * non-standard 11-square promotion area, capture-arrival promotion denial,
 * IMMEDIATE captured-piece removal (vs. Tier 2 siblings' deferred removal),
 * and senior-king flip mechanic don't fit any of the existing engine config
 * spaces.
 *
 * Authoritative references:
 *  - Documentation/Phase 4/Task 29/Task_29_5_HarzdameRules_Implementation_Plan.md §4
 *  - Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md §3.7, §4.2, §13.1
 *  - src/engine/classified/draughts/DraughtsConfig.ts — DraughtsDirection vocabulary.
 */

import type { BoardGeometry, NodeId } from '../../boardGeometry';
import { darkSquaresOnly, squareGeometry } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { ClassifiedMove } from '../ClassifiedRuleSet';
import type { DraughtsDirection } from '../draughts/DraughtsConfig';

// ---------------------------------------------------------------------------
// Owner + piece vocabulary
// ---------------------------------------------------------------------------

export type HarzdameOwner = 'white' | 'black';
export type HarzdamePieceKind = 'man' | 'king';

/**
 * Harzdame piece. Senior-king status is encoded via the existing
 * `ClassifiedPiece.promoted?: boolean` field on a `kind: 'king'` piece —
 * `promoted: true` ⇒ senior; absent or false ⇒ regular king or man.
 */
export interface HarzdamePiece extends ClassifiedPiece {
  readonly owner: HarzdameOwner;
  readonly kind: HarzdamePieceKind;
  readonly promoted?: boolean;
}

// ---------------------------------------------------------------------------
// Move shape — specialises ClassifiedMove
// ---------------------------------------------------------------------------

export type HarzdameMoveKind = 'move' | 'capture';

export interface HarzdameMove extends ClassifiedMove {
  readonly kind: HarzdameMoveKind;
  readonly from: string;
  readonly to: string;
  readonly piece: HarzdamePieceKind;
  /** Capture chain: ordered list of jumped square notation tokens. Empty for 'move'. */
  readonly capture: readonly string[];
  /**
   * 'king' iff a man promoted on terminal arrival (non-capture only);
   * 'senior' iff a king flipped senior post-capture-chain.
   */
  readonly promotion?: 'king' | 'senior';
  readonly meta?: {
    readonly owner?: HarzdameOwner;
    readonly fromNode?: number;
    readonly toNode?: number;
    /** Capture chain: ordered NodeId integers from `from` through every leg landing to `to`. */
    readonly path?: readonly number[];
    /** Per-leg directions for animation routing. */
    readonly directions?: readonly DraughtsDirection[];
    /** Senior-flip only: the maximum chain length available in the pre-move state. */
    readonly maxChainLength?: number;
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type HarzdameGameId = 'harzdame';

export interface HarzdameConfig {
  readonly gameId: HarzdameGameId;
  readonly displayName: string;
  readonly boardGeometry: BoardGeometry;
  readonly boardSize: 8;
  readonly piecesPerSide: 12;

  /**
   * Per-side man-movement directions (asymmetric — only 2 of the 4 diagonals).
   * White: NE (toward black's home) + SE (toward white's right).
   * Black: SW + NW (mirrored).
   */
  readonly menMovementDirections: {
    readonly white: readonly DraughtsDirection[];
    readonly black: readonly DraughtsDirection[];
  };
  /** Men capture in all 4 diagonal directions by short leap. */
  readonly menCaptureDirections: readonly DraughtsDirection[];
  /** Kings move flying in all 4 diagonal directions. */
  readonly kingMovementDirections: readonly DraughtsDirection[];
  /** Kings capture flying in all 4 diagonal directions. */
  readonly kingCaptureDirections: readonly DraughtsDirection[];
  readonly kingType: 'flying';

  /** Per playbook §4.2: captured pieces removed IMMEDIATELY after each leg (not chain-end). */
  readonly capturedPieceRemoval: 'immediate';
  /** Per playbook §4.2: capture is obligatory. */
  readonly captureObligatory: true;
  /** §1.4: default false (Phase 4 plan + 29.G.2); flippable to true (playbook §4.2). */
  readonly maximumCaptureMandatory: boolean;
  /** Harzdame: no mid-chain promotion (capture-arrival denial). */
  readonly midChainPromotion: false;

  /** Promotion area — non-standard 11 NodeIds per side (PDN squares). */
  readonly promotionArea: {
    readonly white: ReadonlySet<NodeId>;
    readonly black: ReadonlySet<NodeId>;
  };
  /** Promotion fires ONLY on non-capturing arrival. */
  readonly promotionDeniedOnCaptureArrival: true;

  /** Senior-king mechanic (§1.2). */
  readonly seniorKing: {
    readonly enabled: boolean;
    /** Default 'max-chain': king completing the position-max-length chain becomes senior. */
    readonly trigger: 'max-chain';
  };

  /** Stalemate is a loss for the stalemated side. */
  readonly stalemateIsLoss: true;
  /** Threefold repetition is a draw. */
  readonly enableThreefoldDraw: true;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export class HarzdameConfigInvariantError extends Error {
  readonly invariant: string;
  constructor(invariant: string, message: string) {
    super(`[harzdame] ${invariant}: ${message}`);
    this.name = 'HarzdameConfigInvariantError';
    this.invariant = invariant;
  }
}

export function validateHarzdameConfig(config: HarzdameConfig): void {
  const dim = config.boardGeometry.dimensions.square;
  if (!dim) {
    throw new HarzdameConfigInvariantError(
      'boardGeometry must be square',
      `expected a square geometry, got ${config.boardGeometry.kind}`,
    );
  }
  if (dim.size !== 8) {
    throw new HarzdameConfigInvariantError(
      'boardGeometry size matches boardSize',
      `geometry is ${String(dim.size)}×${String(dim.size)}, config declares 8`,
    );
  }
  if (config.boardGeometry.playableMask === undefined) {
    throw new HarzdameConfigInvariantError(
      'boardGeometry must use dark-squares-only mask',
      'Harzdame plays on the 32 dark squares; full-board geometry is incompatible',
    );
  }
  if (config.promotionArea.white.size !== 11) {
    throw new HarzdameConfigInvariantError(
      'promotionArea.white has 11 squares',
      `expected 11, got ${String(config.promotionArea.white.size)}`,
    );
  }
  if (config.promotionArea.black.size !== 11) {
    throw new HarzdameConfigInvariantError(
      'promotionArea.black has 11 squares',
      `expected 11, got ${String(config.promotionArea.black.size)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Derived game state
// ---------------------------------------------------------------------------

/**
 * Repetition table is encoded as a sorted [hashHex, count] tuple list so the
 * default ClassifiedGameState meta serializer (JSON-only) round-trips cleanly.
 *
 * `maxCaptureChainLength` is a per-turn cache populated by `getLegalMoves`
 * and consumed by `applyMove` to decide senior-king flips without
 * re-enumerating moves. Optional — `applyMove` recomputes if absent.
 *
 * `seniorKings` is a sorted NodeId list of pieces with `promoted: true`,
 * exposed for the AI evaluator's fast-path lookups.
 */
export interface HarzdameMeta extends Record<string, unknown> {
  readonly turnTag: HarzdameOwner;
  readonly halfMoveClock: number;
  readonly repetitionTable: readonly (readonly [string, number])[];
  readonly maxCaptureChainLength?: number;
  readonly seniorKings?: readonly number[];
}

export type HarzdameGameState = ClassifiedGameState & {
  readonly turn: HarzdameOwner;
  readonly plyCount: number;
  readonly moveHistory: readonly HarzdameMove[];
  readonly meta: HarzdameMeta;
};

// ---------------------------------------------------------------------------
// Geometry singleton + config factory
// ---------------------------------------------------------------------------

let GEOM_CACHE: BoardGeometry | null = null;
function harzdameGeometry(): BoardGeometry {
  if (GEOM_CACHE) return GEOM_CACHE;
  // 'pdn-8' variant enables PDN numbering 1..32 for the dark squares,
  // matching American Rules + every Tier 1 8×8 draughts variant.
  GEOM_CACHE = squareGeometry({
    size: 8,
    indexing: 'squares',
    playableMask: darkSquaresOnly,
    variant: 'pdn-8',
  });
  return GEOM_CACHE;
}

/**
 * Default white promotion area per Task 29.5 plan §1.3 / §19. PLACEHOLDER —
 * source-validation by Task 29.G.2-A may revise. NodeIds are computed from
 * PDN numbers via the geometry's `parseNotation`.
 */
function buildDefaultPromotionAreas(geometry: BoardGeometry): {
  readonly white: ReadonlySet<NodeId>;
  readonly black: ReadonlySet<NodeId>;
} {
  const parse = (pdn: number): NodeId => {
    const node = geometry.coordinateLabels.parseNotation(String(pdn));
    if (node === null) {
      throw new Error(`[harzdame] cannot parse PDN ${String(pdn)} into a NodeId`);
    }
    return node;
  };
  const white = new Set<NodeId>(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => parse(n)),
  );
  const black = new Set<NodeId>(
    [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32].map((n) => parse(n)),
  );
  return { white, black };
}

let CONFIG_CACHE: HarzdameConfig | null = null;

export function createHarzdameConfig(): HarzdameConfig {
  if (CONFIG_CACHE) return CONFIG_CACHE;
  const geometry = harzdameGeometry();
  const promotionArea = buildDefaultPromotionAreas(geometry);
  const config: HarzdameConfig = Object.freeze({
    gameId: 'harzdame',
    displayName: 'Harzdame',
    boardGeometry: geometry,
    boardSize: 8,
    piecesPerSide: 12,
    menMovementDirections: Object.freeze({
      white: Object.freeze(['ne', 'se'] as const),
      black: Object.freeze(['sw', 'nw'] as const),
    }),
    menCaptureDirections: Object.freeze(['nw', 'ne', 'sw', 'se'] as const),
    kingMovementDirections: Object.freeze(['nw', 'ne', 'sw', 'se'] as const),
    kingCaptureDirections: Object.freeze(['nw', 'ne', 'sw', 'se'] as const),
    kingType: 'flying',
    capturedPieceRemoval: 'immediate',
    captureObligatory: true,
    maximumCaptureMandatory: false,
    midChainPromotion: false,
    promotionArea: Object.freeze({
      white: promotionArea.white,
      black: promotionArea.black,
    }),
    promotionDeniedOnCaptureArrival: true,
    seniorKing: Object.freeze({ enabled: true, trigger: 'max-chain' as const }),
    stalemateIsLoss: true,
    enableThreefoldDraw: true,
  });
  validateHarzdameConfig(config);
  CONFIG_CACHE = config;
  return config;
}

// Re-export for downstream consumers.
export type { NodeId };
