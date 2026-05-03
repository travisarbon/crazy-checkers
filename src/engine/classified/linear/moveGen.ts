/**
 * Linear-movement engine move generator (Phase 4 Task 29.2).
 *
 * Three public entry points:
 *  - `generateSimpleMoves(state, config)` — single-piece non-capturing moves
 *    for men (5 forward+sideways directions) and kings (8-direction flying).
 *  - `generateGroupAdvances(state, config)` — phalanx slide moves (men only).
 *  - `generateCaptureMoves(state, config)` — orthogonal man captures + flying
 *    king captures, with chain recursion and deferred victim removal.
 *
 * `computeLegalMoves(state, config)` is the legalisation entry: when any
 * captures exist, the simple + group-advance lists are dropped (capture is
 * obligatory). Capture moves are then pruned to the maximum-capture set
 * (max-mandatory).
 *
 * Determinism: every output list is sorted by `(kind, from, to, direction,
 * captureLength desc, captureLex)` so the AI worker and main thread
 * enumerate identically.
 */

import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  LinearDirection,
  LinearMove,
  LinearMovementConfig,
  LinearOwner,
  LinearPieceKind,
} from './types';
import { ORTHOGONAL_DIRS } from './types';
import { detectPhalanxes, rowOf, stepForward } from './Phalanx';

// ---------------------------------------------------------------------------
// Direction utilities
// ---------------------------------------------------------------------------

/** Mirror white-authored direction set for black: N↔S, NE↔SW, NW↔SE. E/W stay. */
function mirrorForOwner(
  dirs: readonly LinearDirection[],
  owner: LinearOwner,
): readonly LinearDirection[] {
  if (owner === 'white') return dirs;
  return dirs.map(mirror);
}

