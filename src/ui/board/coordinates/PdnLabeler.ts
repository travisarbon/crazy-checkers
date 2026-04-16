/**
 * PdnLabeler — UI-layer dual-label wrapper around `geometry.coordinateLabels`
 * (Task 28.4 §3).
 *
 * Surfaces three views of each node — primary glyph, secondary (hover) glyph,
 * and ARIA string — alongside a query for whether the geometry exposes PDN
 * numbering for a given node. Used by `SquareBoardRenderer` for the rendered
 * coordinate-glyph layer; will be reused by Task 28.6's NotationAdapter for
 * PDN move parsing.
 *
 * PDN-variant detection probes a sample playable node's `notationOf` rather
 * than sniffing a serialized key, so it remains correct if the geometry
 * factory's serialization format ever changes.
 */

import type { BoardGeometry, NodeId } from '../BoardGeometry';

export interface CoordinateView {
  /** Primary label shown on the cell. PDN if PDN-variant, else algebraic. */
  readonly primary: string;
  /** Secondary label shown on hover/focus. Algebraic if PDN-variant, else null. */
  readonly secondary: string | null;
  /** ARIA label (drives screen-reader output). */
  readonly aria: string;
  /** True iff the geometry associates a PDN number with this node. */
  readonly hasPdn: boolean;
}

export interface PdnLabeler {
  /** Is the underlying geometry a PDN variant? Detected by probing. */
  readonly isPdnVariant: boolean;
  /** Derived label bundle for a single cell. */
  viewOf(node: NodeId): CoordinateView;
  /** Convenience: PDN number (or null when the cell has no PDN slot). */
  pdnOf(node: NodeId): number | null;
}

const NUMERIC = /^\d+$/;

function detectPdn(geometry: BoardGeometry): boolean {
  const labeler = geometry.coordinateLabels;
  const mask = geometry.playableMask;
  // PDN variants only number playable (dark) squares. Sample the first
  // playable node — if its notation is a positive integer string, the
  // geometry was constructed with `variant: 'pdn-*'`.
  for (const node of geometry.adjacency.listAllNodes()) {
    if (mask && !mask(node)) continue;
    return NUMERIC.test(labeler.notationOf(node));
  }
  return false;
}

export function createPdnLabeler(geometry: BoardGeometry): PdnLabeler {
  const labeler = geometry.coordinateLabels;
  const isPdnVariant = detectPdn(geometry);

  return {
    isPdnVariant,
    viewOf(node) {
      const notation = labeler.notationOf(node);
      const algebraic = labeler.displayOf(node);
      const aria = labeler.ariaOf(node);
      const hasPdn = isPdnVariant && NUMERIC.test(notation);
      return {
        primary: hasPdn ? notation : algebraic,
        secondary: hasPdn ? algebraic : null,
        aria,
        hasPdn,
      };
    },
    pdnOf(node) {
      if (!isPdnVariant) return null;
      const notation = labeler.notationOf(node);
      if (!NUMERIC.test(notation)) return null;
      const n = Number(notation);
      return Number.isInteger(n) ? n : null;
    },
  };
}
