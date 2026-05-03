/**
 * Phalanx detector for the linear-movement engine (Phase 4 Task 29.2).
 *
 * Pure helper consumed by `moveGen`. Given a state and an active color,
 * enumerates every maximal contiguous line of friendly **men** along ranks,
 * files, and (per Open Question 7) forward diagonals.
 *
 * Kings are explicitly excluded from phalanxes (per playbook §3.4: "linear
 * movement applies only to men, never to kings"). When a king sits in a line
 * of men it BREAKS the run — the men on each side of the king form separate
 * phalanxes.
 *
 * Forward direction:
 *   - White advances toward row 0 (top of board) ⇒ forward = N for ranks/files,
 *     NW or NE for diagonals.
 *   - Black advances toward row 7 (bottom) ⇒ forward = S for ranks/files,
 *     SW or SE for diagonals.
 *
 * The detector does NOT filter by `headTarget` legality — it returns every
 * phalanx including those whose head is blocked or off-board. The move
 * generator decides which become legal `'group-advance'` moves.
 */

import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type { ClassifiedPiece } from '../state';
import type {
  LinearDirection,
  LinearGameState,
  LinearMovementConfig,
  LinearOwner,
} from './types';

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export type PhalanxAxis = 'rank' | 'file' | 'diagonal';

export interface Phalanx {
  readonly axis: PhalanxAxis;
  /** The forward step direction for this phalanx (depends on owner + axis). */
  readonly direction: LinearDirection;
  readonly owner: LinearOwner;
  /** Member NodeIds, ordered rear → head along the forward direction. */
  readonly members: readonly NodeId[];
  /** The square one step forward from the head; null if off-board. */
  readonly headTarget: NodeId | null;
}

