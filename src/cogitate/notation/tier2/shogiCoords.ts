/**
 * Shogi-style coordinate labeler (Phase 4 Task 29.8).
 *
 * Notation convention per playbook §7.2 wording for Hasami Shogi /
 * Dai Hasami Shogi: files numbered 9..1 left-to-right (from white's
 * perspective), ranks lettered a..i top-to-bottom. So `9a` = top-left
 * (file 9, rank a), `1i` = bottom-right (file 1, rank i).
 *
 * The engine's standard `SquareCoordinates` for 9×9 full-board geometry
 * emits `a1..i9` algebraic. The shogi convention is the **notation
 * adapter's** override — the engine's geometry stays unchanged.
 *
 * Mapping: `nodeId = r * size + c` (0-indexed row + column).
 *   - `r = 0` (top row) → rank `a`.
 *   - `r = 8` (bottom row) → rank `i`.
 *   - `c = 0` (left column) → file `9`.
 *   - `c = 8` (right column) → file `1`.
 *
 * Token format: `<file-digit><rank-letter>` (e.g., `9a` for nodeId 0).
 */

const RANK_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const;

export interface ShogiCoordinateLabeler {
  readonly notationOf: (nodeId: number) => string;
  readonly parseNotation: (token: string) => number | null;
}

export function shogiCoordinateLabeler(boardSize: number): ShogiCoordinateLabeler {
  if (boardSize !== 9) {
    throw new Error(
      `shogiCoordinateLabeler: only 9×9 boards are supported (got ${String(boardSize)})`,
    );
  }

  function notationOf(nodeId: number): string {
    if (!Number.isInteger(nodeId) || nodeId < 0 || nodeId >= boardSize * boardSize) {
      return '?';
    }
    const r = Math.floor(nodeId / boardSize);
    const c = nodeId % boardSize;
    const file = boardSize - c; // c=0 → 9; c=8 → 1
    const rank = RANK_LETTERS[r];
    if (rank === undefined) return '?';
    return `${String(file)}${rank}`;
  }

  function parseNotation(token: string): number | null {
    if (token.length < 2 || token.length > 2) return null;
    const fileChar = token[0];
    const rankChar = token[1];
    if (fileChar === undefined || rankChar === undefined) return null;
    const fileNum = Number.parseInt(fileChar, 10);
    if (!Number.isFinite(fileNum) || fileNum < 1 || fileNum > boardSize) return null;
    const rankIdx = RANK_LETTERS.indexOf(rankChar as (typeof RANK_LETTERS)[number]);
    if (rankIdx < 0) return null;
    const c = boardSize - fileNum; // 9 → 0; 1 → 8
    const r = rankIdx;
    return r * boardSize + c;
  }

  return { notationOf, parseNotation };
}
