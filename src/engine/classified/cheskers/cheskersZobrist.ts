/**
 * Zobrist hashing for Cheskers (Phase 4 Task 29.6).
 *
 * 32 dark squares × 8 piece-states (white-pawn, white-king, white-bishop,
 * white-camel, black-pawn, black-king, black-bishop, black-camel) =
 * **256 entries**.
 *
 * This sizing differs from the playbook §5.5 wording "32 × 12 = 384" because
 * the playbook quoted that number assuming the full 6-type chess piece set
 * (pawn, knight, bishop, rook, queen, king). Cheskers uses only 4 piece
 * types (pawn, king, bishop, camel), so the table needs only 32 × 4 × 2 =
 * 256 entries. Documented in `RULES_NOTES.md`.
 *
 * Fixed splitmix64 seed mirrors Phase 1 + Tasks 29.1/29.2/29.3/29.4/29.5.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { CheskersConfig, CheskersOwner, CheskersPieceKind } from './types';

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

const CHESKERS_SEED = 0xc4e5f607182a3b4cn;

// ---------------------------------------------------------------------------
// Hash table
// ---------------------------------------------------------------------------

interface HashTable {
  /** Map keyed by `(nodeIdx * 8) + pieceIndex`. */
  readonly squareHashes: ReadonlyMap<number, bigint>;
  readonly sideToMove: bigint;
}

let TABLE_CACHE: HashTable | null = null;

/**
 * Slot index per piece state:
 *   0 = white-pawn,   1 = white-king,   2 = white-bishop, 3 = white-camel,
 *   4 = black-pawn,   5 = black-king,   6 = black-bishop, 7 = black-camel.
 */
function pieceIndex(owner: CheskersOwner, kind: CheskersPieceKind): number {
  const ownerOffset = owner === 'white' ? 0 : 4;
  switch (kind) {
    case 'pawn':
      return ownerOffset;
    case 'king':
      return ownerOffset + 1;
    case 'bishop':
      return ownerOffset + 2;
    case 'camel':
      return ownerOffset + 3;
  }
}

function buildTable(config: CheskersConfig): HashTable {
  if (TABLE_CACHE) return TABLE_CACHE;

  const next = makeSplitMix64(CHESKERS_SEED);

  const playable = config.boardGeometry.adjacency.listAllNodes();
  const squareHashes = new Map<number, bigint>();
  const sortedIds = [...playable].sort(
    (a, b) => (a as unknown as number) - (b as unknown as number),
  );
  for (const id of sortedIds) {
    const idx = id as unknown as number;
    for (let p = 0; p < 8; p += 1) {
      squareHashes.set(idx * 8 + p, next());
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
  turn: CheskersOwner,
  config: CheskersConfig,
): bigint {
  const table = buildTable(config);
  let hash = 0n;
  for (const [nodeId, piece] of pieces) {
    if (piece.owner !== 'white' && piece.owner !== 'black') continue;
    const kind = piece.kind;
    if (kind !== 'pawn' && kind !== 'king' && kind !== 'bishop' && kind !== 'camel') {
      continue;
    }
    const idx = (nodeId as unknown as number) * 8 + pieceIndex(piece.owner, kind);
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
