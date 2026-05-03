/**
 * Dameo ARIA-label generator (Phase 4 Task 29.G.1-B §8.3).
 *
 * Phalanx-aware ARIA copy for screen readers. Replaces the per-piece
 * pattern with a single "phalanx of N advances <direction>" announcement
 * for group-advance moves; standard "<piece> moves from <from> to <to>"
 * for step moves; "<piece> captures N <opponent kind>s from <from> to
 * <to>[, promotes to king]" for capture moves.
 *
 * Direction mapping:
 *   - rank-forward → "forward" (rank pushes are the most common phalanx).
 *   - file-forward → "forward" (file pushes use the same word per per-game
 *     subtask wording — direction labels prioritize player intuition over
 *     axis precision).
 *   - diagonal-forward-right → "forward-right".
 *   - diagonal-forward-left → "forward-left".
 *
 * Per plan §8.3: "phalanx of 4 advances forward" replaces
 * "8 pawns each move 1 square forward" announcements.
 */

import type { LinearMove } from '../../engine/classified/linear/types';

export type DameoAriaDirection = 'forward' | 'forward-right' | 'forward-left';

/**
 * Map a `LinearMove`'s axis + member positions to a player-facing
 * direction word. Pure function; depends only on the move record.
 */
function describeDirection(move: LinearMove): DameoAriaDirection {
  // The engine's LinearMove may carry `direction` (e.g., 'N', 'NE', 'E', etc.)
  // OR `meta.direction`. Use whichever is present; default to 'forward'.
  const moveAny = move as unknown as {
    direction?: string;
    meta?: { direction?: string };
  };
  const dir = (moveAny.direction ?? moveAny.meta?.direction ?? '').toUpperCase();
  if (dir === 'NE' || dir === 'SE') return 'forward-right';
  if (dir === 'NW' || dir === 'SW') return 'forward-left';
  return 'forward';
}

function pluralize(n: number, singular: string, plural?: string): string {
  if (n === 1) return singular;
  return plural ?? `${singular}s`;
}

/**
 * Generate the ARIA label for a single Dameo move record.
 *
 * Examples:
 *   - "phalanx of 4 advances forward"
 *   - "pawn moves from c3 to c4"
 *   - "pawn captures 1 black pawn from c3 to e5"
 *   - "pawn captures 3 black pawns from c3 to g7, promotes to king"
 */
export function dameoAriaLabel(move: LinearMove): string {
  if (move.kind === 'group-advance') {
    const moveAny = move as unknown as { groupMembers?: readonly string[] };
    const n = moveAny.groupMembers?.length ?? 0;
    const direction = describeDirection(move);
    return `phalanx of ${String(n)} advances ${direction}`;
  }
  if (move.kind === 'capture') {
    const captures = move.capture;
    const count = captures.length;
    const noun = pluralize(count, 'opponent piece', 'opponent pieces');
    const piece = move.piece;
    let label = `${piece} captures ${String(count)} ${noun} from ${move.from} to ${move.to}`;
    if (move.promotion === 'king') {
      label += ', promotes to king';
    }
    return label;
  }
  // 'step' (or unknown kind — fall back to a generic announcement).
  let label = `${move.piece} moves from ${move.from} to ${move.to}`;
  if (move.promotion === 'king') {
    label += ', promotes to king';
  }
  return label;
}
