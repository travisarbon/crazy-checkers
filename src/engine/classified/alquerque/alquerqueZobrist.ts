/**
 * Zobrist hashing for the alquerque-engine (Phase 4 Task 29.3).
 *
 * 81 intersections × 4 piece-states (white-man, white-mullah, black-man,
 * black-mullah) = 324 entries, matching playbook §5.5. Fixed splitmix64
 * seed mirrors Phase 1 `engine/zobrist.ts` style; reconstructing the table
 * in the AI worker yields identical keys.
 *
 * Repetition tracking lives in `AlquerqueMeta.repetitionTable` as a sorted
 * `[hashHex, count]` tuple list (encoding 64-bit values as 16-char lowercase
 * hex strings to round-trip through the JSON-only ClassifiedGameState meta
 * serializer without precision loss).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  AlquerqueConfig,
  AlquerqueGameId,
  AlquerqueOwner,
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

const SEED_BY_GAME: Record<AlquerqueGameId, bigint> = Object.freeze({
  zamma: 0x2a3a4a5a6a7a8a9an,
});

// ---------------------------------------------------------------------------
// Hash tables
// ---------------------------------------------------------------------------

interface HashTable {
  /** Map keyed by `(nodeIdx * 4) + pieceIndex`. */
  readonly squareHashes: ReadonlyMap<number, bigint>;
  readonly sideToMove: bigint;
}

const TABLE_CACHE = new Map<AlquerqueGameId, HashTable>();

function pieceIndex(owner: AlquerqueOwner, kind: 'man' | 'mullah'): number {
  // 0 = white-man, 1 = white-mullah, 2 = black-man, 3 = black-mullah.
  const ownerOffset = owner === 'white' ? 0 : 2;
  const kindOffset = kind === 'man' ? 0 : 1;
  return ownerOffset + kindOffset;
}

function buildTable(config: AlquerqueConfig): HashTable {
  const cached = TABLE_CACHE.get(config.gameId);
  if (cached) return cached;

  const seed = SEED_BY_GAME[config.gameId];
  const next = makeSplitMix64(seed);

  const playable = config.boardGeometry.adjacency.listAllNodes();
  const squareHashes = new Map<number, bigint>();
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

export function hashPosition(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  turn: AlquerqueOwner,
  config: AlquerqueConfig,
): bigint {
  const table = buildTable(config);
  let hash = 0n;
  for (const [nodeId, piece] of pieces) {
    if (piece.owner !== 'white' && piece.owner !== 'black') continue;
    if (piece.kind !== 'man' && piece.kind !== 'mullah') continue;
    const idx = (nodeId as unknown as number) * 4 + pieceIndex(piece.owner, piece.kind);
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

// Test seam: clears the table cache so seed determinism can be re-asserted.
export function _clearHashTableCacheForTests(): void {
  TABLE_CACHE.clear();
}
