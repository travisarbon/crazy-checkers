/**
 * Cheskers type vocabulary (Phase 4 Task 29.6).
 *
 * Pure data contract for Tier 2 #49 Cheskers (Solomon Golomb, 1948 — chess
 * pieces in a checkers world). Cheskers's defining feature is its **dual
 * capture-obligation regime**: Pawns + Kings use draughts-style mandatory
 * jump captures; Bishops + Camels use chess-style optional displacement
 * captures.
 *
 * Authoritative references:
 *  - Documentation/Phase 4/Task 29/Task_29_6_CheskersRules_Implementation_Plan.md §4
 *  - Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md §3.6, §4.10, §13.1
 *  - src/engine/classified/draughts/DraughtsConfig.ts — DraughtsDirection vocabulary.
 */

import type { BoardGeometry } from '../../boardGeometry';
import { darkSquaresOnly, squareGeometry } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { ClassifiedMove } from '../ClassifiedRuleSet';
import type { DraughtsDirection } from '../draughts/DraughtsConfig';

// ---------------------------------------------------------------------------
// Owner + piece vocabulary
// ---------------------------------------------------------------------------

export type CheskersOwner = 'white' | 'black';
export type CheskersPieceKind = 'pawn' | 'king' | 'bishop' | 'camel';

/** Cheskers piece — narrow alias for the Phase 4 ClassifiedPiece shape. */
export interface CheskersPiece extends ClassifiedPiece {
  readonly owner: CheskersOwner;
  readonly kind: CheskersPieceKind;
}

// ---------------------------------------------------------------------------
// Move shape — closed kinds for animation + ARIA + Cogitate replay dispatch.
// ---------------------------------------------------------------------------

export type CheskersMoveKind =
  | 'pawn-step'
  | 'king-step'
  | 'pawn-jump'
  | 'king-jump'
  | 'bishop-slide'
  | 'bishop-displace'
  | 'camel-leap'
  | 'camel-displace';

