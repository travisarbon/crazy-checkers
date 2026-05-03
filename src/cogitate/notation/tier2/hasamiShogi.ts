/**
 * Hasami Shogi notation adapter — Tier 2 (Task 29.8).
 *
 * Shogi-style coordinates (file 9..1 left-to-right, rank a..i top-to-bottom)
 * with captures-list annotation:
 *
 *  - **Step:** `<from>-<to>` (e.g., `9a-9e`).
 *  - **Capture:** `<from>-<to> (captures: <c1>, <c2>, ...)`.
 *
 * The shogi-coord override lives **inside the notation adapter only** —
 * the engine's `BoardGeometry.coordinateLabels` continues to emit `a1..i9`
 * algebraic. The adapter translates engine NodeIds → shogi tokens via the
 * `shogiCoordinateLabeler` helper, and translates incoming shogi tokens
 * back to NodeIds for parse.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import type { ClassifiedMove } from '../../../engine/classified/ClassifiedRuleSet';
import type { Tier2NotationAdapter } from './dameo';
import { shogiCoordinateLabeler, type ShogiCoordinateLabeler } from './shogiCoords';

const CAPTURES_RE = /^(.+?)-(\S+?)(?:\s+\(captures:\s*([^)]+)\))?$/;

interface ShogiNotationOpts {
  readonly adapterKey: string;
  readonly boardGeometry: BoardGeometry;
  readonly shogiLabeler: ShogiCoordinateLabeler;
}

/**
 * Convert an engine notation token (e.g., `a1`) to a shogi token (`9i`).
 * Returns `null` if the engine token is unparseable.
 */
function engineToShogi(token: string, opts: ShogiNotationOpts): string | null {
  const node = opts.boardGeometry.coordinateLabels.parseNotation(token);
  if (node === null) return null;
  return opts.shogiLabeler.notationOf(node as unknown as number);
}

/**
 * Convert a shogi token (e.g., `9a`) to an engine notation token (`a1`).
 * Returns `null` if the shogi token is unparseable.
 */
function shogiToEngine(token: string, opts: ShogiNotationOpts): string | null {
  const node = opts.shogiLabeler.parseNotation(token);
  if (node === null) return null;
  return opts.boardGeometry.coordinateLabels.notationOf(node as never);
}

export function createShogiCapturesListAdapter(
  opts: ShogiNotationOpts,
): Tier2NotationAdapter {
  return {
    adapterKey: opts.adapterKey,
    notate(_state, move) {
      void _state;
      const from = move.from ?? '?';
      const to = move.to ?? '?';
      const captures = move.capture ?? [];
      const fromShogi = engineToShogi(from, opts) ?? '?';
      const toShogi = engineToShogi(to, opts) ?? '?';
      const capturesShogi = captures
        .map((c) => engineToShogi(c, opts) ?? '?')
        .join(', ');
      const baseText = `${fromShogi}-${toShogi}`;
      if (captures.length === 0) return baseText;
      return `${baseText} (captures: ${capturesShogi})`;
    },
    parse(_state, notation) {
      void _state;
      const trimmed = notation.trim();
      const m = CAPTURES_RE.exec(trimmed);
      if (m === null) return null;
      const fromShogi = m[1];
      const toShogi = m[2];
      if (fromShogi === undefined || toShogi === undefined) return null;
      const fromEngine = shogiToEngine(fromShogi, opts);
      const toEngine = shogiToEngine(toShogi, opts);
      if (fromEngine === null || toEngine === null) return null;
      const capturesRaw = m[3];
      const captures: string[] =
        capturesRaw === undefined
          ? []
          : capturesRaw
              .split(',')
              .map((c) => c.trim())
              .filter((c) => c.length > 0)
              .map((shogi) => shogiToEngine(shogi, opts) ?? shogi);
      const move: ClassifiedMove = {
        kind: captures.length > 0 ? 'capture' : 'move',
        from: fromEngine,
        to: toEngine,
        capture: captures,
      };
      return move;
    },
  };
}

export function createHasamiShogiNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  return createShogiCapturesListAdapter({
    adapterKey: 'hasami-shogi-shogi-coords',
    boardGeometry,
    shogiLabeler: shogiCoordinateLabeler(9),
  });
}
