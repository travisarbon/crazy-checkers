/**
 * Rek notation adapter — Tier 2 (Task 29.8).
 *
 * Letter-number coords (algebraic) with King distinction + captures-list:
 *  - **Step (man):** `<from>-<to>`.
 *  - **Step (king):** `K<from>-<to>` (leading `K` per piece-type prefix).
 *  - **Capture:** `<piece-prefix?><from>-<to> (captures: <c1>, <c2>, ...)`.
 *  - **Immobilization capture:** `<piece-prefix?><from>-<to> (immobilized: <c1>, ...)`.
 *
 * Per plan §6.7 — uses Mak-yek's captures-list format with an additional
 * King prefix and an alternate annotation for immobilization (a Rek-specific
 * mechanic that reads differently from custodian/intervention captures).
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import type { ClassifiedMove } from '../../../engine/classified/ClassifiedRuleSet';
import type { Tier2NotationAdapter } from './dameo';

const CAPTURES_RE =
  /^(K)?(.+?)-(\S+?)(?:\s+\((captures|immobilized):\s*([^)]+)\))?$/;

export function createRekNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  const parseToken = (token: string): number | null => {
    const id = boardGeometry.coordinateLabels.parseNotation(token);
    return id === null ? null : (id as unknown as number);
  };

  return {
    adapterKey: 'rek-letter-number',
    notate(_state, move) {
      void _state;
      const from = move.from ?? '?';
      const to = move.to ?? '?';
      const piece = move.piece ?? 'man';
      const prefix = piece === 'king' ? 'K' : '';
      const captures = move.capture ?? [];
      const baseText = `${prefix}${from}-${to}`;
      if (captures.length === 0) return baseText;
      // Distinguish immobilization vs. custodian/intervention by a meta hint.
      const isImmobilization =
        (move.meta?.['captureMode'] as string | undefined) === 'immobilization';
      const tag = isImmobilization ? 'immobilized' : 'captures';
      return `${baseText} (${tag}: ${captures.join(', ')})`;
    },
    parse(_state, notation) {
      void _state;
      const trimmed = notation.trim();
      const m = CAPTURES_RE.exec(trimmed);
      if (m === null) return null;
      const isKing = m[1] === 'K';
      const from = m[2];
      const to = m[3];
      if (from === undefined || to === undefined) return null;
      if (parseToken(from) === null || parseToken(to) === null) return null;
      const tag = m[4];
      const capturesRaw = m[5];
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
        piece: isKing ? 'king' : 'man',
        capture: captures,
      };
      if (tag === 'immobilized') {
        return { ...move, meta: { captureMode: 'immobilization' } };
      }
      return move;
    },
  };
}
