/**
 * Base PDN-family notation adapter.
 *
 * Consumed by the Tier 1 `configToNotation` factory and by the three
 * wrappers in `./draughts/` that override only the capture-annotation
 * phase. The base adapter relies on `BoardGeometry.coordinateLabels` for
 * per-square labelling, so the same code covers the `pdn-8` / `pdn-10` /
 * `pdn-12` cases without duplication.
 */

import type { BoardGeometry } from '../../engine/boardGeometry';
import type {
  ClassifiedMove,
  NotationAdapter,
} from '../../engine/classified/ClassifiedRuleSet';
import type { ClassifiedGameState } from '../../engine/classified/state';

export interface PdnAdapterOptions {
  readonly adapterKey: string;
  readonly boardGeometry: BoardGeometry;
  /** Separator used between capture legs. `pdn-frisian` and `pdn-8-armenian`
   *  override with decorated separators such as `×⊥` or `×−`. */
  readonly captureSeparator?: string;
  /** Callback invoked per capture leg, receiving the `from` / `to` pair so
   *  dual-axis wrappers can emit a per-leg separator (e.g. `×⊥` for orthogonal
   *  legs, `×/` for diagonal legs on Frisian boards). If provided, takes
   *  precedence over `captureSeparator`. */
  readonly legSeparator?: (
    fromNodeId: number,
    toNodeId: number,
    boardSize: number,
  ) => string;
}

export interface PdnNotationAdapter
  extends NotationAdapter<ClassifiedGameState, ClassifiedMove> {
  readonly adapterKey: string;
}

export function createPdnNotationAdapter(
  opts: PdnAdapterOptions,
): PdnNotationAdapter {
  const { adapterKey, boardGeometry } = opts;
  const parseToken = (token: string): number | null => {
    const id = boardGeometry.coordinateLabels.parseNotation(token);
    return id === null ? null : (id as unknown as number);
  };
  const boardSize = boardGeometry.dimensions.square?.size ?? 0;

  function legSep(fromId: number, toId: number): string {
    if (opts.legSeparator) return opts.legSeparator(fromId, toId, boardSize);
    return opts.captureSeparator ?? '×';
  }

  return {
    adapterKey,
    notate(_state, move) {
      void _state;
      if (move.from === undefined || move.to === undefined) return move.kind;
      const captures = move.capture ?? [];
      if (captures.length === 0) return `${move.from}-${move.to}`;
      // Capture: from ×[sep] capturedSquares... ×[sep] to
      // Convention: `move.from` is the starting square, `move.to` is the
      // final landing square, and `move.capture[]` holds the opponent squares
      // jumped over in order. Legs are from→capture[0], capture[0]→capture[1],
      // ..., capture[n-1]→to (conceptually). For annotation we list the
      // landing squares between legs.
      let out = move.from;
      let prev = parseToken(move.from);
      const landings = [...captures, move.to];
      for (const landing of landings) {
        const next = parseToken(landing);
        const sep = prev !== null && next !== null ? legSep(prev, next) : '×';
        out += sep + landing;
        prev = next;
      }
      return out;
    },
    parse(_state, notation) {
      void _state;
      const trimmed = notation.trim();
      if (trimmed.length === 0) return null;
      // Simple move: "from-to"
      if (trimmed.includes('-') && !containsCaptureMark(trimmed)) {
        const parts = trimmed.split('-');
        if (parts.length !== 2) return null;
        const from = parts[0];
        const to = parts[1];
        if (from === undefined || to === undefined) return null;
        if (parseToken(from) === null || parseToken(to) === null) return null;
        return { kind: 'move', from, to };
      }
      // Capture: split on '×' (possibly decorated with a trailing glyph).
      const tokens = splitOnCaptureMarks(trimmed);
      if (tokens.length < 2) return null;
      for (const t of tokens) if (parseToken(t) === null) return null;
      const from = tokens[0] as string;
      const to = tokens[tokens.length - 1] as string;
      const middle = tokens.slice(1, -1);
      return {
        kind: 'capture',
        from,
        to,
        capture: middle,
      };
    },
  };
}

const CAPTURE_MARKS = ['×', 'x', 'X'];

function containsCaptureMark(s: string): boolean {
  for (const m of CAPTURE_MARKS) if (s.includes(m)) return true;
  return false;
}

/**
 * Split a capture notation on `×` (with optional decoration glyphs `⊥`, `/`,
 * `−`, `-` immediately following). Returns the square tokens only.
 */
export function splitOnCaptureMarks(s: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i] as string;
    if (CAPTURE_MARKS.includes(ch)) {
      tokens.push(buf);
      buf = '';
      i += 1;
      // Skip single decoration glyph if present.
      const next = s[i];
      if (next === '⊥' || next === '/' || next === '−' || next === '-') {
        i += 1;
      }
      continue;
    }
    buf += ch;
    i += 1;
  }
  if (buf.length > 0) tokens.push(buf);
  return tokens;
}
