/**
 * RectangleCoordinates — Fanorona 9×5, Xiangqi 9×10, mancala-as-rectangle.
 *
 * Files are labeled a..(size-th) left-to-right; ranks run 1..height
 * bottom-to-top. Intersection indexing shares the same notation; renderers
 * differentiate via the `indexing` field.
 */

import type { CoordinateLabeler, IndexingMode, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export interface BuildRectangleCoordinatesOptions {
  width: number;
  height: number;
  indexing: IndexingMode;
  variant?: string;
}

const FILE_LETTERS = 'abcdefghijklmnopqrs';

export function buildRectangleCoordinates(
  opts: BuildRectangleCoordinatesOptions,
): CoordinateLabeler {
  const { width, height, indexing, variant } = opts;
  const family = variant ?? 'rectangle';

  const algebraic = (node: NodeId): string => {
    const idx = node as unknown as number;
    const r = Math.floor(idx / width);
    const c = idx % width;
    const file = FILE_LETTERS[c] ?? `col${String(c)}`;
    const rank = height - r;
    return `${file}${String(rank)}`;
  };

  return {
    notationOf: (node) => algebraic(node),
    displayOf: (node) => algebraic(node),
    ariaOf: (node) => `${family} ${indexing} ${algebraic(node)}`,
    parseNotation: (token) => {
      const match = /^([a-s])(\d{1,2})$/.exec(token.trim().toLowerCase());
      if (!match) return null;
      const fileChar = match[1] ?? '';
      const rankStr = match[2] ?? '';
      const file = FILE_LETTERS.indexOf(fileChar);
      const rank = Number(rankStr);
      if (file < 0 || file >= width) return null;
      if (!Number.isFinite(rank) || rank < 1 || rank > height) return null;
      const r = height - rank;
      return asNodeId(r * width + file);
    },
  };
}
