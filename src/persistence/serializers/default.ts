/**
 * Task 27.6 — default ClassifiedGameState serializer factory.
 *
 * `createDefaultSerializer(spec)` returns a fully-typed serializer covering
 * every field of `ClassifiedGameState`: `pieces`, `turn`, `plyCount`,
 * `moveHistory`, `hands`, `placementPhase`, `roles`, `meta`. Most Tier 1
 * games and every Tier 3–5 non-bespoke game register this default.
 *
 * Canonical ordering invariants (§2.4):
 *  - `pieces` entries are sorted by numeric `NodeId` so two constructions
 *    of the same state yield byte-identical JSON.
 *  - `hands` entries (pieceId → count) are sorted alphabetically by pieceId.
 *  - `meta` keys are sorted alphabetically at every level.
 */

import type { NodeId } from '../../engine/boardGeometry';
import { asNodeId } from '../../engine/boardGeometry';
import type {
  ClassifiedGameState,
  ClassifiedHands,
  ClassifiedPiece,
  ClassifiedPlacementPhase,
} from '../../engine/classified/state';
import type {
  ClassifiedGameId,
  ClassifiedMove,
  RoleLabels,
} from '../../engine/classified/ClassifiedRuleSet';
import type { GameStateSerializer, JsonValue } from './types';
import { SerializerMetaError, SerializerPieceIdError } from './errors';
import { encodePiece, decodePiece } from './defaultPieces';

export interface DefaultSerializerSpec {
  readonly gameId: ClassifiedGameId;
  /** Authoritative pieceId list — used to validate `hands` keys on round-trip. */
  readonly vocabularyPieceIds: readonly string[];
}

export function createDefaultSerializer(
  spec: DefaultSerializerSpec,
): GameStateSerializer & { readonly gameId: ClassifiedGameId } {
  const { gameId, vocabularyPieceIds } = spec;
  const vocabularySet = new Set(vocabularyPieceIds);

  return {
    gameId,
    version: 1,
    toJSON(state) {
      return encodeState(state, gameId, vocabularySet, vocabularyPieceIds);
    },
    fromJSON(json) {
      return decodeState(json as JsonValue, gameId, vocabularySet, vocabularyPieceIds);
    },
  };
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

function encodeState(
  state: ClassifiedGameState,
  gameId: ClassifiedGameId,
  vocabularySet: ReadonlySet<string>,
  vocabularyList: readonly string[],
): JsonValue {
  const out: Record<string, JsonValue> = {
    pieces: encodePieces(state.pieces),
  };
  if (state.turn !== undefined) out.turn = state.turn;
  if (state.plyCount !== undefined) out.plyCount = state.plyCount;
  if (state.moveHistory !== undefined) {
    out.moveHistory = state.moveHistory.map((m) => encodeMove(m, gameId));
  }
  if (state.hands !== undefined) {
    out.hands = encodeHands(state.hands, gameId, vocabularySet, vocabularyList);
  }
  if (state.placementPhase !== undefined) {
    out.placementPhase = encodePlacementPhase(state.placementPhase);
  }
  if (state.roles !== undefined) {
    out.roles = encodeRoles(state.roles);
  }
  if (state.meta !== undefined) {
    out.meta = encodeMeta(state.meta, gameId);
  }
  return out;
}

function encodePieces(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
): JsonValue {
  const entries: [number, ClassifiedPiece][] = [];
  for (const [nodeId, piece] of pieces.entries()) {
    entries.push([nodeId as number, piece]);
  }
  entries.sort((a, b) => a[0] - b[0]);
  return entries.map(([nodeId, piece]): JsonValue => [nodeId, encodePiece(piece)]);
}

function encodeMove(move: ClassifiedMove, gameId: ClassifiedGameId): JsonValue {
  const out: Record<string, JsonValue> = { kind: move.kind };
  if (move.from !== undefined) out.from = move.from;
  if (move.to !== undefined) out.to = move.to;
  if (move.piece !== undefined) out.piece = move.piece;
  if (move.promotion !== undefined) out.promotion = move.promotion;
  if (move.capture !== undefined) out.capture = [...move.capture];
  if (move.meta !== undefined) {
    out.meta = encodeMeta(move.meta, gameId, 'moveHistory.meta');
  }
  return out;
}

function encodeHands(
  hands: ClassifiedHands,
  gameId: ClassifiedGameId,
  vocabularySet: ReadonlySet<string>,
  vocabularyList: readonly string[],
): JsonValue {
  return {
    white: encodeHandSide(hands.white, gameId, vocabularySet, vocabularyList),
    black: encodeHandSide(hands.black, gameId, vocabularySet, vocabularyList),
  };
}

function encodeHandSide(
  side: ReadonlyMap<string, number>,
  gameId: ClassifiedGameId,
  vocabularySet: ReadonlySet<string>,
  vocabularyList: readonly string[],
): JsonValue {
  const entries: [string, number][] = [...side.entries()];
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return entries.map(([pieceId, count]): JsonValue => {
    if (!vocabularySet.has(pieceId)) {
      throw new SerializerPieceIdError({
        gameId,
        unknownPieceId: pieceId,
        registeredPieceIds: vocabularyList,
      });
    }
    return [pieceId, count];
  });
}

function encodePlacementPhase(p: ClassifiedPlacementPhase): JsonValue {
  return {
    phase: p.phase,
    whiteRemaining: p.whiteRemaining,
    blackRemaining: p.blackRemaining,
  };
}

function encodeRoles(r: RoleLabels): JsonValue {
  const out: Record<string, JsonValue> = {
    whiteRole: r.whiteRole,
    blackRole: r.blackRole,
  };
  if (r.whiteGoal !== undefined) out.whiteGoal = r.whiteGoal;
  if (r.blackGoal !== undefined) out.blackGoal = r.blackGoal;
  return out;
}

function encodeMeta(
  meta: Readonly<Record<string, unknown>>,
  gameId: ClassifiedGameId,
  keyPrefix = 'meta',
): JsonValue {
  const keys = Object.keys(meta).sort();
  const out: Record<string, JsonValue> = {};
  for (const key of keys) {
    out[key] = coerceJson(meta[key], gameId, `${keyPrefix}.${key}`);
  }
  return out;
}

function coerceJson(
  value: unknown,
  gameId: ClassifiedGameId,
  metaKey: string,
): JsonValue {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'boolean' || t === 'string') return value as JsonValue;
  if (t === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new SerializerMetaError({ gameId, metaKey, value });
    }
    return value as number;
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => coerceJson(v, gameId, `${metaKey}[${String(i)}]`));
  }
  if (t === 'object') {
    // Reject non-plain objects: Date, Map, Set, bigint wrappers, typed arrays, etc.
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new SerializerMetaError({ gameId, metaKey, value });
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const nested: Record<string, JsonValue> = {};
    for (const k of keys) {
      nested[k] = coerceJson(obj[k], gameId, `${metaKey}.${k}`);
    }
    return nested;
  }
  throw new SerializerMetaError({ gameId, metaKey, value });
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

