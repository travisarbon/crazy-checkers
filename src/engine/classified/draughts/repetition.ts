/**
 * Tier 1 draughts state-channel helpers (Task 28.2 §7; revised by Task 28.2.1 §4).
 *
 * Maintains four `meta` keys on `ClassifiedGameState` across `applyMove`:
 *   - `kingMoveStreak`: serialized as `Array<[NodeId, number]>`. Each entry
 *     is a king's count of consecutive non-capture moves, keyed by that
 *     king's *current* square. Task 28.2.1 §4 per-king revision: the
 *     counter travels with the king, resets on any capture, and triggers a
 *     "must move a different piece" ineligibility at threshold (Frisian /
 *     Frysk! only). When the owner has only kings remaining, the rule is
 *     suspended.
 *   - `movesSinceCapture`: combined half-move counter, reset on any jump.
 *   - `positionHistoryHash`: bounded list of position hashes for threefold
 *     repetition detection.
 *
 * Also exports draw predicates consumed by `checkGameOver` and the
 * `isKingIneligible` filter consumed by `ParameterizedDraughtsRules`.
 */

import type { NodeId } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { DraughtsMove } from './moveGen';
import type { DraughtsConfig } from './DraughtsConfig';

export const POSITION_HISTORY_WINDOW = 60;

export const META_KING_STREAK = 'kingMoveStreak';
export const META_MOVES_SINCE_CAPTURE = 'movesSinceCapture';
export const META_POSITION_HISTORY = 'positionHistoryHash';

export type KingStreakEntry = readonly [nodeId: number, count: number];

export function getKingStreak(state: ClassifiedGameState): readonly KingStreakEntry[] {
  const raw = state.meta?.[META_KING_STREAK];
  if (!Array.isArray(raw)) return [];
  const entries: KingStreakEntry[] = [];
  for (const item of raw as readonly unknown[]) {
    if (Array.isArray(item) && item.length === 2) {
      const id: unknown = item[0];
      const count: unknown = item[1];
      if (typeof id === 'number' && typeof count === 'number') {
        entries.push([id, count]);
      }
    }
  }
  return entries;
}

export function streakOf(state: ClassifiedGameState, nodeId: NodeId): number {
  const target = nodeId as unknown as number;
  for (const [id, count] of getKingStreak(state)) {
    if (id === target) return count;
  }
  return 0;
}

export function getMovesSinceCapture(state: ClassifiedGameState): number {
  const raw = state.meta?.[META_MOVES_SINCE_CAPTURE];
  return typeof raw === 'number' ? raw : 0;
}

