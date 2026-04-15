/**
 * ClassifiedRuleSet — the normative Phase 4 rule-set contract (Task 27.4).
 *
 * Every Tier 1–7 Classified game registers a ClassifiedRuleSet via
 * `registerClassifiedGame(spec)` (src/engine/classified/registry.ts).
 * The interface encodes:
 *  - identity + metadata (gameId, boardGeometry, pieceVocabulary)
 *  - six capability flags (closed set at this task)
 *  - required lifecycle hooks (startingPosition, getLegalMoves, applyMove,
 *    checkGameOver; onMoveComplete optional)
 *  - optional hooks gated 1:1 by capability flags and validated at
 *    registration time in `registrationSpec.ts::validateRuleSetConsistency`.
 *
 * Authoritative references:
 *  - Classified Integration Master Playbook v1.0 §2 "ClassifiedRuleSet Interface"
 *  - Phase 4 Implementation Plan §Task 27.4
 *  - Task 27.1 Handoff Review §5.3 (T7-08 piece-palette on-board/in-hand split)
 */

import type { BoardGeometry } from '../boardGeometry';
import type { GameResult } from '../types';
import type { ClassifiedGameState } from './state';
import type { PieceVocabulary } from './pieceVocabulary';

/**
 * Branded stable identifier for a Classified game. Kebab-case, immutable
 * after first release (persistence key + unlock key + registry key).
 */
export type ClassifiedGameId = string & { readonly __brand: 'ClassifiedGameId' };
export const asClassifiedGameId = (id: string): ClassifiedGameId => id as ClassifiedGameId;

/**
 * Closed union of Classified family labels. Tier authors pick one value;
 * the gallery groups by family. Adding a new family is a plan-level
 * decision (requires a Library Playbook bump).
 */
export type ClassifiedFamily =
  | 'Draughts'
  | 'Stacking Draughts'
  | 'Capture Game'
  | 'Hunt Game'
  | 'Mill Game'
  | 'Mancala'
  | 'Race Game'
  | 'Placement Game'
  | 'Connection Game'
  | 'Territory Game'
  | 'Chess'
  | 'Shogi'
  | 'Xiangqi'
  | 'Janggi'
  | 'Tafl'
  | 'Abstract Strategy'
  | 'Test';

/** Six closed capability flags. Every ClassifiedRuleSet answers all six. */
export interface CapabilityFlags {
  readonly hasPlacementPhase: boolean;
  readonly hasPiecesInHand: boolean;
  readonly hasStacks: boolean;
  readonly isAsymmetric: boolean;
  readonly hasMutableGeometry: boolean;
  readonly hasPiecesOfDistinctTypes: boolean;
}

/** Generic move shape — games specialise via kind + meta. */
export interface ClassifiedMove {
  readonly kind: string;
  readonly from?: string;
  readonly to?: string;
  readonly piece?: string;
  readonly promotion?: string;
  readonly capture?: readonly string[];
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** Start-options for variant / handicap / seeded random games. */
export interface StartOptions {
  readonly variant?: string;
  readonly handicap?: number;
  readonly seed?: string;
}

/** A placement zone — where and which pieces may be placed. */
export interface PlacementZone {
  readonly owner: 'white' | 'black' | 'either';
  readonly nodes: readonly string[];
  readonly pieceKinds: readonly string[];
}

/** Placement → movement → flying transitions (NMM and relatives). */
export interface PhaseTransition {
  readonly from: string;
  readonly to: string;
  readonly condition: 'all-pieces-placed' | 'all-pieces-flown' | 'custom';
}

/** Asymmetric role labels (Fox and Geese; Tafl). */
export interface RoleLabels {
  readonly whiteRole: string;
  readonly blackRole: string;
  readonly whiteGoal?: string;
  readonly blackGoal?: string;
}

/** Notation adapter generic in state + move type. */
export interface NotationAdapter<S, M> {
  readonly notate: (state: S, move: M) => string;
  readonly parse: (state: S, notation: string) => M | null;
}

/** Evaluation provider generic in state + move type. */
export interface EvaluationProvider<S, M> {
  readonly evaluate: (state: S) => number;
  readonly principalVariation: (state: S, depth: number) => readonly M[];
}

/**
 * Minimum GameStateSerializer shape. Task 27.6 extends the `version` union
 * and the migration hook; Task 27.4 freezes the identity + toJSON/fromJSON
 * contract so downstream serializers extend compatibly.
 */
export interface GameStateSerializer<S> {
  readonly version: 1;
  readonly toJSON: (state: S) => unknown;
  readonly fromJSON: (json: unknown) => S;
}

/**
 * The normative ClassifiedRuleSet contract. Generic over state (`S`) and
 * move (`M`) so Tier 6 chess states and Tier 7 shogi-with-hand states
 * type-check without casting.
 *
 * Every capability flag is required via the `extends CapabilityFlags`
 * intersection — a missing flag is a compile error, not a runtime one.
 */
export interface ClassifiedRuleSet<
  S extends ClassifiedGameState = ClassifiedGameState,
  M extends ClassifiedMove = ClassifiedMove,
> extends CapabilityFlags {
  readonly gameId: ClassifiedGameId;
  readonly boardGeometry: BoardGeometry;
  readonly pieceVocabulary: PieceVocabulary;

  // Required lifecycle hooks
  readonly startingPosition: (options?: StartOptions) => S;
  readonly getLegalMoves: (state: S) => readonly M[];
  readonly applyMove: (state: S, move: M) => S;
  readonly checkGameOver: (state: S) => GameResult | null;
  readonly onMoveComplete?: (state: S, move: M) => S;

  // Optional hooks — presence gated by capability flags
  readonly getLegalDrops?: (state: S) => readonly M[];
  readonly getPlacementZones?: (state: S) => readonly PlacementZone[];
  readonly getPhaseTransition?: (state: S) => PhaseTransition | null;
  readonly getRoleLabels?: () => RoleLabels;

  // Attached adapters
  readonly notationAdapter?: NotationAdapter<S, M>;
  readonly evaluationProvider?: EvaluationProvider<S, M>;
  readonly serializer: GameStateSerializer<S>;
}

/**
 * Type-level consistency guard. A spec whose capability flags disagree with
 * its optional-hook presence fails to type-check at the registration call
 * site (mirrored at runtime by `validateRuleSetConsistency`).
 */
export type ConsistentRuleSet<R extends ClassifiedRuleSet> = R &
  (R['hasPiecesInHand'] extends true ? Required<Pick<R, 'getLegalDrops'>> : unknown) &
  (R['hasPlacementPhase'] extends true ? Required<Pick<R, 'getPlacementZones'>> : unknown) &
  (R['isAsymmetric'] extends true ? Required<Pick<R, 'getRoleLabels'>> : unknown);
