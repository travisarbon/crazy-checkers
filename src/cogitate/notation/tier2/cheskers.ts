/**
 * Cheskers notation adapter — Tier 2 (Task 29.8).
 *
 * PDN with piece-type prefix tokens (`P`/`K`/`B`/`C`):
 *  - **Pawn step:** `Pa3-b4`.
 *  - **King step:** `Kc1-d2`.
 *  - **Bishop slide:** `Ba1-c3`.
 *  - **Camel leap:** `Cg1-h4` (the (3, 1) leap).
 *  - **Pawn/King multi-jump capture:** `<piece><from>×<jump1>×...×<to>`
 *    (e.g., `Pa3×c5×e3`).
 *  - **Bishop/Camel displacement capture:** `<piece><from>×<to>` (single-piece
 *    capture annotated with `×`).
 *  - **Pawn promotion:** appended `=K` (or `=B` / `=C` if the choice knob is on).
 *
 * The piece-type prefix is the canonical disambiguator because Cheskers's
 * four piece types share dark-square trajectories. Without the prefix,
 * `c1-d2` is ambiguous (could be Pawn step, King step, or Bishop one-square
 * slide). The prefix is **mandatory** — every Cheskers move emits a prefix.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import { createPdnNotationAdapter } from '../basePdn';
import type { Tier2NotationAdapter } from './dameo';

type CheskersPieceKind = 'pawn' | 'king' | 'bishop' | 'camel';

const KIND_TO_PREFIX: Record<CheskersPieceKind, string> = {
  pawn: 'P',
  king: 'K',
  bishop: 'B',
  camel: 'C',
};

const PREFIX_TO_KIND: Record<string, CheskersPieceKind> = {
  P: 'pawn',
  K: 'king',
  B: 'bishop',
  C: 'camel',
};

const KIND_TO_PROMOTION_SUFFIX: Record<'king' | 'bishop' | 'camel', string> = {
  king: '=K',
  bishop: '=B',
  camel: '=C',
};

const PROMOTION_RE = /=([KBC])$/;

export function createCheskersNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  const base = createPdnNotationAdapter({
    adapterKey: 'cheskers-pdn',
    boardGeometry,
    captureSeparator: '×',
  });

  return {
    adapterKey: 'cheskers-pdn',
    notate(state, move) {
      const piece = (move.piece as CheskersPieceKind | undefined) ?? 'pawn';
      const prefix = KIND_TO_PREFIX[piece];
      const baseText = base.notate(state, move);
      let text = prefix + baseText;
      if (move.promotion !== undefined) {
        const suffix =
          KIND_TO_PROMOTION_SUFFIX[
            move.promotion as 'king' | 'bishop' | 'camel'
          ];
        text += suffix;
      }
      return text;
    },
    parse(state, notation) {
      const trimmed = notation.trim();
      if (trimmed.length < 2) return null;
      const prefixChar = trimmed[0];
      if (prefixChar === undefined) return null;
      const piece = PREFIX_TO_KIND[prefixChar];
      if (piece === undefined) return null;
      let core = trimmed.slice(1);
      let promotion: CheskersPieceKind | undefined;
      const promo = PROMOTION_RE.exec(core);
      if (promo !== null) {
        const ch = promo[1];
        if (ch !== undefined && ch in PREFIX_TO_KIND) {
          const k = PREFIX_TO_KIND[ch];
          if (k !== undefined && (k === 'king' || k === 'bishop' || k === 'camel')) {
            promotion = k;
            core = core.slice(0, -2); // strip "=X" (2 chars: '=' + kind char)
          }
        }
      }
      const baseMove = base.parse(state, core);
      if (baseMove === null) return null;
      return {
        ...baseMove,
        piece,
        ...(promotion !== undefined ? { promotion } : {}),
      };
    },
  };
}
