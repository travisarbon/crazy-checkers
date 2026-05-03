/**
 * Zobrist hashing for the linear-movement engine (Phase 4 Task 29.2).
 *
 * 64 squares × 4 piece-states (white-man, white-king, black-man, black-king)
 * = 256 entries. Fixed splitmix64 seed mirrors Phase 1 `engine/zobrist.ts`
 * style; reconstructing the table in the AI worker yields identical keys.
 *
 * Repetition tracking lives in `LinearMeta.repetitionTable` as a sorted
 * `[hashHex, count]` tuple list (encoding 64-bit values as 16-char lowercase
 * hex strings to round-trip through the JSON-only ClassifiedGameState meta
 * serializer without precision loss).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { LinearGameId, LinearMovementConfig, LinearOwner } from './types';

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

const SEED_BY_GAME: Record<LinearGameId, bigint> = Object.freeze({
  dameo: 0xda3e0123456789abn,
});

// ---------------------------------------------------------------------------
// Hash tables
// ---------------------------------------------------------------------------

interface HashTable {
  /** Map keyed by `(nodeIdx * 4) + commanderIndex`. */
  readonly squareHashes: ReadonlyMap<number, bigint>;
  readonly sideToMove: bigint;
}

const TABLE_CACHE = new Map<LinearGameId, HashTable>();

function pieceIndex(owner: LinearOwner, kind: 'man' | 'king'): number {
  // 0 = white-man, 1 = white-king, 2 = black-man, 3 = black-king.
  const ownerOffset = owner === 'white' ? 0 : 2;
  const kindOffset = kind === 'man' ? 0 : 1;
  return ownerOffset + kindOffset;
}

function buildTable(config: LinearMovementConfig): HashTable {
  const cached = TABLE_CACHE.get(config.gameId);
  if (cached) return cached;

  const seed = SEED_BY_GAME[config.gameId];
  const next = makeSplitMix64(seed);

  const playable = config.boardGeometry.adjacency.listAllNodes();
  const squareHashes = new Map<number, bigint>();
  // Sort node ids for deterministic table population.
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
  turn: LinearOwner,
  config: LinearMovementConfig,
): bigint {
  const table = buildTable(config);
  let hash = 0n;
  for (const [nodeId, piece] of pieces) {
    if (piece.owner !== 'white' && piece.owner !== 'black') continue;
    if (piece.kind !== 'man' && piece.kind !== 'king') continue;
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