function decodeState(
  json: JsonValue,
  gameId: ClassifiedGameId,
  vocabularySet: ReadonlySet<string>,
  vocabularyList: readonly string[],
): ClassifiedGameState {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError('expected state object in default serializer');
  }
  const obj = json as Record<string, JsonValue>;

  const pieces = decodePieces(obj.pieces);
  const out: {
    pieces: ReadonlyMap<NodeId, ClassifiedPiece>;
    turn?: string;
    plyCount?: number;
    moveHistory?: readonly ClassifiedMove[];
    hands?: ClassifiedHands;
    placementPhase?: ClassifiedPlacementPhase;
    roles?: RoleLabels;
    meta?: Readonly<Record<string, unknown>>;
  } = { pieces };

  if (obj.turn !== undefined) {
    if (typeof obj.turn !== 'string') throw new TypeError('turn must be string');
    out.turn = obj.turn;
  }
  if (obj.plyCount !== undefined) {
    if (typeof obj.plyCount !== 'number') throw new TypeError('plyCount must be number');
    out.plyCount = obj.plyCount;
  }
  if (obj.moveHistory !== undefined) {
    if (!Array.isArray(obj.moveHistory)) throw new TypeError('moveHistory must be array');
    out.moveHistory = (obj.moveHistory as readonly JsonValue[]).map((m) => decodeMove(m));
  }
  if (obj.hands !== undefined) {
    out.hands = decodeHands(obj.hands, gameId, vocabularySet, vocabularyList);
  }
  if (obj.placementPhase !== undefined) {
    out.placementPhase = decodePlacementPhase(obj.placementPhase);
  }
  if (obj.roles !== undefined) {
    out.roles = decodeRoles(obj.roles);
  }
  if (obj.meta !== undefined) {
    out.meta = decodeMeta(obj.meta);
  }
  return out;
}

function decodePieces(json: JsonValue | undefined): ReadonlyMap<NodeId, ClassifiedPiece> {
  if (!Array.isArray(json)) {
    throw new TypeError('pieces must be an array of [nodeId, piece] tuples');
  }
  const map = new Map<NodeId, ClassifiedPiece>();
  for (const entry of json as readonly JsonValue[]) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new TypeError('each piece entry must be a [nodeId, piece] tuple');
    }
    const tuple = entry as unknown as readonly [JsonValue, JsonValue];
    const nodeId = tuple[0];
    const pieceJson = tuple[1];
    if (typeof nodeId !== 'number') {
      throw new TypeError('piece entry nodeId must be number');
    }
    map.set(asNodeId(nodeId), decodePiece(pieceJson));
  }
  return map;
}

