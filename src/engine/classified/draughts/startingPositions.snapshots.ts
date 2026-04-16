/**
 * Hand-authored authoritative snapshots of Tier 1 starting positions.
 *
 * Each snapshot is an ordered list of `[nodeId, owner]` pairs sorted by
 * `nodeId`. These numbers are derived from the (row, col) → `row*size + col`
 * convention used by `src/engine/boardGeometry.ts::squareGeometry`. A square
 * `(r, c)` is "dark" iff `(r + c) % 2 === 1`.
 *
 * The snapshots are the **acceptance anchor** for Task 28.1. Any change that
 * breaks them requires a Tier 1 Playbook review and Task 28.1 amendment. Two
 * contributors must sign off on any edit.
 *
 * Reference source: Phase 4 Tier 1 Classified Playbook v1.1 §4.1..§4.10.
 */

import type { DraughtsGameId } from './DraughtsConfig';

export type Owner = 'white' | 'black';
export interface SnapshotEntry {
  readonly nodeId: number;
  readonly owner: Owner;
}

export type StartingPositionSnapshot = readonly SnapshotEntry[];

// ---------------------------------------------------------------------------
// Snapshot builders — mechanically constructed so reviewers can verify the
// enumeration against the playbook diagrams without hand-counting 60+ squares.
// A single `buildDarkBandSnapshot(size, rows, owner)` call is equivalent to
// "place an owner's men on the dark squares of the named rows".
// ---------------------------------------------------------------------------

function buildDarkBandEntries(
  size: number,
  rowStart: number,
  rowEnd: number,
  owner: Owner,
): SnapshotEntry[] {
  const entries: SnapshotEntry[] = [];
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if ((r + c) % 2 !== 1) continue;
      entries.push({ nodeId: r * size + c, owner });
    }
  }
  return entries;
}

function buildFullBandEntries(
  size: number,
  rowStart: number,
  rowEnd: number,
  owner: Owner,
): SnapshotEntry[] {
  const entries: SnapshotEntry[] = [];
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = 0; c < size; c += 1) {
      entries.push({ nodeId: r * size + c, owner });
    }
  }
  return entries;
}

function compose(...chunks: SnapshotEntry[][]): StartingPositionSnapshot {
  const flat: SnapshotEntry[] = [];
  for (const c of chunks) flat.push(...c);
  flat.sort((a, b) => a.nodeId - b.nodeId);
  return Object.freeze(flat.map((e) => Object.freeze(e)));
}

// 8×8 dark-squares, 3 rows per side — Russian, Brazilian, Italian
const SNAPSHOT_8_DARK_3 = compose(
  buildDarkBandEntries(8, 0, 2, 'black'),
  buildDarkBandEntries(8, 5, 7, 'white'),
);

// 10×10 dark-squares, 4 rows per side — International, Frisian
const SNAPSHOT_10_DARK_4 = compose(
  buildDarkBandEntries(10, 0, 3, 'black'),
  buildDarkBandEntries(10, 6, 9, 'white'),
);

// 12×12 dark-squares, 5 rows per side — Malaysian, Canadian
const SNAPSHOT_12_DARK_5 = compose(
  buildDarkBandEntries(12, 0, 4, 'black'),
  buildDarkBandEntries(12, 7, 11, 'white'),
);

// 10×10 dark-squares, back-row only — Frysk!
const SNAPSHOT_10_DARK_BACK = compose(
  buildDarkBandEntries(10, 0, 0, 'black'),
  buildDarkBandEntries(10, 9, 9, 'white'),
);

// 8×8 full-board, rows 1,2 & 5,6 — Armenian, Turkish
const SNAPSHOT_8_FULL_23 = compose(
  buildFullBandEntries(8, 1, 2, 'black'),
  buildFullBandEntries(8, 5, 6, 'white'),
);

export const STARTING_POSITION_SNAPSHOTS: Readonly<
  Record<DraughtsGameId, StartingPositionSnapshot>
> = Object.freeze({
  'russian-draughts': SNAPSHOT_8_DARK_3,
  'brazilian-draughts': SNAPSHOT_8_DARK_3,
  'italian-draughts': SNAPSHOT_8_DARK_3,
  'international-checkers': SNAPSHOT_10_DARK_4,
  frysk: SNAPSHOT_10_DARK_BACK,
  'frisian-draughts': SNAPSHOT_10_DARK_4,
  'malaysian-checkers': SNAPSHOT_12_DARK_5,
  'canadian-draughts': SNAPSHOT_12_DARK_5,
  'armenian-draughts': SNAPSHOT_8_FULL_23,
  'turkish-draughts': SNAPSHOT_8_FULL_23,
});
