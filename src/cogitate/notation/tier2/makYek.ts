/**
 * Mak-yek notation adapter — Tier 2 (Task 29.8).
 *
 * Letter-number coords (algebraic) with **invented** captures-list
 * annotation. Mak-yek's captures are post-move side effects (custodian
 * + intervention), not jump-mid-move, so the standard PDN `×` separator
 * does not fit. Instead we annotate the slide and append a parenthesised
 * captures list:
 *
 *  - **Step (no capture):** `<from>-<to>` (e.g., `a1-a4`).
 *  - **Capture:** `<from>-<to> (captures: <c1>, <c2>, ...)`.
 *
 * The captures-list format is **invented** for Mak-yek because no published
 * Mak-yek notation exists. Per plan §1.1 + RULES_NOTES.md TODO for source
 * consultation by per-game subtask 29.G.6-C.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import type { ClassifiedMove } from '../../../engine/classified/ClassifiedRuleSet';
import type { Tier2NotationAdapter } from './dameo';

const CAPTURES_RE = /^(.+?)-(\S+?)(?:\s+\(captures:\s*([^)]+)\))?$/;

export interface CapturesListAdapterOptions {
  readonly adapterKey: string;
  readonly boardGeometry: BoardGeometry;
}

export function createCapturesListAdapter(
  opts: CapturesListAdapterOptions,
): Tier2NotationAdapter {
  const { adapterKey, boardGeometry } = opts;
  const parseToken = (token: string): number | null => {
    const id = boardGeometry.coordinateLabels.parseNotation(token);
    return id === null ? null : (id as unknown as number);
  };

  return {
    adapterKey,
    notate(_state, move) {
      void _state;
      const from = move.from ?? '?';
      const to = move.to ?? '?';
      const captures = move.capture ?? [];
      const baseText = `${from}-${to}`;
      if (captures.length === 0) return baseText;
      return `${baseText} (captures: ${captures.join(', ')})`;
    },
    parse(_state, notation) {
      void _state;
      const trimmed = notation.trim();
      const m = CAPTURES_RE.exec(trimmed);
      if (m === null) return null;
      const from = m[1];
      const to = m[2];
      if (from === undefined || to === undefined) return null;
      if (parseToken(from) === null || parseToken(to) === null) return null;
      const capturesRaw = m[3];
      const captures: string[] =
        capturesRaw === undefined
          ? []
          : capturesRaw
              .split(',')
              .map((c) => c.trim())
              .filter((c) => c.length > 0);
      const move: ClassifiedMove = {
        kind: captures.length > 0 ? 'capture' : 'move',
        from,
        to,
        capture: captures,
      };
      return move;
    },
  };
}

export function createMakYekNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  return createCapturesListAdapter({
    adapterKey: 'mak-yek-letter-number',
    boardGeometry,
  });
}