function decodeMove(json: JsonValue): ClassifiedMove {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError('move entry must be an object');
  }
  const m = json as Record<string, JsonValue>;
  if (typeof m.kind !== 'string') throw new TypeError('move.kind must be string');
  const move: {
    kind: string;
    from?: string;
    to?: string;
    piece?: string;
    promotion?: string;
    capture?: readonly string[];
    meta?: Readonly<Record<string, unknown>>;
  } = { kind: m.kind };
  if (m.from !== undefined) {
    if (typeof m.from !== 'string') throw new TypeError('move.from must be string');
    move.from = m.from;
  }
  if (m.to !== undefined) {
    if (typeof m.to !== 'string') throw new TypeError('move.to must be string');
    move.to = m.to;
  }
  if (m.piece !== undefined) {
    if (typeof m.piece !== 'string') throw new TypeError('move.piece must be string');
    move.piece = m.piece;
  }
  if (m.promotion !== undefined) {
    if (typeof m.promotion !== 'string') throw new TypeError('move.promotion must be string');
    move.promotion = m.promotion;
  }
  if (m.capture !== undefined) {
    if (!Array.isArray(m.capture)) throw new TypeError('move.capture must be array');
    move.capture = m.capture.map((c) => {
      if (typeof c !== 'string') throw new TypeError('move.capture entries must be string');
      return c;
    });
  }
  if (m.meta !== undefined) {
    move.meta = decodeMeta(m.meta);
  }
  return move;
}

function decodeHands(
  json: JsonValue,
  gameId: ClassifiedGameId,
  vocabularySet: ReadonlySet<string>,
  vocabularyList: readonly string[],
): ClassifiedHands {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError('hands must be an object');
  }
  const h = json as Record<string, JsonValue>;
  return {
    white: decodeHandSide(h.white, gameId, vocabularySet, vocabularyList),
    black: decodeHandSide(h.black, gameId, vocabularySet, vocabularyList),
  };
}

function decodeHandSide(
  json: JsonValue | undefined,
  gameId: ClassifiedGameId,
  vocabularySet: ReadonlySet<string>,
  vocabularyList: readonly string[],
): ReadonlyMap<string, number> {
  if (!Array.isArray(json)) {
    throw new TypeError('hand side must be an array of [pieceId, count] tuples');
  }
  const map = new Map<string, number>();
  for (const entry of json as readonly JsonValue[]) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new TypeError('hand entry must be a [pieceId, count] tuple');
    }
    const tuple = entry as unknown as readonly [JsonValue, JsonValue];
    const pieceId = tuple[0];
    const count = tuple[1];
    if (typeof pieceId !== 'string') throw new TypeError('hand pieceId must be string');
    if (typeof count !== 'number') throw new TypeError('hand count must be number');
    if (!vocabularySet.has(pieceId)) {
      throw new SerializerPieceIdError({
        gameId,
        unknownPieceId: pieceId,
        registeredPieceIds: vocabularyList,
      });
    }
    map.set(pieceId, count);
  }
  return map;
}

function decodePlacementPhase(json: JsonValue): ClassifiedPlacementPhase {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError('placementPhase must be an object');
  }
  const p = json as Record<string, JsonValue>;
  const phaseValue = p.phase;
  if (phaseValue !== 'placement' && phaseValue !== 'movement' && phaseValue !== 'flying') {
    throw new TypeError(
      `placementPhase.phase invalid: ${typeof phaseValue === 'string' ? phaseValue : JSON.stringify(phaseValue)}`,
    );
  }
  if (typeof p.whiteRemaining !== 'number' || typeof p.blackRemaining !== 'number') {
    throw new TypeError('placementPhase.whiteRemaining/blackRemaining must be numbers');
  }
  return {
    phase: phaseValue,
    whiteRemaining: p.whiteRemaining,
    blackRemaining: p.blackRemaining,
  };
}

function decodeRoles(json: JsonValue): RoleLabels {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError('roles must be an object');
  }
  const r = json as Record<string, JsonValue>;
  if (typeof r.whiteRole !== 'string' || typeof r.blackRole !== 'string') {
    throw new TypeError('roles.whiteRole/blackRole must be strings');
  }
  const out: { whiteRole: string; blackRole: string; whiteGoal?: string; blackGoal?: string } = {
    whiteRole: r.whiteRole,
    blackRole: r.blackRole,
  };
  if (r.whiteGoal !== undefined) {
    if (typeof r.whiteGoal !== 'string') throw new TypeError('roles.whiteGoal must be string');
    out.whiteGoal = r.whiteGoal;
  }
  if (r.blackGoal !== undefined) {
    if (typeof r.blackGoal !== 'string') throw new TypeError('roles.blackGoal must be string');
    out.blackGoal = r.blackGoal;
  }
  return out;
}

function decodeMeta(json: JsonValue): Readonly<Record<string, unknown>> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError('meta must be an object');
  }
  // The encoder sorts keys and only emits JSON-safe primitives / plain objects /
  // arrays, so the decoded shape is structurally identical to the source.
  return json as Readonly<Record<string, unknown>>;
}
