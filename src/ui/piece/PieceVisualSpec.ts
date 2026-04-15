/**
 * PieceVisualSpec — UI-layer visual augmentation for Phase 4 Classified pieces
 * (Task 27.5).
 *
 * The engine-layer `PieceDefinition` (src/engine/classified/pieceVocabulary.ts)
 * defines the identity every cross-cutting system reads (pieceId, owner,
 * promotesTo, svgSymbolId, flipIsPromotion). This module introduces the
 * rendering-only companion keyed by the same `pieceId`: viewBox, render fn,
 * colour policy, two-sided flip target, compound overlay, and optional
 * stack-layout height function.
 *
 * See src/ui/piece/README.md for authoring rules.
 */

import type { ReactElement } from 'react';
import type { PieceVocabularyId } from '../../engine/classified/pieceVocabulary';
import type { Theme } from '../../themes/theme';

/** Discrete SVG "parts" a hybrid-coloured piece may split between theme / absolute. */
export type PieceSvgPart = 'body' | 'stroke' | 'accent' | 'halo';

/** Colour-policy union — see README §"Colour Policy Matrix". */
export type PieceColorPolicy =
  | { readonly kind: 'theme-driven' }
  | { readonly kind: 'absolute'; readonly light: string; readonly dark: string }
  | {
      readonly kind: 'hybrid';
      readonly themeParts: readonly PieceSvgPart[];
      readonly absoluteParts: readonly PieceSvgPart[];
      readonly light: string;
      readonly dark: string;
    };

/** Per-render context the registry hands a piece's render fn. */
export interface PieceRenderProps {
  /** Theme the caller wants this piece to honour (`theme-driven`/`hybrid`). */
  readonly theme: Theme;
  /** `'white' | 'black' | 'either'` — maps to colour-policy light/dark resolution. */
  readonly owner: 'white' | 'black' | 'either';
  /** True while the piece is selected — drives halo + selection chrome. */
  readonly selected?: boolean;
  /** True when the piece was the just-moved one. Adds a subtle last-move glow. */
  readonly lastMoved?: boolean;
  /** True during capture animation (fade-out chrome). */
  readonly capturing?: boolean;
  /** Outer radius hint in SVG units (default 38). */
  readonly radius?: number;
}

/** A11y context consumed by describePiece() — see §4.6 of the task plan. */
export interface PieceA11yContext {
  readonly location:
    | { readonly kind: 'board'; readonly square: string }
    | { readonly kind: 'hand'; readonly count: number }
    | { readonly kind: 'palette' };
  readonly selected?: boolean;
  readonly lastMoved?: boolean;
  readonly capturing?: boolean;
  readonly stackDepth?: number;
  readonly promotionState?: 'unpromoted' | 'promoted';
}

/** UI-layer visual augmentation of the engine-level PieceDefinition. */
export interface PieceVisualSpec {
  /** Engine-layer pieceId this spec renders. Join key with PieceDefinition. */
  readonly pieceId: string;
  /** Vocabulary this piece belongs to; used for palette filtering and a11y. */
  readonly vocabularyId: PieceVocabularyId;
  /** SVG coordinate space. Draughts convention: [-50, -50, 100, 100]. */
  readonly viewBox: readonly [number, number, number, number];
  /** Pure render function consuming theme + state; returns an SVG fragment. */
  readonly render: (props: PieceRenderProps) => ReactElement;
  /** How the piece responds to theme changes. */
  readonly colorPolicy: PieceColorPolicy;
  /** For Shogi-family two-sided pieces: the pieceId of the flipped face. */
  readonly flippedPieceId?: string;
  /** For compound pieces (e.g. Capablanca Chancellor = rook + knight overlay). */
  readonly compoundOverlay?: readonly string[];
  /** For stack games: stack-depth → total vertical offset in SVG units. */
  readonly heightFunction?: (stackDepth: number) => number;
  /** Short human label ("Pawn", "King"); consumed by describePiece default. */
  readonly shortLabel: string;
  /** Piece-specific label generator. Default: colour + shortLabel + state. */
  readonly describe?: (ctx: PieceA11yContext) => string;
  /** Stub flag; CI fails production build if any registered game reaches a stub. */
  readonly __PIECE_STUB__?: true;
}

/** Thrown when `getPieceVisual(pieceId)` finds no spec. */
export class PieceVisualMissingError extends Error {
  public readonly pieceId: string;
  public readonly registeredIds: readonly string[];
  public constructor(pieceId: string, registeredIds: readonly string[]) {
    super(
      `[PieceRegistry] no PieceVisualSpec registered for pieceId="${pieceId}". ` +
        `Registered ids: [${registeredIds.join(', ')}]. ` +
        `Hint: ensure the family barrel under src/ui/piece/assets/ is imported.`,
    );
    this.name = 'PieceVisualMissingError';
    this.pieceId = pieceId;
    this.registeredIds = registeredIds;
  }
}

/** Thrown when a second registerPieceVisual call supplies a differing spec. */
export class PieceVisualCollisionError extends Error {
  public readonly pieceId: string;
  public constructor(pieceId: string) {
    super(
      `[PieceRegistry] conflicting PieceVisualSpec for pieceId="${pieceId}". ` +
        `Re-registration is only allowed when the spec object is identical ` +
        `(bit-identical HMR re-import). Differing specs must use a different pieceId.`,
    );
    this.name = 'PieceVisualCollisionError';
    this.pieceId = pieceId;
  }
}