export function detectPhalanxes(
  state: LinearGameState,
  config: LinearMovementConfig,
  owner: LinearOwner,
): readonly Phalanx[] {
  const out: Phalanx[] = [];
  const size = config.boardSize;

  for (const axis of config.groupAdvanceAxes) {
    if (axis === 'rank') {
      collectRankPhalanxes(state, size, owner, out);
    } else if (axis === 'file') {
      collectFilePhalanxes(state, size, owner, out);
    } else {
      collectDiagonalPhalanxes(state, size, owner, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Forward-direction helpers
// ---------------------------------------------------------------------------

/** Forward step direction for the given owner + axis (rank vs file vs diagonal). */
function forwardDirection(owner: LinearOwner, axis: PhalanxAxis): LinearDirection {
  if (axis === 'rank' || axis === 'file') {
    return owner === 'white' ? 'N' : 'S';
  }
  // Diagonal: there are two forward diagonals per color. We arbitrarily pick
  // one as the canonical direction tag for the move record; the actual
  // member-to-head walk uses the line's slope to select between NW/NE for
  // white (or SW/SE for black). The canonical tag is overwritten in the
  // diagonal-collection branch.
  return owner === 'white' ? 'NE' : 'SE';
}

function rowOf(node: NodeId, size: number): number {
  return Math.floor((node as unknown as number) / size);
}

function colOf(node: NodeId, size: number): number {
  return (node as unknown as number) % size;
}

/** Returns the destination NodeId after stepping one square forward, or null off-board. */
function stepForward(
  node: NodeId,
  direction: LinearDirection,
  size: number,
): NodeId | null {
  const r = rowOf(node, size);
  const c = colOf(node, size);
  let dr = 0;
  let dc = 0;
  switch (direction) {
    case 'N':
      dr = -1;
      break;
    case 'S':
      dr = 1;
      break;
    case 'E':
      dc = 1;
      break;
    case 'W':
      dc = -1;
      break;
    case 'NE':
      dr = -1;
      dc = 1;
      break;
    case 'NW':
      dr = -1;
      dc = -1;
      break;
    case 'SE':
      dr = 1;
      dc = 1;
      break;
    case 'SW':
      dr = 1;
      dc = -1;
      break;
  }
  const nr = r + dr;
  const nc = c + dc;
  if (nr < 0 || nr >= size || nc < 0 || nc >= size) return null;
  return asNodeId(nr * size + nc);
}

// ---------------------------------------------------------------------------
// Friendly-man predicate
// ---------------------------------------------------------------------------

function isFriendlyMan(piece: ClassifiedPiece | undefined, owner: LinearOwner): boolean {
  if (!piece) return false;
  return piece.owner === owner && piece.kind === 'man';
}

// ---------------------------------------------------------------------------
// Rank phalanxes (horizontal lines along constant row)
// ---------------------------------------------------------------------------

function collectRankPhalanxes(
  state: LinearGameState,
  size: number,
  owner: LinearOwner,
  out: Phalanx[],
): void {
  const direction: LinearDirection = forwardDirection(owner, 'rank');
  // Walk each rank left-to-right; collect maximal friendly-man runs.
  for (let r = 0; r < size; r += 1) {
    let runStart = -1;
    for (let c = 0; c < size; c += 1) {
      const node = asNodeId(r * size + c);
      const piece = state.pieces.get(node);
      if (isFriendlyMan(piece, owner)) {
        if (runStart === -1) runStart = c;
      } else if (runStart !== -1) {
        emitRunOnRank(r, runStart, c - 1, size, direction, owner, out);
        runStart = -1;
      }
    }
    if (runStart !== -1) {
      emitRunOnRank(r, runStart, size - 1, size, direction, owner, out);
    }
  }
}

function emitRunOnRank(
  r: number,
  cStart: number,
  cEnd: number,
  size: number,
  direction: LinearDirection,
  owner: LinearOwner,
  out: Phalanx[],
): void {
  // Members are ordered rear → head along the forward direction.
  // For rank phalanxes (forward = N or S), the rank itself doesn't have a
  // "rear" along the forward axis — every member is on the same row. We
  // canonicalise the order as left-to-right (cStart → cEnd) regardless of
  // owner; the head for `headTarget` purposes is one step forward (N or S),
  // which is the SAME target square for the entire row's worth of members.
  // BUT the move record only carries one head per phalanx — we emit the
  // phalanx with the leftmost member as `from` for replay/animation
  // determinism, and `headTarget` is computed from the leftmost member's row
  // shifted forward by one. The actual move slides all members in lockstep.
  const members: NodeId[] = [];
  for (let c = cStart; c <= cEnd; c += 1) {
    members.push(asNodeId(r * size + c));
  }
  // Rank phalanxes advance perpendicular to the line they occupy. Choose any
  // member's forward step; we'll use the first.
  const headTarget = stepForward(members[0] as NodeId, direction, size);
  out.push({ axis: 'rank', direction, owner, members, headTarget });
}

// ---------------------------------------------------------------------------
// File phalanxes (vertical lines along constant column)
// ---------------------------------------------------------------------------

function collectFilePhalanxes(
  state: LinearGameState,
  size: number,
  owner: LinearOwner,
  out: Phalanx[],
): void {
  const direction: LinearDirection = forwardDirection(owner, 'file');
  // For files, "forward" is along the line itself. Walk from rear to head.
  // White advances toward row 0 (lower index), so for white the rear row is
  // the highest-index row. Black is mirrored.
  const whiteIsBottom = owner === 'white';
  for (let c = 0; c < size; c += 1) {
    collectFileRunsAlongColumn(state, c, size, whiteIsBottom, owner, direction, out);
  }
}

function collectFileRunsAlongColumn(
  state: LinearGameState,
  c: number,
  size: number,
  whiteIsBottom: boolean,
  owner: LinearOwner,
  direction: LinearDirection,
  out: Phalanx[],
): void {
  // Walk rows in rear→head order:
  //   white (advances toward r=0): rear = r=size-1, head = r=0 → iterate r descending.
  //   black (advances toward r=size-1): rear = r=0, head = r=size-1 → iterate r ascending.
  let runStart = -1;
  if (whiteIsBottom) {
    // White: r descending (rear = high r, head = low r).
    for (let r = size - 1; r >= 0; r -= 1) {
      const node = asNodeId(r * size + c);
      const piece = state.pieces.get(node);
      if (isFriendlyMan(piece, owner)) {
        if (runStart === -1) runStart = r;
      } else if (runStart !== -1) {
        // Run was r=runStart (rear) down to r=r+1 (head).
        emitFileRun(c, runStart, r + 1, size, direction, owner, /*reverseOrder=*/ true, out);
        runStart = -1;
      }
    }
    if (runStart !== -1) {
      emitFileRun(c, runStart, 0, size, direction, owner, /*reverseOrder=*/ true, out);
    }
  } else {
    // Black: r ascending (rear = low r, head = high r).
    for (let r = 0; r < size; r += 1) {
      const node = asNodeId(r * size + c);
      const piece = state.pieces.get(node);
      if (isFriendlyMan(piece, owner)) {
        if (runStart === -1) runStart = r;
      } else if (runStart !== -1) {
        emitFileRun(c, runStart, r - 1, size, direction, owner, /*reverseOrder=*/ false, out);
        runStart = -1;
      }
    }
    if (runStart !== -1) {
      emitFileRun(c, runStart, size - 1, size, direction, owner, /*reverseOrder=*/ false, out);
    }
  }
}

function emitFileRun(
  c: number,
  rRear: number,
  rHead: number,
  size: number,
  direction: LinearDirection,
  owner: LinearOwner,
  reverseOrder: boolean,
  out: Phalanx[],
): void {
  // For a file phalanx, members from rear to head along the forward direction.
  const members: NodeId[] = [];
  if (reverseOrder) {
    // White: walk from rear (rRear, high r) to head (rHead, low r), descending.
    for (let r = rRear; r >= rHead; r -= 1) {
      members.push(asNodeId(r * size + c));
    }
  } else {
    for (let r = rRear; r <= rHead; r += 1) {
      members.push(asNodeId(r * size + c));
    }
  }
  const head = members[members.length - 1];
  if (head === undefined) return;
  const headTarget = stepForward(head, direction, size);
  out.push({ axis: 'file', direction, owner, members, headTarget });
}

// ---------------------------------------------------------------------------
// Diagonal phalanxes
// ---------------------------------------------------------------------------

function collectDiagonalPhalanxes(
  state: LinearGameState,
  size: number,
  owner: LinearOwner,
  out: Phalanx[],
): void {
  // Two forward-diagonal directions for each color:
  //   White: NW (dr=-1, dc=-1) and NE (dr=-1, dc=+1)
  //   Black: SW (dr=+1, dc=-1) and SE (dr=+1, dc=+1)
  const forwardDirs: readonly LinearDirection[] =
    owner === 'white' ? ['NW', 'NE'] : ['SW', 'SE'];
  for (const dir of forwardDirs) {
    collectAlongDiagonalDirection(state, size, owner, dir, out);
  }
}

function collectAlongDiagonalDirection(
  state: LinearGameState,
  size: number,
  owner: LinearOwner,
  direction: LinearDirection,
  out: Phalanx[],
): void {
  // For a given forward diagonal direction, enumerate every distinct line.
  // A line is identified by its rear-most (back-most) starting cell — every
  // cell that has no predecessor along the *backward* direction is a line
  // start. Walk forward from each line start, collecting friendly-man runs.
  const reverse = reverseDirection(direction);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const start = asNodeId(r * size + c);
      // Only seed at a cell whose *backward* step is off-board (otherwise the
      // line was already covered from a deeper rear).
      const backOne = stepForward(start, reverse, size);
      if (backOne !== null) continue;
      walkDiagonalLine(state, start, direction, size, owner, out);
    }
  }
}

function reverseDirection(d: LinearDirection): LinearDirection {
  switch (d) {
    case 'N':
      return 'S';
    case 'S':
      return 'N';
    case 'E':
      return 'W';
    case 'W':
      return 'E';
    case 'NE':
      return 'SW';
    case 'NW':
      return 'SE';
    case 'SE':
      return 'NW';
    case 'SW':
      return 'NE';
  }
}

function walkDiagonalLine(
  state: LinearGameState,
  start: NodeId,
  direction: LinearDirection,
  size: number,
  owner: LinearOwner,
  out: Phalanx[],
): void {
  // Walk forward from `start` along `direction`, collecting maximal
  // friendly-man runs. Each run's `members` are ordered rear → head along
  // the forward direction.
  let cur: NodeId | null = start;
  let runMembers: NodeId[] = [];
  while (cur !== null) {
    const piece = state.pieces.get(cur);
    if (isFriendlyMan(piece, owner)) {
      runMembers.push(cur);
    } else {
      flushRun(runMembers, direction, size, owner, out);
      runMembers = [];
    }
    cur = stepForward(cur, direction, size);
  }
  flushRun(runMembers, direction, size, owner, out);
}

function flushRun(
  members: NodeId[],
  direction: LinearDirection,
  size: number,
  owner: LinearOwner,
  out: Phalanx[],
): void {
  if (members.length === 0) return;
  const head = members[members.length - 1] as NodeId;
  const headTarget = stepForward(head, direction, size);
  out.push({ axis: 'diagonal', direction, owner, members: [...members], headTarget });
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { stepForward, rowOf, colOf };
