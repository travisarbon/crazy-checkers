/**
 * CrossCoordinates — Fox and Geese.
 *
 * Encoding: arm-and-offset tokens.
 *   - Hub: `H1..H9` for the 3×3 center.
 *   - North arm: `N1..N6` (two rows, three columns).
 *   - South arm: `S1..S6`.
 *   - East arm: `E1..E6`.
 *   - West arm: `W1..W6`.
 */

import type { CoordinateLabeler, NodeId } from '../boardGeometry';
import { crossNodeId, decodeCrossNode } from '../adjacency/CrossAdjacency';

export function buildCrossCoordinates(): CoordinateLabeler {
  const tokenOf = (node: NodeId): string => {
    const { r, c } = decodeCrossNode(node);
    if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
      const hubR = r - 2;
      const hubC = c - 2;
      return `H${String(hubR * 3 + hubC + 1)}`;
    }
    if (c >= 2 && c <= 4) {
      if (r < 2) return `N${String((1 - r) * 3 + (c - 2) + 1)}`;
      return `S${String((r - 5) * 3 + (c - 2) + 1)}`;
    }
    if (r >= 2 && r <= 4) {
      if (c < 2) return `W${String((1 - c) * 3 + (r - 2) + 1)}`;
      return `E${String((c - 5) * 3 + (r - 2) + 1)}`;
    }
    return `off-${String(r)}-${String(c)}`;
  };

  const parse = (token: string): NodeId | null => {
    const match = /^([hnsew])(\d+)$/.exec(token.trim().toLowerCase());
    if (!match) return null;
    const arm = match[1] ?? '';
    const n = Number(match[2] ?? '') - 1;
    if (!Number.isFinite(n) || n < 0 || n > 8) return null;
    if (arm === 'h') {
      const r = 2 + Math.floor(n / 3);
      const c = 2 + (n % 3);
      return crossNodeId(r, c);
    }
    if (n > 5) return null;
    const outer = Math.floor(n / 3);
    const lateral = n % 3;
    if (arm === 'n') return crossNodeId(1 - outer, 2 + lateral);
    if (arm === 's') return crossNodeId(5 + outer, 2 + lateral);
    if (arm === 'w') return crossNodeId(2 + lateral, 1 - outer);
    if (arm === 'e') return crossNodeId(2 + lateral, 5 + outer);
    return null;
  };

  return {
    notationOf: tokenOf,
    displayOf: tokenOf,
    ariaOf: (node) => `cross ${tokenOf(node)}`,
    parseNotation: parse,
  };
}
