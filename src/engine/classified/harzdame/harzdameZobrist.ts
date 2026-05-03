/**
 * Zobrist hashing for Harzdame (Phase 4 Task 29.5).
 *
 * 32 dark squares × 6 piece-states (white-man, white-king, white-senior,
 * black-man, black-king, black-senior) = **192 entries**. This exceeds the
 * playbook §5.5 wording (32 × 4 = 128) because the senior-king mechanic
 * (§1.2) requires hashing the senior bit. The deviation is documented in
 * `RULES_NOTES.md`.
 *
 * Even when `seniorKing.enabled === false`, the senior-king table entries
 * are still allocated (~64 extra `bigint` entries; trivial cost) — keeps
 * determinism simple across config flips.
 *
 * Fixed splitmix64 seed mirrors Phase 1 + Tasks 29.1/29.2/29.3/29.4.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { HarzdameConfig, HarzdameOwner } from './types';

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

function makeSplitMix64(seed: bigint): () => bigint {
  let state = seed & 0xffffffffffffffffn;
  return (): bigint => {
    state = (state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    return z & 0xffffffffffffffffn;
  };
}

const HARZDAME_SEED = 0xa1b2c3d4e5f60718n;

// ---------------------------------------------------------------------------
// Hash table
// ---------------------------------------------------------------------------

interface HashTable {
  /** Map keyed by `(nodeIdx * 6) + pieceIndex`. */
  readonly squareHashes: ReadonlyMap<number, bigint>;
  readonly sideToMove: bigint;
}

let TABLE_CACHE: HashTable | null = null;

/**
 * Slot index per piece state:
 *   0 = white-man, 1 = white-king (regular), 2 = white-king (senior),
 *   3 = black-man, 4 = black-king (regular), 5 = black-king (senior).
 */
function pieceIndex(
  owner: HarzdameOwner,
  kind: 'man' | 'king',
  promoted: boolean,
): number {
  const ownerOffset = owner === 'white' ? 0 : 3;
  if (kind === 'man') return ownerOffset;
  return ownerOffset + (promoted ? 2 : 1);
}

function buildTable(config: HarzdameConfig): HashTable {
  if (TABLE_CACHE) return TABLE_CACHE;

  const next = makeSplitMix64(HARZDAME_SEED);

  const playable = config.boardGeometry.adjacency.listAllNodes();
  const squareHashes = new Map<number, bigint>();
  const sortedIds = [...playable].sort(
    (a, b) => (a as unknown as number) - (b as unknown as number),
  );
  for (const id of sortedIds) {
    const idx = id as unknown as number;
    for (let p = 0; p < 6; p += 1) {
      squareHashes.set(idx * 6 + p, next());
    }
  }
  const sideToMove = next();

  TABLE_CACHE = { squareHashes, sideToMove };
  return TABLE_CACHE;
}

// ---------------------------------------------------------------------------
// Hash computation
// ---------------------------------------------------------------------------

export function hashPosition(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  turn: HarzdameOwner,
  config: HarzdameConfig,
): bigint {
  const table = buildTable(config);
  let hash = 0n;
  for (const [nodeId, piece] of pieces) {
    if (piece.owner !== 'white' && piece.owner !== 'black') continue;
    if (piece.kind !== 'man' && piece.kind !== 'king') continue;
    const promoted = piece.promoted === true;
    const idx = (nodeId as unknown as number) * 6 + pieceIndex(piece.owner, piece.kind, promoted);
    const entry = table.squareHashes.get(idx);
    if (entry !== undefined) hash ^= entry;
  }
  if (turn === 'black') hash ^= table.sideToMove;
  return hash;
}

// ---------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------

export function hashToHex(hash: bigint): string {
  return hash.toString(16).padStart(16, '0');
}

export function hexToHash(hex: string): bigint {
  return BigInt(`0x${hex}`);
}

// ---------------------------------------------------------------------------
// Repetition table helpers
// ---------------------------------------------------------------------------

export function incrementRepetition(
  table: readonly (readonly [string, number])[],
  hash: bigint,
): readonly (readonly [string, number])[] {
  const hex = hashToHex(hash);
  const entries = table.map(([h, c]): [string, number] => [h, c]);
  const existing = entries.find((e) => e[0] === hex);
  if (existing) {
    existing[1] += 1;
  } else {
    entries.push([hex, 1]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return Object.freeze(entries.map((e): readonly [string, number] => Object.freeze(e)));
}

export function repetitionCount(
  table: readonly (readonly [string, number])[],
  hash: bigint,
): number {
  const hex = hashToHex(hash);
  for (const [h, c] of table) {
    if (h === hex) return c;
  }
  return 0;
}

// Test seam.
export function _clearHashTableCacheForTests(): void {
  TABLE_CACHE = null;
}
