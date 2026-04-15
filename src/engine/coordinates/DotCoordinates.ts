/**
 * DotCoordinates — Dots and Boxes.
 *
 * Labels:
 *   - dots:     `d(r,c)`
 *   - horizontal edges: `h(r,c)` — between dot (r,c) and (r,c+1)
 *   - vertical edges:   `v(r,c)` — between dot (r,c) and (r+1,c)
 *   - boxes:    `b(r,c)`
 */

import type { CoordinateLabeler, NodeId } from '../boardGeometry';
import {
  boxId,
  dotId,
  dotLayout,
  hEdgeId,
  vEdgeId,
  type BuildDotAdjacencyOptions,
} from '../adjacency/DotAdjacency';

export function buildDotCoordinates(
  opts: BuildDotAdjacencyOptions,
): CoordinateLabeler {
  const layout = dotLayout(opts);

  const tokenOf = (node: NodeId): string => {
    const idx = node as unknown as number;
    if (idx < layout.H_BASE) {
      const r = Math.floor(idx / (layout.boxesAcross + 1));
      const c = idx % (layout.boxesAcross + 1);
      return `d(${String(r)},${String(c)})`;
    }
    if (idx < layout.V_BASE) {
      const offset = idx - layout.H_BASE;
      const r = Math.floor(offset / layout.boxesAcross);
      const c = offset % layout.boxesAcross;
      return `h(${String(r)},${String(c)})`;
    }
    if (idx < layout.BOX_BASE) {
      const offset = idx - layout.V_BASE;
      const r = Math.floor(offset / (layout.boxesAcross + 1));
      const c = offset % (layout.boxesAcross + 1);
      return `v(${String(r)},${String(c)})`;
    }
    const offset = idx - layout.BOX_BASE;
    const r = Math.floor(offset / layout.boxesAcross);
    const c = offset % layout.boxesAcross;
    return `b(${String(r)},${String(c)})`;
  };

  const parse = (token: string): NodeId | null => {
    const match = /^([dhvb])\((\d+),(\d+)\)$/.exec(token.trim().toLowerCase());
    if (!match) return null;
    const r = Number(match[2] ?? '');
    const c = Number(match[3] ?? '');
    switch (match[1]) {
      case 'd':
        if (r < 0 || r > layout.boxesDown || c < 0 || c > layout.boxesAcross) return null;
        return dotId(layout, r, c);
      case 'h':
        if (r < 0 || r > layout.boxesDown || c < 0 || c >= layout.boxesAcross) return null;
        return hEdgeId(layout, r, c);
      case 'v':
        if (r < 0 || r >= layout.boxesDown || c < 0 || c > layout.boxesAcross) return null;
        return vEdgeId(layout, r, c);
      case 'b':
        if (r < 0 || r >= layout.boxesDown || c < 0 || c >= layout.boxesAcross) return null;
        return boxId(layout, r, c);
      default:
        return null;
    }
  };

  return {
    notationOf: tokenOf,
    displayOf: tokenOf,
    ariaOf: (node) => `dots ${tokenOf(node)}`,
    parseNotation: parse,
  };
}
