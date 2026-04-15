/**
 * ClassifiedGameState — Phase 4 generic game-state shape consumed by every
 * BoardRenderer in the Task 27.3 registry and every ClassifiedRuleSet
 * authored against Task 27.4.
 *
 * Task 27.3 shipped the minimal {pieces, turn?, meta?} shape for renderer
 * consumption. Task 27.4 extends this additively with rule-engine metadata:
 * - turn ordering + ply count + move history (mandatory on active states).
 * - optional `hands` (present iff the owning rule set has `hasPiecesInHand`).
 * - optional `placementPhase` (present iff `hasPlacementPhase`).
 * - optional `roles` (present iff `isAsymmetric`).
 *
 * Every new field is optional at the type level so Task 27.3 callers that
 * construct `{ pieces: ... }` keep compiling. The registration validator
 * enforces presence-per-capability at the rule-set boundary.
 */

import type { NodeId } from '../boardGeometry';
import type { RoleLabels } from './ClassifiedRuleSet';
import type { ClassifiedMove } from './ClassifiedRuleSet';

export interface ClassifiedPiece {
  readonly owner: string;
  readonly kind: string;
  readonly promoted?: boolean;
  readonly orientation?: 0 | 90 | 180 | 270;
  readonly stack?: readonly ClassifiedPiece[];
  readonly count?: number;
}

/**
 * Per-side hand reserve — `pieceId → count`. Mutated by capture (Shogi-family)
 * or initialization (Crazyhouse promotion pool). Keys stable with PieceVocabulary.
 */
export interface ClassifiedHands {
  readonly white: ReadonlyMap<string, number>;
  readonly black: ReadonlyMap<string, number>;
}

/** Placement-phase marker for games with a pre-movement drop phase (NMM, Yoté). */
export interface ClassifiedPlacementPhase {
  readonly phase: 'placement' | 'movement' | 'flying';
  readonly whiteRemaining: number;
  readonly blackRemaining: number;
}

export interface ClassifiedGameState {
  readonly pieces: ReadonlyMap<NodeId, ClassifiedPiece>;
  /** Whose turn it is. Optional for Task 27.3 renderer previews; required
   *  on every in-progress `ClassifiedRuleSet` state (the rule-set validator
   *  does not check this; authors wire it up). */
  readonly turn?: string;
  /** Zero-based half-move counter. 0 at start. */
  readonly plyCount?: number;
  /** Ordered list of moves applied so far (oldest first). */
  readonly moveHistory?: readonly ClassifiedMove[];
  /** Hand reserves (present iff `hasPiecesInHand`). */
  readonly hands?: ClassifiedHands;
  /** Placement-phase marker (present iff `hasPlacementPhase`). */
  readonly placementPhase?: ClassifiedPlacementPhase;
  /** Role labels (present iff `isAsymmetric`). */
  readonly roles?: RoleLabels;
  /** Free-form per-game metadata. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

export const EMPTY_CLASSIFIED_STATE: ClassifiedGameState = {
  pieces: new Map(),
};

/**
 * Type guard: distinguishes a ClassifiedGameState from the Phase 1
 * `BoardState = readonly SquareState[]` shape used by Classic/Crazy/
 * Chaos/Choice modes.
 */
export function isClassifiedGameState(value: unknown): value is ClassifiedGameState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pieces' in value &&
    (value as { pieces: unknown }).pieces instanceof Map
  );
}
