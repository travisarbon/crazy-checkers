/**
 * Stacking-draughts move generator (Phase 4 Task 29.1).
 *
 * Two public entry points:
 *  - `generateSimpleMoves(state, config)` — non-capturing diagonal steps.
 *  - `generateJumpSequences(state, config)` — full capture-chain enumeration.
 *
 * Both consult the commander (top piece) of every tower, never touching
 * prisoners. Jump chains follow the recursion pattern of Tier 1's
 * `engine/classified/draughts/moveGen.ts`: walk legs, accumulate captured
 * NodeIds, branch on every continuation. Promotion mid-chain (Bashni) lifts
 * the commander's effective kind to `king` for the remainder of the chain
 * (the post-apply state reflects this via the `promotionSquare` meta tag).
 *
 * Maximum-capture filtering (Lasca) selects the chain(s) that capture the
 * most towers. Bashni does NOT prune — players may pick any legal chain.
 */

import type { ClassifiedPiece } from '../state';
import type { ClassifiedGameState } from '../state';
import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type {
  StackingDraughtsConfig,
  StackingMove,
  StackingOwner,
  StackingPieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Direction primitives — diagonal-only for both Lasca and Bashni
// ---------------------------------------------------------------------------

type DiagDir = 'nw' | 'ne' | 'sw' | 'se';
const ALL_DIAG_DIRS: readonly DiagDir[] = Object.freeze(['nw', 'ne', 'sw', 'se'] as const);

const DELTA: Record<DiagDir, readonly [number, number]> = {
  nw: [-1, -1],
  ne: [-1, 1],
  sw: [1, -1],
  se: [1, 1],
};

/** Forward directions for an owner. White moves toward row 0; black toward row size-1. */
function forwardDirsFor(owner: StackingOwner): readonly DiagDir[] {
  return owner === 'white' ? ['nw', 'ne'] : ['sw', 'se'];
}

function inBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function rowOf(node: NodeId, size: number): number {
  return Math.floor((node as unknown as number) / size);
}

function colOf(node: NodeId, size: number): number {
  return (node as unknown as number) % size;
}

function nodeIsPlayable(node: NodeId, size: number, parity: 0 | 1): boolean {
  const r = rowOf(node, size);
  const c = colOf(node, size);
  return (r + c) % 2 === parity;
}

function stepNode(node: NodeId, dir: DiagDir, size: number): NodeId | null {
  const r = rowOf(node, size);
  const c = colOf(node, size);
  const [dr, dc] = DELTA[dir];
  const nr = r + dr;
  const nc = c + dc;
  if (!inBounds(nr, nc, size)) return null;
  return asNodeId(nr * size + nc);
}

function labelOf(node: NodeId, config: StackingDraughtsConfig): string {
  return config.boardGeometry.coordinateLabels.notationOf(node);
}

// ---------------------------------------------------------------------------
// Commander accessors
// ---------------------------------------------------------------------------

function commanderOwnerOf(piece: ClassifiedPiece): StackingOwner | null {
  return piece.owner === 'white' || piece.owner === 'black' ? piece.owner : null;
}

function commanderKindOf(piece: ClassifiedPiece): StackingPieceKind | null {
  return piece.kind === 'man' || piece.kind === 'king' ? piece.kind : null;
}

function reachesPromotionRow(
  landing: NodeId,
  owner: StackingOwner,
  config: StackingDraughtsConfig,
): boolean {
  return rowOf(landing, config.boardSize) === config.promotionRow[owner];
}

// ---------------------------------------------------------------------------
// Simple-move generation
// ---------------------------------------------------------------------------

export function generateSimpleMoves(
  state: ClassifiedGameState,
  config: StackingDraughtsConfig,
): StackingMove[] {
  const turn = (state.turn ?? 'white') as StackingOwner;
  const size = config.boardSize;
  const moves: StackingMove[] = [];

  for (const [nodeId, piece] of state.pieces) {
    const owner = commanderOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = commanderKindOf(piece);
    if (kind === null) continue;

    const dirs = kind === 'king' ? ALL_DIAG_DIRS : forwardDirsFor(owner);
    const flying = kind === 'king' && config.kingType === 'flying';

    for (const dir of dirs) {
      let cur = stepNode(nodeId, dir, size);
      while (cur !== null) {
        if (!nodeIsPlayable(cur, size, config.darkParity)) break;
        if (state.pieces.has(cur)) break;
        moves.push(buildSimpleMove(nodeId, cur, kind, owner, config));
        if (!flying) break;
        cur = stepNode(cur, dir, size);
      }
    }
  }

  return moves;
}

function buildSimpleMove(
  from: NodeId,
  to: NodeId,
  kind: StackingPieceKind,
  owner: StackingOwner,
  config: StackingDraughtsConfig,
): StackingMove {
  const base: StackingMove = {
    kind: 'step',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: kind,
    capture: [],
    meta: {
      owner,
      path: Object.freeze([from as unknown as number, to as unknown as number]),
    },
  };
  if (kind === 'man' && reachesPromotionRow(to, owner, config)) {
    return { ...base, promotion: 'king' };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Jump-chain generation
// ---------------------------------------------------------------------------

interface JumpFrame {
  readonly fromNode: NodeId;
  readonly pieceKind: StackingPieceKind;
  readonly capturedSet: ReadonlySet<NodeId>;
  readonly path: readonly NodeId[];
  readonly captured: readonly NodeId[];
  readonly promotionAt: NodeId | undefined;
}

interface Leg {
  readonly dir: DiagDir;
  readonly victim: NodeId;
  readonly landing: NodeId;
}

export function generateJumpSequences(
  state: ClassifiedGameState,
  config: StackingDraughtsConfig,
): StackingMove[] {
  const turn = (state.turn ?? 'white') as StackingOwner;
  const out: StackingMove[] = [];
  for (const [nodeId, piece] of state.pieces) {
    const owner = commanderOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = commanderKindOf(piece);
    if (kind === null) continue;
    exploreFromOrigin(state, config, nodeId, kind, owner, out);
  }
  return out;
}

function exploreFromOrigin(
  state: ClassifiedGameState,
  config: StackingDraughtsConfig,
  origin: NodeId,
  startKind: StackingPieceKind,
  owner: StackingOwner,
  out: StackingMove[],
): void {
  const root: JumpFrame = {
    fromNode: origin,
    pieceKind: startKind,
    capturedSet: new Set<NodeId>(),
    path: Object.freeze([origin]),
    captured: Object.freeze([]),
    promotionAt: undefined,
  };
  walkChain(state, config, owner, startKind, origin, root, out);
}

function walkChain(
  state: ClassifiedGameState,
  config: StackingDraughtsConfig,
  owner: StackingOwner,
  startKind: StackingPieceKind,
  origin: NodeId,
  frame: JumpFrame,
  out: StackingMove[],
): void {
  const legs = enumerateLegs(state, config, owner, frame, origin);

  if (legs.length === 0) {
    if (frame.captured.length > 0) {
      out.push(buildCaptureMove(owner, startKind, frame, config));
    }
    return;
  }

  for (const leg of legs) {
    const nextCapturedSet = new Set(frame.capturedSet);
    nextCapturedSet.add(leg.victim);

    let nextKind: StackingPieceKind = frame.pieceKind;
    let nextPromotionAt = frame.promotionAt;
    if (
      frame.pieceKind === 'man' &&
      config.midCapturePromotion &&
      reachesPromotionRow(leg.landing, owner, config)
    ) {
      nextKind = 'king';
      if (nextPromotionAt === undefined) nextPromotionAt = leg.landing;
    }

    const nextFrame: JumpFrame = {
      fromNode: leg.landing,
      pieceKind: nextKind,
      capturedSet: nextCapturedSet,
      path: Object.freeze([...frame.path, leg.landing]),
      captured: Object.freeze([...frame.captured, leg.victim]),
      promotionAt: nextPromotionAt,
    };
    walkChain(state, config, owner, startKind, origin, nextFrame, out);
  }
}

function enumerateLegs(
  state: ClassifiedGameState,
  config: StackingDraughtsConfig,
  owner: StackingOwner,
  frame: JumpFrame,
  origin: NodeId,
): readonly Leg[] {
  const size = config.boardSize;
  const legs: Leg[] = [];

  const dirs = legDirsFor(frame.pieceKind, owner, config);
  const flying = frame.pieceKind === 'king' && config.kingType === 'flying';

  for (const dir of dirs) {
    const found = flying
      ? scanFlyingVictim(state, config, frame, dir, owner, origin)
      : scanShortVictim(state, config, frame, dir, owner, origin);
    if (!found) continue;
    const { victim } = found;

    let landing = stepNode(victim, dir, size);
    while (landing !== null) {
      if (!nodeIsPlayable(landing, size, config.darkParity)) break;
      const occupied = state.pieces.has(landing);
      const isOrigin = landing === origin;
      if (occupied && !isOrigin) break;
      legs.push({ dir, victim, landing });
      if (!flying) break;
      landing = stepNode(landing, dir, size);
    }
  }

  return legs;
}

function legDirsFor(
  kind: StackingPieceKind,
  owner: StackingOwner,
  config: StackingDraughtsConfig,
): readonly DiagDir[] {
  if (kind === 'king') return ALL_DIAG_DIRS;
  // Men: forward always; backward iff config allows.
  return config.menCaptureBackward ? ALL_DIAG_DIRS : forwardDirsFor(owner);
}

function scanShortVictim(
  state: ClassifiedGameState,
  config: StackingDraughtsConfig,
  frame: JumpFrame,
  dir: DiagDir,
  owner: StackingOwner,
  origin: NodeId,
): { victim: NodeId } | null {
  const victim = stepNode(frame.fromNode, dir, config.boardSize);
  if (victim === null) return null;
  if (!nodeIsPlayable(victim, config.boardSize, config.darkParity)) return null;
  return validateVictim(state, frame, victim, owner, origin);
}

function scanFlyingVictim(
  state: ClassifiedGameState,
  config: StackingDraughtsConfig,
  frame: JumpFrame,
  dir: DiagDir,
  owner: StackingOwner,
  origin: NodeId,
): { victim: NodeId } | null {
  let cur = stepNode(frame.fromNode, dir, config.boardSize);
  while (cur !== null) {
    if (!nodeIsPlayable(cur, config.boardSize, config.darkParity)) return null;
    if (cur === origin) {
      // Origin square is logically empty during the chain (the mover vacated it).
      cur = stepNode(cur, dir, config.boardSize);
      continue;
    }
    if (state.pieces.has(cur)) {
      // First piece encountered — must be an opponent commander to be a victim;
      // otherwise the ray is blocked by a friend.
      return validateVictim(state, frame, cur, owner, origin);
    }
    cur = stepNode(cur, dir, config.boardSize);
  }
  return null;
}

function validateVictim(
  state: ClassifiedGameState,
  frame: JumpFrame,
  victim: NodeId,
  owner: StackingOwner,
  origin: NodeId,
): { victim: NodeId } | null {
  if (frame.capturedSet.has(victim)) return null;
  // Origin square is empty during a chain even though state.pieces still has
  // it (the mover has not been re-applied). Skip it as a victim candidate.
  if (victim === origin) return null;
  const piece = state.pieces.get(victim);
  if (!piece) return null;
  const victimOwner = commanderOwnerOf(piece);
  if (victimOwner === null) return null;
  if (victimOwner === owner) return null;
  return { victim };
}

function buildCaptureMove(
  owner: StackingOwner,
  startKind: StackingPieceKind,
  frame: JumpFrame,
  config: StackingDraughtsConfig,
): StackingMove {
  const fromId = frame.path[0] as NodeId;
  const toId = frame.path[frame.path.length - 1] as NodeId;
  const captureLabels = frame.captured.map((n) => labelOf(n, config));

  const promoted =
    startKind === 'man' &&
    (frame.promotionAt !== undefined || reachesPromotionRow(toId, owner, config));

  const metaBuilder: {
    owner: StackingOwner;
    promotionSquare?: string;
    path: readonly number[];
  } = {
    owner,
    path: Object.freeze(frame.path.map((n) => n as unknown as number)),
  };
  if (frame.promotionAt !== undefined) {
    metaBuilder.promotionSquare = labelOf(frame.promotionAt, config);
  }
  const meta = metaBuilder as NonNullable<StackingMove['meta']>;

  const move: StackingMove = {
    kind: 'capture',
    from: labelOf(fromId, config),
    to: labelOf(toId, config),
    piece: startKind,
    capture: captureLabels,
    meta,
    ...(promoted ? { promotion: 'king' as const } : {}),
  };
  return move;
}

// ---------------------------------------------------------------------------
// Maximum-capture pruning (Lasca only)
// ---------------------------------------------------------------------------

export function filterMaximumCapture(
  candidates: readonly StackingMove[],
  config: StackingDraughtsConfig,
): readonly StackingMove[] {
  if (!config.maximumCaptureMandatory) return candidates;
  if (candidates.length === 0) return candidates;
  let max = -1;
  for (const m of candidates) {
    if (m.capture.length > max) max = m.capture.length;
  }
  return candidates.filter((m) => m.capture.length === max);
}

// ---------------------------------------------------------------------------
// Top-level legal-move composer
// ---------------------------------------------------------------------------

export function computeLegalMoves(
  state: ClassifiedGameState,
  config: StackingDraughtsConfig,
): readonly StackingMove[] {
  const jumps = generateJumpSequences(state, config);
  const filteredJumps = filterMaximumCapture(jumps, config);
  // Both Lasca and Bashni mandate capture (config.captureObligatory: true);
  // when any capture chain exists, simple steps are suppressed.
  if (filteredJumps.length > 0) {
    return sortMoves(filteredJumps);
  }
  const simple = generateSimpleMoves(state, config);
  return sortMoves(simple);
}

function sortMoves(moves: readonly StackingMove[]): readonly StackingMove[] {
  const copy = [...moves];
  copy.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    if (a.capture.length !== b.capture.length) return b.capture.length - a.capture.length;
    // Lexicographic on captures for full determinism.
    const al = a.capture.join(',');
    const bl = b.capture.join(',');
    return al < bl ? -1 : al > bl ? 1 : 0;
  });
  return copy;
}