export interface CheskersMove extends ClassifiedMove {
  readonly kind: CheskersMoveKind;
  readonly from: string;
  readonly to: string;
  readonly piece: CheskersPieceKind;
  /** Capture chain (pawn/king) or single-piece capture (bishop/camel); empty for non-capturing. */
  readonly capture: readonly string[];
  /** Promotion target — only emitted when a Pawn arrives at the back rank. */
  readonly promotion?: 'king' | 'bishop' | 'camel';
  readonly meta?: {
    readonly owner?: CheskersOwner;
    readonly fromNode?: number;
    readonly toNode?: number;
    /** Capture chain (pawn/king): ordered NodeId integers from `from` through every leg landing. */
    readonly path?: readonly number[];
    /** Pawn/king diagonal direction per leg, for animation routing. */
    readonly directions?: readonly DraughtsDirection[];
    /** Camel leap: the (dr, dc) offset used (one of 8 possibilities). */
    readonly camelOffset?: readonly [number, number];
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type CheskersGameId = 'cheskers';

export interface CheskersConfig {
  readonly gameId: CheskersGameId;
  readonly displayName: string;
  readonly boardGeometry: BoardGeometry;
  readonly boardSize: 8;
  /** 12 per side: 8 Pawns + 2 Kings + 1 Bishop + 1 Camel. */
  readonly piecesPerSide: 12;
  /** §1.5 — black moves first per playbook §4.10. */
  readonly startingTurn: CheskersOwner;

  // Movement
  readonly pawnMovementDirections: {
    readonly white: readonly DraughtsDirection[]; // ['nw', 'ne'] — diagonally forward only
    readonly black: readonly DraughtsDirection[]; // ['sw', 'se']
  };
  readonly pawnCaptureDirections: {
    readonly white: readonly DraughtsDirection[]; // pawn captures forward only
    readonly black: readonly DraughtsDirection[];
  };
  /** King moves and captures in all 4 diagonal directions. */
  readonly kingDirections: readonly DraughtsDirection[];

  // Bishop
  readonly bishopType: 'chess-flying';

  // Camel — (3, 1) leaper (or knight per §1.1 knob)
  readonly camelLeaper: '(3,1)' | '(2,1)';

  // Capture obligation (dual regime)
  readonly captureObligationByKind: {
    readonly pawn: 'mandatory';
    readonly king: 'mandatory';
    readonly bishop: 'optional';
    readonly camel: 'optional';
  };
  /** When true, prune pawn/king chains to the longest available; default false (American-style). */
  readonly maximumCaptureMandatory: boolean;
  readonly midChainPromotion: boolean;
  readonly capturedPieceRemoval: 'immediate' | 'end-of-sequence';

  // Promotion
  readonly pawnPromotion: {
    readonly target: 'king' | 'choice';
    readonly choices: readonly CheskersPieceKind[];
  };
  /** Cheskers: pawns DO promote on capture-arrival (unlike Harzdame). */
  readonly promotionDeniedOnCaptureArrival: false;

  // Termination
  readonly winCondition:
    | { readonly kind: 'eliminate-all-kings' }
    | { readonly kind: 'eliminate-original-kings' };
  readonly stalemateIsLoss: true;
  readonly enableThreefoldDraw: true;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export class CheskersConfigInvariantError extends Error {
  readonly invariant: string;
  constructor(invariant: string, message: string) {
    super(`[cheskers] ${invariant}: ${message}`);
    this.name = 'CheskersConfigInvariantError';
    this.invariant = invariant;
  }
}

export function validateCheskersConfig(config: CheskersConfig): void {
  const dim = config.boardGeometry.dimensions.square;
  if (!dim) {
    throw new CheskersConfigInvariantError(
      'boardGeometry must be square',
      `expected a square geometry, got ${config.boardGeometry.kind}`,
    );
  }
  if (dim.size !== 8) {
    throw new CheskersConfigInvariantError(
      'boardGeometry size matches boardSize',
      `geometry is ${String(dim.size)}×${String(dim.size)}, config declares 8`,
    );
  }
  if (config.boardGeometry.playableMask === undefined && config.camelLeaper === '(3,1)') {
    throw new CheskersConfigInvariantError(
      'boardGeometry must use dark-squares-only mask for (3,1) Camel',
      'Cheskers plays on the 32 dark squares; full-board geometry is incompatible with (3,1) leaper',
    );
  }
  if (config.pawnPromotion.target === 'choice' && config.pawnPromotion.choices.length === 0) {
    throw new CheskersConfigInvariantError(
      'pawnPromotion.choices must be non-empty when target is "choice"',
      `got ${String(config.pawnPromotion.choices.length)} choices`,
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
 * `kingCount` is a per-side cache populated by `buildStartingState` and
 * `applyCheskersMove` and consumed by `gameOver`'s eliminate-all-kings check.
 */
export interface CheskersMeta extends Record<string, unknown> {
  readonly turnTag: CheskersOwner;
  readonly halfMoveClock: number;
  readonly repetitionTable: readonly (readonly [string, number])[];
  readonly kingCount?: { readonly white: number; readonly black: number };
}

export type CheskersGameState = ClassifiedGameState & {
  readonly turn: CheskersOwner;
  readonly plyCount: number;
  readonly moveHistory: readonly CheskersMove[];
  readonly meta: CheskersMeta;
};

// ---------------------------------------------------------------------------
// Geometry singleton + config factory
// ---------------------------------------------------------------------------

let GEOM_CACHE: BoardGeometry | null = null;
function cheskersGeometry(): BoardGeometry {
  if (GEOM_CACHE) return GEOM_CACHE;
  // 'pdn-8' variant enables PDN numbering 1..32 for the dark squares,
  // matching American Rules + every Tier 1 8x8 draughts variant + Task 29.5.
  GEOM_CACHE = squareGeometry({
    size: 8,
    indexing: 'squares',
    playableMask: darkSquaresOnly,
    variant: 'pdn-8',
  });
  return GEOM_CACHE;
}

let CONFIG_CACHE: CheskersConfig | null = null;

export function createCheskersConfig(): CheskersConfig {
  if (CONFIG_CACHE) return CONFIG_CACHE;
  const geometry = cheskersGeometry();
  const config: CheskersConfig = Object.freeze({
    gameId: 'cheskers',
    displayName: 'Cheskers',
    boardGeometry: geometry,
    boardSize: 8,
    piecesPerSide: 12,
    startingTurn: 'black' as const,
    pawnMovementDirections: Object.freeze({
      white: Object.freeze(['nw', 'ne'] as const),
      black: Object.freeze(['sw', 'se'] as const),
    }),
    pawnCaptureDirections: Object.freeze({
      white: Object.freeze(['nw', 'ne'] as const),
      black: Object.freeze(['sw', 'se'] as const),
    }),
    kingDirections: Object.freeze(['nw', 'ne', 'sw', 'se'] as const),
    bishopType: 'chess-flying',
    camelLeaper: '(3,1)',
    captureObligationByKind: Object.freeze({
      pawn: 'mandatory' as const,
      king: 'mandatory' as const,
      bishop: 'optional' as const,
      camel: 'optional' as const,
    }),
    maximumCaptureMandatory: false,
    midChainPromotion: false,
    capturedPieceRemoval: 'immediate' as const,
    pawnPromotion: Object.freeze({
      target: 'king' as const,
      choices: Object.freeze(['king'] as const),
    }),
    promotionDeniedOnCaptureArrival: false,
    winCondition: Object.freeze({ kind: 'eliminate-all-kings' as const }),
    stalemateIsLoss: true,
    enableThreefoldDraw: true,
  });
  validateCheskersConfig(config);
  CONFIG_CACHE = config;
  return config;
}

// Re-export for downstream consumers.
export type { NodeId } from '../../boardGeometry';