function mirror(d: LinearDirection): LinearDirection {
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

function commanderOwnerOf(piece: ClassifiedPiece): LinearOwner | null {
  return piece.owner === 'white' || piece.owner === 'black' ? piece.owner : null;
}

function commanderKindOf(piece: ClassifiedPiece): LinearPieceKind | null {
  return piece.kind === 'man' || piece.kind === 'king' ? piece.kind : null;
}

function reachesPromotionRow(
  landing: NodeId,
  owner: LinearOwner,
  config: LinearMovementConfig,
): boolean {
  return rowOf(landing, config.boardSize) === config.promotionRow[owner];
}

function labelOf(node: NodeId, config: LinearMovementConfig): string {
  return config.boardGeometry.coordinateLabels.notationOf(node);
}

// ---------------------------------------------------------------------------
// Simple-move generation
// ---------------------------------------------------------------------------

export function generateSimpleMoves(
  state: ClassifiedGameState,
  config: LinearMovementConfig,
): LinearMove[] {
  const turn = (state.turn ?? 'white') as LinearOwner;
  const moves: LinearMove[] = [];
  const size = config.boardSize;

  for (const [nodeId, piece] of state.pieces) {
    const owner = commanderOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = commanderKindOf(piece);
    if (kind === null) continue;

    if (kind === 'man') {
      const dirs = mirrorForOwner(config.menMovementDirections, owner);
      for (const dir of dirs) {
        const dest = stepForward(nodeId, dir, size);
        if (dest === null) continue;
        if (state.pieces.has(dest)) continue;
        moves.push(buildStepMove(nodeId, dest, kind, owner, dir, config));
      }
    } else {
      // King: flying queen. Walk each of 8 rays.
      const dirs = config.kingMovementDirections;
      for (const dir of dirs) {
        let cur: NodeId | null = stepForward(nodeId, dir, size);
        while (cur !== null) {
          if (state.pieces.has(cur)) break;
          moves.push(buildStepMove(nodeId, cur, kind, owner, dir, config));
          cur = stepForward(cur, dir, size);
        }
      }
    }
  }

  return moves;
}

function buildStepMove(
  from: NodeId,
  to: NodeId,
  kind: LinearPieceKind,
  owner: LinearOwner,
  direction: LinearDirection,
  config: LinearMovementConfig,
): LinearMove {
  const base: LinearMove = {
    kind: 'step',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: kind,
    direction,
    capture: [],
    meta: { owner, path: Object.freeze([from as unknown as number, to as unknown as number]) },
  };
  if (kind === 'man' && reachesPromotionRow(to, owner, config)) {
    return { ...base, promotion: 'king' };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Group-advance generation
// ---------------------------------------------------------------------------

export function generateGroupAdvances(
  state: ClassifiedGameState,
  config: LinearMovementConfig,
): LinearMove[] {
  const turn = (state.turn ?? 'white') as LinearOwner;
  const phalanxes = detectPhalanxes(state as unknown as import('./types').LinearGameState, config, turn);
  const out: LinearMove[] = [];
  const size = config.boardSize;

  for (const phalanx of phalanxes) {
    if (phalanx.members.length < 2) continue; // length-1 phalanxes emit as 'step' moves only.
    const head = phalanx.members[phalanx.members.length - 1] as NodeId;
    const target = phalanx.headTarget;
    if (target === null) continue;
    if (state.pieces.has(target)) continue;

    // Verify the slide doesn't collide: every member's destination square
    // must be on-board AND be either empty in the input state OR currently
    // occupied by another member of THIS phalanx (which is also moving).
    const memberSet = new Set<number>(phalanx.members.map((n) => n as unknown as number));
    let collision = false;
    for (const m of phalanx.members) {
      const dest = stepForward(m, phalanx.direction, size);
      if (dest === null) {
        collision = true;
        break;
      }
      const destIdx = dest as unknown as number;
      if (state.pieces.has(dest) && !memberSet.has(destIdx)) {
        collision = true;
        break;
      }
    }
    if (collision) continue;

    const rear = phalanx.members[0] as NodeId;
    const headPiece = state.pieces.get(head);
    if (!headPiece) continue;
    const ownerHead = commanderOwnerOf(headPiece);
    if (ownerHead === null) continue;

    const headPromotes = reachesPromotionRow(target, turn, config);
    const move: LinearMove = {
      kind: 'group-advance',
      from: labelOf(rear, config),
      to: labelOf(target, config),
      piece: 'man',
      direction: phalanx.direction,
      groupMembers: phalanx.members.map((n) => labelOf(n, config)),
      capture: [],
      meta: {
        owner: turn,
        groupMemberNodes: phalanx.members.map((n) => n as unknown as number),
      },
      ...(headPromotes ? { promotion: 'king' as const } : {}),
    };
    out.push(move);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Capture generation
// ---------------------------------------------------------------------------

interface CaptureFrame {
  readonly fromNode: NodeId;
  readonly capturedSet: ReadonlySet<NodeId>;
  readonly path: readonly NodeId[];
  readonly captured: readonly NodeId[];
  /** Direction of the first leg in this chain — used for the move's direction tag. */
  readonly firstDirection: LinearDirection | null;
}

export function generateCaptureMoves(
  state: ClassifiedGameState,
  config: LinearMovementConfig,
): LinearMove[] {
  const turn = (state.turn ?? 'white') as LinearOwner;
  const out: LinearMove[] = [];
  for (const [nodeId, piece] of state.pieces) {
    const owner = commanderOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = commanderKindOf(piece);
    if (kind === null) continue;

    if (kind === 'man') {
      exploreManChain(state, config, nodeId, owner, out);
    } else {
      exploreKingChain(state, config, nodeId, owner, out);
    }
  }
  return out;
}

function exploreManChain(
  state: ClassifiedGameState,
  config: LinearMovementConfig,
  origin: NodeId,
  owner: LinearOwner,
  out: LinearMove[],
): void {
  const root: CaptureFrame = {
    fromNode: origin,
    capturedSet: new Set(),
    path: Object.freeze([origin]),
    captured: Object.freeze([]),
    firstDirection: null,
  };
  walkManChain(state, config, owner, origin, root, out);
}

function walkManChain(
  state: ClassifiedGameState,
  config: LinearMovementConfig,
  owner: LinearOwner,
  origin: NodeId,
  frame: CaptureFrame,
  out: LinearMove[],
): void {
  const legs = enumerateManLegs(state, config, owner, frame, origin);
  if (legs.length === 0) {
    if (frame.captured.length > 0) {
      out.push(buildCaptureMove(owner, 'man', frame, config));
    }
    return;
  }
  for (const leg of legs) {
    const nextCaptured = new Set(frame.capturedSet);
    nextCaptured.add(leg.victim);
    const nextFrame: CaptureFrame = {
      fromNode: leg.landing,
      capturedSet: nextCaptured,
      path: Object.freeze([...frame.path, leg.landing]),
      captured: Object.freeze([...frame.captured, leg.victim]),
      firstDirection: frame.firstDirection ?? leg.direction,
    };
    walkManChain(state, config, owner, origin, nextFrame, out);
  }
}

interface ManLeg {
  readonly direction: LinearDirection;
  readonly victim: NodeId;
  readonly landing: NodeId;
}

function enumerateManLegs(
  state: ClassifiedGameState,
  config: LinearMovementConfig,
  owner: LinearOwner,
  frame: CaptureFrame,
  origin: NodeId,
): readonly ManLeg[] {
  // Men capture orthogonally (per config.menCaptureDirections). N/S/E/W —
  // direction is direction-symmetric (mirroring is moot for orthogonals),
  // but mirrorForOwner still returns the same set so we keep parity with
  // the rest of the engine.
  const dirs = mirrorForOwner(config.menCaptureDirections, owner);
  const legs: ManLeg[] = [];
  const size = config.boardSize;

  for (const dir of dirs) {
    const victim = stepForward(frame.fromNode, dir, size);
    if (victim === null) continue;
    if (frame.capturedSet.has(victim)) continue;
    if (victim === origin) continue;
    const victimPiece = state.pieces.get(victim);
    if (!victimPiece) continue;
    if (commanderOwnerOf(victimPiece) === owner) continue;
    const landing = stepForward(victim, dir, size);
    if (landing === null) continue;
    if (frame.capturedSet.has(landing)) continue; // already-jumped victim sits there as blocker
    if (landing !== origin && state.pieces.has(landing)) continue;
    legs.push({ direction: dir, victim, landing });
  }
  return legs;
}

function exploreKingChain(
  state: ClassifiedGameState,
  config: LinearMovementConfig,
  origin: NodeId,
  owner: LinearOwner,
  out: LinearMove[],
): void {
  const root: CaptureFrame = {
    fromNode: origin,
    capturedSet: new Set(),
    path: Object.freeze([origin]),
    captured: Object.freeze([]),
    firstDirection: null,
  };
  walkKingChain(state, config, owner, origin, root, out);
}

function walkKingChain(
  state: ClassifiedGameState,
  config: LinearMovementConfig,
  owner: LinearOwner,
  origin: NodeId,
  frame: CaptureFrame,
  out: LinearMove[],
): void {
  const legs = enumerateKingLegs(state, config, owner, frame, origin);
  if (legs.length === 0) {
    if (frame.captured.length > 0) {
      out.push(buildCaptureMove(owner, 'king', frame, config));
    }
    return;
  }
  for (const leg of legs) {
    const nextCaptured = new Set(frame.capturedSet);
    nextCaptured.add(leg.victim);
    const nextFrame: CaptureFrame = {
      fromNode: leg.landing,
      capturedSet: nextCaptured,
      path: Object.freeze([...frame.path, leg.landing]),
      captured: Object.freeze([...frame.captured, leg.victim]),
      firstDirection: frame.firstDirection ?? leg.direction,
    };
    walkKingChain(state, config, owner, origin, nextFrame, out);
  }
}

interface KingLeg {
  readonly direction: LinearDirection;
  readonly victim: NodeId;
  readonly landing: NodeId;
}

function enumerateKingLegs(
  state: ClassifiedGameState,
  config: LinearMovementConfig,
  owner: LinearOwner,
  frame: CaptureFrame,
  origin: NodeId,
): readonly KingLeg[] {
  const dirs = config.kingCaptureDirections;
  const size = config.boardSize;
  const legs: KingLeg[] = [];

  for (const dir of dirs) {
    const found = scanKingVictim(state, frame, origin, dir, owner, size);
    if (!found) continue;
    const { victim } = found;

    let landing: NodeId | null = stepForward(victim, dir, size);
    while (landing !== null) {
      const occupied = state.pieces.has(landing);
      const isOrigin = landing === origin;
      if (occupied && !isOrigin) break;
      if (frame.capturedSet.has(landing)) break;
      legs.push({ direction: dir, victim, landing });
      landing = stepForward(landing, dir, size);
    }
  }

  return legs;
}

function scanKingVictim(
  state: ClassifiedGameState,
  frame: CaptureFrame,
  origin: NodeId,
  dir: LinearDirection,
  owner: LinearOwner,
  size: number,
): { victim: NodeId } | null {
  let cur: NodeId | null = stepForward(frame.fromNode, dir, size);
  while (cur !== null) {
    if (cur === origin) {
      // Origin is logically empty during the chain — pass through.
      cur = stepForward(cur, dir, size);
      continue;
    }
    if (frame.capturedSet.has(cur)) {
      // Already-captured tower sits on the board as a blocker.
      return null;
    }
    if (state.pieces.has(cur)) {
      const piece = state.pieces.get(cur);
      if (!piece) return null;
      const victimOwner = commanderOwnerOf(piece);
      if (victimOwner === null) return null;
      if (victimOwner === owner) return null;
      return { victim: cur };
    }
    cur = stepForward(cur, dir, size);
  }
  return null;
}

function buildCaptureMove(
  owner: LinearOwner,
  startKind: LinearPieceKind,
  frame: CaptureFrame,
  config: LinearMovementConfig,
): LinearMove {
  const fromId = frame.path[0] as NodeId;
  const toId = frame.path[frame.path.length - 1] as NodeId;
  const captureLabels = frame.captured.map((n) => labelOf(n, config));

  const promoted =
    startKind === 'man' && reachesPromotionRow(toId, owner, config);

  // Direction tag: the first leg's direction (threaded through the frame
  // during chain exploration). Defaults to 'N' for the empty-path edge case
  // — unreachable here because `buildCaptureMove` is only called when
  // `frame.captured.length > 0`, which implies `firstDirection` is set.
  const firstDir = frame.firstDirection ?? 'N';

  const meta: LinearMove['meta'] = {
    owner,
    path: Object.freeze(frame.path.map((n) => n as unknown as number)),
  };

  const move: LinearMove = {
    kind: 'capture',
    from: labelOf(fromId, config),
    to: labelOf(toId, config),
    piece: startKind,
    direction: firstDir,
    capture: captureLabels,
    meta,
    ...(promoted ? { promotion: 'king' as const } : {}),
  };
  return move;
}


// ---------------------------------------------------------------------------
// Max-mandatory pruning
// ---------------------------------------------------------------------------

export function filterMaximumCapture(
  candidates: readonly LinearMove[],
  config: LinearMovementConfig,
): readonly LinearMove[] {
  // Dameo always sets `maximumCaptureMandatory: true`. The branch is kept for
  // future Tier 5/9 configs that override the field; current Dameo path
  // never short-circuits.
  void config;
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
  config: LinearMovementConfig,
): readonly LinearMove[] {
  const captures = generateCaptureMoves(state, config);
  const filteredCaptures = filterMaximumCapture(captures, config);
  if (filteredCaptures.length > 0) {
    return sortMoves(filteredCaptures);
  }
  const simple = generateSimpleMoves(state, config);
  const groupAdvances = generateGroupAdvances(state, config);
  return sortMoves([...simple, ...groupAdvances]);
}

function sortMoves(moves: readonly LinearMove[]): readonly LinearMove[] {
  const copy = [...moves];
  copy.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    if (a.direction !== b.direction) return a.direction < b.direction ? -1 : 1;
    if (a.capture.length !== b.capture.length) return b.capture.length - a.capture.length;
    const al = a.capture.join(',');
    const bl = b.capture.join(',');
    return al < bl ? -1 : al > bl ? 1 : 0;
  });
  return copy;
}

// Re-export for downstream consumers / tests.
export { ORTHOGONAL_DIRS };
