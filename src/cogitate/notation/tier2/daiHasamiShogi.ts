/**
 * Dai Hasami Shogi notation adapter — Tier 2 (Task 29.8).
 *
 * Shogi-coords + jump syntax + win tokens:
 *  - **Step:** `<from>-<to>` (e.g., `9a-9e`).
 *  - **Non-capturing jump:** `<from>^<to>` (caret denotes jump-over of one
 *    orthogonally adjacent piece — Dai Hasami Shogi's signature mechanic).
 *  - **Capture (custodian / corner):** `<from>-<to> (captures: <list>)`.
 *  - **Reduce-below-5 win:** appended `#R5`.
 *  - **5-in-a-row win:** appended `#L5(<line-coords>)` — e.g.,
 *    `#L5(5a,5b,5c,5d,5e)` indicates the five squares forming the
 *    winning line.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import type { ClassifiedMove } from '../../../engine/classified/ClassifiedRuleSet';
import type { Tier2NotationAdapter } from './dameo';
import { shogiCoordinateLabeler, type ShogiCoordinateLabeler } from './shogiCoords';

const MOVE_RE =
  /^(.+?)([-^])(\S+?)(?:\s+\(captures:\s*([^)]+)\))?(#R5|#L5\([^)]+\))?$/;

interface Opts {
  readonly boardGeometry: BoardGeometry;
  readonly shogiLabeler: ShogiCoordinateLabeler;
}

function engineToShogi(token: string, opts: Opts): string | null {
  const node = opts.boardGeometry.coordinateLabels.parseNotation(token);
  if (node === null) return null;
  return opts.shogiLabeler.notationOf(node as unknown as number);
}

function shogiToEngine(token: string, opts: Opts): string | null {
  const node = opts.shogiLabeler.parseNotation(token);
  if (node === null) return null;
  return opts.boardGeometry.coordinateLabels.notationOf(node as never);
}

export function createDaiHasamiShogiNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  const opts: Opts = {
    boardGeometry,
    shogiLabeler: shogiCoordinateLabeler(9),
  };
  return {
    adapterKey: 'dai-hasami-shogi-shogi-coords',
    notate(_state, move) {
      void _state;
      const from = move.from ?? '?';
      const to = move.to ?? '?';
      const captures = move.capture ?? [];
      const fromShogi = engineToShogi(from, opts) ?? '?';
      const toShogi = engineToShogi(to, opts) ?? '?';
      const isJump = move.kind === 'jump';
      const sep = isJump ? '^' : '-';
      let text = `${fromShogi}${sep}${toShogi}`;
      if (captures.length > 0) {
        const capturesShogi = captures
          .map((c) => engineToShogi(c, opts) ?? '?')
          .join(', ');
        text += ` (captures: ${capturesShogi})`;
      }
      const winMode = move.meta?.['winMode'] as string | undefined;
      if (winMode === 'reduce-below-5') text += '#R5';
      else if (winMode === '5-in-a-row') {
        const line = (move.meta?.['winLine'] as readonly string[] | undefined) ?? [];
        const lineShogi = line.map((c) => engineToShogi(c, opts) ?? '?').join(',');
        text += `#L5(${lineShogi})`;
      }
      return text;
    },
    parse(_state, notation) {
      void _state;
      const trimmed = notation.trim();
      const m = MOVE_RE.exec(trimmed);
      if (m === null) return null;
      const fromShogi = m[1];
      const sep = m[2];
      const toShogi = m[3];
      const capturesRaw = m[4];
      const winSuffix = m[5];
      if (fromShogi === undefined || toShogi === undefined) return null;
      const fromEngine = shogiToEngine(fromShogi, opts);
      const toEngine = shogiToEngine(toShogi, opts);
      if (fromEngine === null || toEngine === null) return null;
      const captures: string[] =
        capturesRaw === undefined
          ? []
          : capturesRaw
              .split(',')
              .map((c) => c.trim())
              .filter((c) => c.length > 0)
              .map((shogi) => shogiToEngine(shogi, opts) ?? shogi);
      const kind = sep === '^' ? 'jump' : captures.length > 0 ? 'capture' : 'move';
      const move: ClassifiedMove = {
        kind,
        from: fromEngine,
        to: toEngine,
        capture: captures,
      };
      if (winSuffix === '#R5') {
        return { ...move, meta: { winMode: 'reduce-below-5' } };
      }
      if (winSuffix !== undefined && winSuffix.startsWith('#L5(')) {
        const inner = winSuffix.slice(4, -1);
        const lineEngine = inner
          .split(',')
          .map((s) => s.trim())
          .map((shogi) => shogiToEngine(shogi, opts) ?? shogi);
        return { ...move, meta: { winMode: '5-in-a-row', winLine: lineEngine } };
      }
      return move;
    },
  };
}
