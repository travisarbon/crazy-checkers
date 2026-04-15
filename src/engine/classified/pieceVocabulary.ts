/**
 * PieceVocabulary — Phase 4 piece descriptor registry (Task 27.4).
 *
 * Implements the master playbook §2 "Piece Vocabulary" and closes the
 * Task 27.1 handoff-review delta T7-08 by splitting on-board from
 * in-hand piece definitions so the Tier 7 Shogi family can surface the
 * hand reserve without bending the adapter contract.
 *
 * See src/engine/classified/CLASSIFIED_REGISTRATION.md for authoring rules.
 */

/** Branded identifier for a PieceVocabulary entry; stable forever once released. */
export type PieceVocabularyId = string & { readonly __brand: 'PieceVocabularyId' };

/** Helper to brand a literal string without a cast at the call-site. */
export const asPieceVocabularyId = (id: string): PieceVocabularyId =>
  id as PieceVocabularyId;

/**
 * Branded identifier for an audio pack; resolved against the Phase 3 audio
 * registry. Task 27.4 stores the id — the audio manager does the lookup.
 */
export type AudioPackId = string & { readonly __brand: 'AudioPackId' };
export const asAudioPackId = (id: string): AudioPackId => id as AudioPackId;

/**
 * Declarative piece descriptor. Consumed by the default Cogitate adapter,
 * the PieceLayer (Task 27.5), and serializers (Task 27.6).
 */
export interface PieceDefinition {
  /** Stable id (e.g. `shogi-rook`). Persistence key for this piece kind. */
  readonly pieceId: string;
  /** Human-readable label for the gallery and overlays. */
  readonly displayName: string;
  /** Ownership. `either` is used for neutral pieces such as Go stones. */
  readonly owner?: 'white' | 'black' | 'either';
  /** pieceId of the promoted form (if any). */
  readonly promotesTo?: string;
  /** Optional SVG symbol id (Task 27.5 resolves). */
  readonly svgSymbolId?: string;
  /** Two-sided pieces (Shogi family) set this true. */
  readonly flipIsPromotion?: boolean;
}

/**
 * PieceVocabulary descriptor. Splits pieces by their physical location so
 * Tier 7 (Shogi / Crazyhouse / Chushogi) can author a reserve without
 * overloading the on-board palette. Games without a hand supply `inHand: []`.
 */
export interface PieceVocabulary {
  readonly id: PieceVocabularyId;
  readonly onBoard: readonly PieceDefinition[];
  readonly inHand: readonly PieceDefinition[];
}

/** Convenience constructor — ensures both piece lists are frozen. */
export function createPieceVocabulary(
  id: PieceVocabularyId,
  onBoard: readonly PieceDefinition[],
  inHand: readonly PieceDefinition[] = [],
): PieceVocabulary {
  return Object.freeze({
    id,
    onBoard: Object.freeze([...onBoard]),
    inHand: Object.freeze([...inHand]),
  });
}

/**
 * The canonical draughts-family vocabulary used by every Tier 1 registration
 * fixture and reused for the Task 27.4 test fixture (`testCheckersClone`).
 */
export const DRAUGHTS_PIECE_VOCABULARY: PieceVocabulary = createPieceVocabulary(
  asPieceVocabularyId('draughts-standard'),
  [
    { pieceId: 'pawn-white', displayName: 'White Pawn', owner: 'white', promotesTo: 'king-white' },
    { pieceId: 'pawn-black', displayName: 'Black Pawn', owner: 'black', promotesTo: 'king-black' },
    { pieceId: 'king-white', displayName: 'White King', owner: 'white' },
    { pieceId: 'king-black', displayName: 'Black King', owner: 'black' },
  ],
);