export function getPositionHistory(state: ClassifiedGameState): readonly string[] {
  const raw = state.meta?.[META_POSITION_HISTORY];
  if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) {
    return raw as readonly string[];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

export function hashPosition(state: ClassifiedGameState): string {
  const entries: string[] = [];
  const sorted = [...state.pieces.entries()].sort(
    (a, b) => (a[0] as unknown as number) - (b[0] as unknown as number),
  );
  for (const [nodeId, piece] of sorted) {
    const ownerInitial = piece.owner.charAt(0);
    const kindInitial = piece.kind.charAt(0);
    entries.push(`${String(nodeId as unknown as number)}:${ownerInitial}${kindInitial}`);
  }
  entries.push(`t=${state.turn ?? 'white'}`);
  return entries.join('|');
}

// ---------------------------------------------------------------------------
// Tracker update — called by applyMove
// ---------------------------------------------------------------------------

export interface UpdateTrackerContext {
  readonly fromNodeId: NodeId;
  readonly toNodeId: NodeId;
}

export function updateTracker(
  prev: ClassifiedGameState,
  next: ClassifiedGameState,
  move: DraughtsMove,
  ctx: UpdateTrackerContext,
): ClassifiedGameState {
  const prevStreak = getKingStreak(prev);
  const prevMovesSince = getMovesSinceCapture(prev);
  const prevHistory = getPositionHistory(prev);

  const isCapture = move.kind === 'jump';

  // kingMoveStreak updates (per-king):
  //  - any capture clears all entries;
  //  - a king's non-capture move transfers its counter from `from` to `to`,
  //    incremented by 1;
  //  - a promotion that fires at turn end does NOT seed a counter — a freshly
  //    promoted king enters with an implicit count of 0 (absence == 0).
  let nextStreak: KingStreakEntry[];
  if (isCapture) {
    nextStreak = [];
  } else if (move.piece === 'king' && move.promotion !== 'king') {
    const fromId = ctx.fromNodeId as unknown as number;
    const toId = ctx.toNodeId as unknown as number;
    let carried = 0;
    nextStreak = [];
    for (const [id, count] of prevStreak) {
      if (id === fromId) {
        carried = count;
        continue;
      }
      nextStreak.push([id, count]);
    }
    nextStreak.push([toId, carried + 1]);
  } else {
    // Man move (possibly with promotion) — no-op on the streak table.
    nextStreak = [...prevStreak];
  }

  const nextMovesSince = isCapture ? 0 : prevMovesSince + 1;
  const nextHistory = [...prevHistory, hashPosition(next)].slice(-POSITION_HISTORY_WINDOW);

  const mergedMeta: Record<string, unknown> = {
    ...(next.meta ?? {}),
    [META_KING_STREAK]: nextStreak,
    [META_MOVES_SINCE_CAPTURE]: nextMovesSince,
    [META_POSITION_HISTORY]: nextHistory,
  };
  return { ...next, meta: mergedMeta };
}

// ---------------------------------------------------------------------------
// Per-king ineligibility (Task 28.2.1 §4)
// ---------------------------------------------------------------------------

/**
 * Returns true iff the king at `kingNode` (owned by `state.turn`) has
 * reached its `kingConsecutiveMoveLimit` AND the owner has at least one
 * non-king piece available. Under the "only kings remain" waiver, the rule
 * is suspended and this returns false.
 */
export function isKingIneligible(
  state: ClassifiedGameState,
  config: DraughtsConfig,
  kingNode: NodeId,
): boolean {
  const limit = config.kingConsecutiveMoveLimit;
  if (limit === null) return false;
  if (!ownerHasAnyNonKing(state)) return false;
  return streakOf(state, kingNode) >= limit;
}

function ownerHasAnyNonKing(state: ClassifiedGameState): boolean {
  const turn = state.turn;
  for (const piece of state.pieces.values()) {
    if (piece.owner === turn && piece.kind !== 'king') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Draw predicates
// ---------------------------------------------------------------------------

export function hasThreefoldRepetition(state: ClassifiedGameState): boolean {
  const history = getPositionHistory(state);
  if (history.length === 0) return false;
  const last = history[history.length - 1];
  if (!last) return false;
  let count = 0;
  for (const h of history) {
    if (h === last) count += 1;
    if (count >= 3) return true;
  }
  return false;
}

export const QUIET_GAME_PLY_LIMIT = 80;

export function hasQuietGameDraw(state: ClassifiedGameState): boolean {
  return getMovesSinceCapture(state) >= QUIET_GAME_PLY_LIMIT;
}

// ---------------------------------------------------------------------------
// Material helpers
// ---------------------------------------------------------------------------

export function countPieces(
  state: ClassifiedGameState,
): { readonly white: number; readonly black: number } {
  let white = 0;
  let black = 0;
  for (const piece of state.pieces.values()) {
    if (piece.owner === 'white') white += 1;
    else if (piece.owner === 'black') black += 1;
  }
  return { white, black };
}

export function piecesOfOwner(
  state: ClassifiedGameState,
  owner: 'white' | 'black',
): Array<[NodeId, ClassifiedPiece]> {
  const out: Array<[NodeId, ClassifiedPiece]> = [];
  for (const entry of state.pieces) {
    if (entry[1].owner === owner) out.push(entry);
  }
  return out;
}
