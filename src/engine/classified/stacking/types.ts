/**
 * Stacking-draughts type vocabulary (Phase 4 Task 29.1).
 *
 * Pure data contract shared by Lasca (7×7) and Bashni (8×8). Both games consume
 * the same engine surface (`createStackingDraughtsRuleSet(config)`); every
 * per-variant divergence is encoded in `StackingDraughtsConfig`. The engine
 * never branches on `gameId` — only on the explicit configuration knobs.
 *
 * Array convention: **bottom-first**. `state.pieces[0]` is the deepest
 * prisoner; `state.pieces[stack.length - 1]` is the commander (top piece, the
 * one that determines the tower's owner and movement). This matches
 * `src/ui/piece/StackPiece.tsx`, which reads `stack[stack.length - 1]` as the
 * top layer. The Tier 2 playbook §3.2 nominally uses "index 0 = top"; we
 * align to the renderer per Task 29.1 plan §3 to avoid touching the shipped
 * UI surface. See `RULES_NOTES.md`.
 *
 * Authoritative references:
 *  - Documentation/Phase 4/Task 29/Task_29_1_StackingDraughtsRules_Implementation_Plan.md §4
 *  - Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md §3.2, §4.3, §4.4
 *  - src/ui/piece/StackPiece.tsx — bottom-first array convention.
 */

import type { BoardGeometry, NodeId } from '../../boardGeometry';
import type { ClassifiedGameState } from '../state';
import type { ClassifiedMove } from '../ClassifiedRuleSet';

// ---------------------------------------------------------------------------
// Owner + commander vocabulary
// ---------------------------------------------------------------------------

export type StackingOwner = 'white' | 'black';
export type StackingPieceKind = 'man' | 'king';

/** A single layer in a tower — owner + kind only. */
export interface StackingPiece {
  readonly owner: StackingOwner;
  readonly kind: StackingPieceKind;
}

/**
 * A tower at one square. Bottom-first ordering; commander = `pieces.at(-1)`.
 * Empty squares are absent from the `ClassifiedGameState.pieces` map (towers
 * are never length 0 — liberation that empties a square removes the entry).
 */
export interface StackState {
  readonly pieces: readonly StackingPiece[];
}

// ---------------------------------------------------------------------------
// Move shape — specialises ClassifiedMove for stacking draughts
// ---------------------------------------------------------------------------

