/**
 * AlquerqueCoordinates — labels for the alquerque intersection graph
 * (Phase 4 Task 29.3).
 *
 * - `notationOf(node)`: 1-based row-major intersection index, '1'..'81' for
 *   Zamma. Mirrors playbook §5.4: "Point (0,0) = 1, point (8,8) = 81".
 * - `displayOf(node)`: algebraic-style 'a1'..'i9' for Zamma. Files run
 *   left-to-right (a..i for size 9); ranks run bottom-to-top (1..9).
 * - `ariaOf(node)`: '<family> <algebraic>'. Center and corner intersections
 *   are surfaced with extra context for screen readers.
 * - `parseNotation(token)`: accepts both numeric ('1'..'81') and algebraic
 *   ('a1'..'i9') inputs; case-insensitive on the file letter.
 */

import type { CoordinateLabeler, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export interface BuildAlquerqueCoordinatesOptions {
  /** Side length (9 for Zamma, 5 for Bagh-Chal). */
  readonly size: number;
}

const FILE_LETTERS = 'abcdefghijklmnopqrs';

export function buildAlquerqueCoordinates(
  opts: BuildAlquerqueCoordinatesOptions,
): CoordinateLabeler {
  const { size } = opts;

  const algebraic = (node: NodeId): string => {
    const idx = node as unknown as number;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const file = FILE_LETTERS[c] ?? `col${String(c)}`;
    const rank = size - r;
    return `${file}${String(rank)}`;
  };

  const numericOf = (node: NodeId): string => {
    const idx = node as unknown as number;
    return String(idx + 1);
  };

  const isCenter = (node: NodeId): boolean => {
    if (size % 2 === 0) return false;
    const idx = node as unknown as number;
    const center = Math.floor(size / 2);
    return idx === center * size + center;
  };

  const isCorner = (node: NodeId): boolean => {
    const idx = node as unknown as number;
    const r = Math.floor(idx / size);
    const c = idx % size;
    return (r === 0 || r === size - 1) && (c === 0 || c === size - 1);
  };

  return {
    notationOf: (node) => numericOf(node),
    displayOf: (node) => algebraic(node),
    ariaOf: (node) => {
      const alg = algebraic(node);
      if (isCenter(node)) return `alquerque center intersection ${alg}`;
      if (isCorner(node)) return `alquerque corner intersection ${alg}`;
      return `alquerque intersection ${alg}`;
    },
    parseNotation: (token) => {
      const trimmed = token.trim().toLowerCase();
      // Numeric form: '1'..String(size*size)
      if (/^\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        if (Number.isInteger(n) && n >= 1 && n <= size * size) {
          return asNodeId(n - 1);
        }
        return null;
      }
      // Algebraic form: 'a1'..(size-th letter)(size).
      const match = /^([a-s])(\d{1,2})$/.exec(trimmed);
      if (!match) return null;
      const fileChar = match[1] ?? '';
      const rankStr = match[2] ?? '';
      const file = FILE_LETTERS.indexOf(fileChar);
      const rank = Number(rankStr);
      if (file < 0 || file >= size) return null;
      if (!Number.isFinite(rank) || rank < 1 || rank > size) return null;
      const r = size - rank;
      return asNodeId(r * size + file);
    },
  };
}
