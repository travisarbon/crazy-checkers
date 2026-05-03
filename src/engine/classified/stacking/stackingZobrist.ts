/**
 * Zobrist hashing for stacking-draughts (Phase 4 Task 29.1).
 *
 * Per Tier 2 Playbook §5.5 we hash **commanders only** — prisoners are
 * intentionally ignored. This is an approximation: two positions with
 * identical commanders but different prisoner stacks collide. The trade-off
 * is bounded table size (a tower of height 16 with 4 piece states would
 * otherwise explode the table to 4^16 ≈ 4 billion entries per square).
 *
 * Hash table sized for `playableSquares × 4` (commander color × kind).
 * Lasca: 25 × 4 = 100 entries. Bashni: 32 × 4 = 128 entries. The PRNG seed
 * is fixed (splitmix64 with 0x9E3779B97F4A7C15 increment), matching the
 * Phase 1 `engine/zobrist.ts` style so worker-side hash reconstruction is
 * deterministic.
 *
 * Repetition tracking lives in `StackingMeta.repetitionTable` as a sorted
 * `[hashHex, count]` tuple list (encoding 64-bit values as 16-char lowercase
 * hex strings to round-trip through the JSON-only ClassifiedGameState meta
 * serializer without precision loss).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  StackingDraughtsConfig,
  StackingGameId,
  StackingOwner,
} from './types';

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

// Distinct seeds per game so a Lasca position's hash never coincides with
// a Bashni position's hash (no concrete consumer mixes the two, but the
// separation is cheap and prevents accidental collisions).
const SEED_BY_GAME: Record<StackingGameId, bigint> = Object.freeze({
  lasca: 0x1ac5cab4ec4e2517n,
  bashni: 0xba51710b1735cef0n,
});

// ---------------------------------------------------------------------------
// Hash tables
// ---------------------------------------------------------------------------

interface HashTable {
  /** Map keyed by `(nodeIdx * 4) + commanderIndex`. */
  readonly squareHashes: ReadonlyMap<number, bigint>;
  readonly sideToMove: bigint;
}

const TABLE_CACHE = new Map<StackingGameId, HashTable>();

function commanderIndex(owner: StackingOwner, kind: 'man' | 'king'): number {
  // 0 = white-man, 1 = white-king, 2 = black-man, 3 = black-king.
  const ownerOffset = owner === 'white' ? 0 : 2;
  const kindOffset = kind === 'man' ? 0 : 1;
  return ownerOffset + kindOffset;
}

function buildTable(config: StackingDraughtsConfig): HashTable {
  const cached = TABLE_CACHE.get(config.gameId);
  if (cached) return cached;

  const seed = SEED_BY_GAME[config.gameId];
  const next = makeSplitMix64(seed);

  const playable = config.boardGeometry.adjacency.listAllNodes();
  const squareHashes = new Map<number, bigint>();
  // Sort node ids for deterministic table population irrespective of
  // listAllNodes' internal ordering.
  const sortedIds = [...playable].sort(
    (a, b) => (a as unknown as number) - (b as unknown as number),
  );
  for (const id of sortedIds) {
    const idx = id as unknown as number;
    for (let p = 0; p < 4; p += 1) {
      squareHashes.set(idx * 4 + p, next());
    }
  }
  const sideToMove = next();

  const table: HashTable = { squareHashes, sideToMove };
  TABLE_CACHE.set(config.gameId, table);
  return table;
}

// ---------------------------------------------------------------------------
// Hash computation
// ---------------------------------------------------------------------------

/**
 * Compute the Zobrist key for a position. Only the commander (`piece.kind` and
 * `piece.owner`) at each square contributes — prisoners in `piece.stack` are
 * deliberately ignored (see playbook §5.5 and `RULES_NOTES.md`).
 */
export function hashPosition(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  turn: StackingOwner,
  config: StackingDraughtsConfig,
): bigint {
  const table = buildTable(config);
  let hash = 0n;
  for (const [nodeId, piece] of pieces) {
    if (piece.owner !== 'white' && piece.owner !== 'black') continue;
    if (piece.kind !== 'man' && piece.kind !== 'king') continue;
    const owner = piece.owner;
    const kind = piece.kind;
    const idx = (nodeId as unknown as number) * 4 + commanderIndex(owner, kind);
    const entry = table.squareHashes.get(idx);
    if (entry !== undefined) hash ^= entry;
  }
  if (turn === 'black') hash ^= table.sideToMove;
  return hash;
}

/** Hex string encoder used by the repetition table. */
export function hashToHex(hash: bigint): string {
  return hash.toString(16).padStart(16, '0');
}

export function hexToHash(hex: string): bigint {
  return BigInt(`0x${hex}`);
}

/**
 * Increment the count for `hash` in a sorted `[hex, count]` tuple list.
 * Returns a fresh array — input is never mutated.
 */
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

/** Lookup helper. Returns 0 if `hash` has never been seen. */
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

// Test seam: clears the table cache so seed determinism can be re-asserted
// across module reloads in unit tests.
export function _clearHashTableCacheForTests(): void {
  TABLE_CACHE.clear();
}