export interface StackingMove extends ClassifiedMove {
  readonly kind: 'step' | 'capture';
  readonly from: string;
  readonly to: string;
  readonly piece: StackingPieceKind;
  readonly promotion?: 'king';
  /** For capture moves: ordered list of jumped squares (notation tokens). */
  readonly capture: readonly string[];
  readonly meta?: {
    readonly owner?: StackingOwner;
    /** Square notation where mid-capture promotion fired (Bashni only). */
    readonly promotionSquare?: string;
    /** Internal-only ordered NodeId path; preserved for replay determinism. */
    readonly path?: readonly number[];
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type StackingGameId = 'lasca' | 'bashni';

export interface StackingDraughtsConfig {
  readonly gameId: StackingGameId;
  readonly displayName: string;
  readonly boardGeometry: BoardGeometry;
  readonly boardSize: 7 | 8;
  readonly piecesPerSide: 11 | 12;
  /** Three back rows are filled per side in both games. */
  readonly startingRows: 3;
  readonly kingType: 'short' | 'flying';
  /** Lasca: false; Bashni: true (Russian rule). */
  readonly menCaptureBackward: boolean;
  /** Lasca: false; Bashni: true (man → king mid-chain, then continues). */
  readonly midCapturePromotion: boolean;
  /** Both games enforce mandatory capture. */
  readonly captureObligatory: true;
  /** Lasca: true; Bashni: false (player picks any legal chain). */
  readonly maximumCaptureMandatory: boolean;
  /** Promotion row indices for each side (row 0 = top of board). */
  readonly promotionRow: { readonly white: number; readonly black: number };
  /** Dark-square parity used by this game's geometry (0 for 7×7 Lasca, 1 for 8×8 Bashni). */
  readonly darkParity: 0 | 1;
}

// ---------------------------------------------------------------------------
// Derived game state
// ---------------------------------------------------------------------------

/**
 * Repetition table is encoded as a sorted [hashHex, count] tuple list so the
 * default ClassifiedGameState meta serializer (which only accepts JSON-safe
 * primitives, plain objects, and arrays — not `Map` or `bigint`) round-trips
 * cleanly. Hashes are encoded as lowercase 16-char hex strings to preserve
 * the full 64-bit Zobrist value without precision loss.
 */
export interface StackingMeta extends Record<string, unknown> {
  readonly stackingTurn: StackingOwner;
  /** Increments every move; reset to 0 on capture (diagnostic only). */
  readonly halfMoveClock: number;
  /** Sorted `[hashHex, count]` tuples — lossless 64-bit encoding. */
  readonly repetitionTable: readonly (readonly [string, number])[];
}

export type StackingGameState = ClassifiedGameState & {
  readonly turn: StackingOwner;
  readonly plyCount: number;
  readonly moveHistory: readonly StackingMove[];
  readonly meta: StackingMeta;
};

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export class StackingConfigInvariantError extends Error {
  readonly gameId: StackingGameId;
  readonly invariant: string;
  constructor(gameId: StackingGameId, invariant: string, message: string) {
    super(`[${gameId}] ${invariant}: ${message}`);
    this.name = 'StackingConfigInvariantError';
    this.gameId = gameId;
    this.invariant = invariant;
  }
}

export function validateStackingConfig(config: StackingDraughtsConfig): void {
  const { gameId, boardSize, piecesPerSide } = config;
  const dim = config.boardGeometry.dimensions.square;
  if (!dim) {
    throw new StackingConfigInvariantError(
      gameId,
      'boardGeometry must be square',
      `expected a square geometry, got ${config.boardGeometry.kind}`,
    );
  }
  if (dim.size !== boardSize) {
    throw new StackingConfigInvariantError(
      gameId,
      'boardGeometry size matches boardSize',
      `geometry is ${String(dim.size)}×${String(dim.size)}, config declares ${String(boardSize)}`,
    );
  }
  // Lasca: 11 pieces fill 3 rows on a 7×7 dark board (4+3+4 = 11).
  // Bashni: 12 pieces fill 3 rows on an 8×8 dark board (4+4+4 = 12).
  const expected = boardSize === 7 ? 11 : 12;
  if (piecesPerSide !== expected) {
    throw new StackingConfigInvariantError(
      gameId,
      'piecesPerSide matches boardSize',
      `expected ${String(expected)} pieces per side for ${String(boardSize)}×${String(boardSize)}, got ${String(piecesPerSide)}`,
    );
  }
  if (config.midCapturePromotion && config.kingType !== 'flying') {
    throw new StackingConfigInvariantError(
      gameId,
      'midCapturePromotion implies flying kings',
      'mid-capture promotion only makes sense when the promoted king can immediately exercise flying range',
    );
  }
}

// ---------------------------------------------------------------------------
// Predefined configs
// ---------------------------------------------------------------------------

import { lascaBoardGeometry, bashniBoardGeometry } from './boardGeometry';

let LASCA_CONFIG_CACHE: StackingDraughtsConfig | null = null;
let BASHNI_CONFIG_CACHE: StackingDraughtsConfig | null = null;

/** Lasca config (Emanuel Lasker, 1911) — 7×7, short kings, no backward men capture, max mandatory. */
export function createLascaConfig(): StackingDraughtsConfig {
  if (LASCA_CONFIG_CACHE) return LASCA_CONFIG_CACHE;
  const config: StackingDraughtsConfig = Object.freeze({
    gameId: 'lasca',
    displayName: 'Lasca',
    boardGeometry: lascaBoardGeometry(),
    boardSize: 7,
    piecesPerSide: 11,
    startingRows: 3,
    kingType: 'short',
    menCaptureBackward: false,
    midCapturePromotion: false,
    captureObligatory: true,
    maximumCaptureMandatory: true,
    promotionRow: Object.freeze({ white: 0, black: 6 }),
    darkParity: 0,
  });
  validateStackingConfig(config);
  LASCA_CONFIG_CACHE = config;
  return config;
}

/** Bashni config (Russian Stacking Draughts) — 8×8, flying kings, backward men capture, mid-chain promotion, no max-mandatory. */
export function createBashniConfig(): StackingDraughtsConfig {
  if (BASHNI_CONFIG_CACHE) return BASHNI_CONFIG_CACHE;
  const config: StackingDraughtsConfig = Object.freeze({
    gameId: 'bashni',
    displayName: 'Bashni',
    boardGeometry: bashniBoardGeometry(),
    boardSize: 8,
    piecesPerSide: 12,
    startingRows: 3,
    kingType: 'flying',
    menCaptureBackward: true,
    midCapturePromotion: true,
    captureObligatory: true,
    maximumCaptureMandatory: false,
    promotionRow: Object.freeze({ white: 0, black: 7 }),
    darkParity: 1,
  });
  validateStackingConfig(config);
  BASHNI_CONFIG_CACHE = config;
  return config;
}

export function createStackingConfig(
  gameId: StackingGameId,
): StackingDraughtsConfig {
  return gameId === 'lasca' ? createLascaConfig() : createBashniConfig();
}

// Re-export for downstream consumers.
export type { NodeId };
