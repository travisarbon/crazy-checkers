/**
 * Cheskers move generator (Phase 4 Task 29.6).
 *
 * The engine's structural signature is its **dual capture-obligation regime**
 * (per playbook §4.10):
 *  - **Pawn + King**: draughts-style mandatory jump captures with multi-jump
 *    chains. If any Pawn or King has a legal capture, the player MUST move a
 *    Pawn or King AND must take a capture.
 *  - **Bishop + Camel**: chess-style optional displacement captures. They are
 *    only available when no Pawn/King capture exists.
 *
 * Capture-removal semantics for Pawn/King chains: **IMMEDIATE** (default
 * `capturedPieceRemoval: 'immediate'`). Mirrors Tier 1 American Checkers and
 * Task 29.5 Harzdame; differs from Tier 2 siblings 29.2/29.3/29.4 which
 * defer removal to chain end.
 *
 * Determinism: every output list is sorted by `(kind, from, to,
 * capture.length descending, capture lex)`.
 */

import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { DraughtsDirection } from '../draughts/DraughtsConfig';
import type {
  CheskersConfig,
  CheskersMove,
  CheskersMoveKind,
  CheskersOwner,
  CheskersPieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Direction primitives
// ---------------------------------------------------------------------------

const DELTA: Record<DraughtsDirection, readonly [number, number]> = {
  n: [-1, 0],
  s: [1, 0],
  e: [0, 1],
  w: [0, -1],
  nw: [-1, -1],
  ne: [-1, 1],
  sw: [1, -1],
  se: [1, 1],
};

/** Camel (3, 1) leap offsets — 8 destinations per square. */
const CAMEL_OFFSETS_31: readonly (readonly [number, number])[] = Object.freeze([
  [-3, -1], [-3, 1],
  [-1, -3], [-1, 3],
  [1, -3], [1, 3],
  [3, -1], [3, 1],
] as const);

/** Camel (2, 1) knight offsets — 8 destinations per square (config knob). */
const CAMEL_OFFSETS_21: readonly (readonly [number, number])[] = Object.freeze([
  [-2, -1], [-2, 1],
  [-1, -2], [-1, 2],
  [1, -2], [1, 2],
  [2, -1], [2, 1],
] as const);

function rowOf(node: NodeId, size: number): number {
  return Math.floor((node as unknown as number) / size);
}
function colOf(node: NodeId, size: number): number {
  return (node as unknown as number) % size;
}
function inBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}
function nodeAt(r: number, c: number, size: number): NodeId {
  return (r * size + c) as unknown as NodeId;
}
function isDarkSquare(node: NodeId, size: number): boolean {
  const r = rowOf(node, size);
  const c = colOf(node, size);
  return (r + c) % 2 === 1;
}

function pieceOwnerOf(piece: ClassifiedPiece): CheskersOwner | null {
  return piece.owner === 'white' || piece.owner === 'black' ? piece.owner : null;
}

function pieceKindOf(piece: ClassifiedPiece): CheskersPieceKind | null {
  if (piece.kind === 'pawn') return 'pawn';
  if (piece.kind === 'king') return 'king';
  if (piece.kind === 'bishop') return 'bishop';
  if (piece.kind === 'camel') return 'camel';
  return null;
}

function labelOf(node: NodeId, config: CheskersConfig): string {
  return config.boardGeometry.coordinateLabels.notationOf(node);
}

function stepDiag(
  source: NodeId,
  direction: DraughtsDirection,
  size: number,
): NodeId | null {
  const r = rowOf(source, size);
  const c = colOf(source, size);
  const [dr, dc] = DELTA[direction];
  const nr = r + dr;
  const nc = c + dc;
  if (!inBounds(nr, nc, size)) return null;
  const dest = nodeAt(nr, nc, size);
  // Cheskers plays on the dark squares only; reject light-square destinations
  // to keep the generator robust to misuse.
  if (!isDarkSquare(dest, size)) return null;
  return dest;
}

// ---------------------------------------------------------------------------
// Pawn moves
// ---------------------------------------------------------------------------

function generatePawnSteps(
  state: ClassifiedGameState,
  config: CheskersConfig,
  pawnSquares: readonly { node: NodeId; owner: CheskersOwner }[],
): CheskersMove[] {
  const moves: CheskersMove[] = [];
  const size = config.boardSize;
  for (const { node, owner } of pawnSquares) {
    const dirs = config.pawnMovementDirections[owner];
    for (const dir of dirs) {
      const dest = stepDiag(node, dir, size);
      if (dest === null) continue;
      if (state.pieces.has(dest)) continue;
      moves.push(buildPawnStepMove(node, dest, owner, dir, config));
    }
  }
  return moves;
}

function buildPawnStepMove(
  from: NodeId,
  to: NodeId,
  owner: CheskersOwner,
  direction: DraughtsDirection,
  config: CheskersConfig,
): CheskersMove {
  const promotion = computePawnPromotion(to, owner, config);
  const base: CheskersMove = {
    kind: 'pawn-step',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: 'pawn',
    capture: [],
    meta: {
      owner,
      fromNode: from as unknown as number,
      toNode: to as unknown as number,
      path: Object.freeze([from as unknown as number, to as unknown as number]),
      directions: Object.freeze([direction]),
    },
  };
  return promotion === null ? base : { ...base, promotion };
}

function computePawnPromotion(
  to: NodeId,
  owner: CheskersOwner,
  config: CheskersConfig,
): 'king' | 'bishop' | 'camel' | null {
  const r = rowOf(to, config.boardSize);
  const backRank = owner === 'white' ? 0 : config.boardSize - 1;
  if (r !== backRank) return null;
  if (config.pawnPromotion.target === 'king') return 'king';
  // 'choice' — caller is responsible for enumerating multiple promotion options.
  return 'king';
}

function generatePawnPromotionChoices(
  config: CheskersConfig,
): readonly CheskersPieceKind[] {
  if (config.pawnPromotion.target === 'king') return ['king'];
  return config.pawnPromotion.choices;
}

// ---------------------------------------------------------------------------
// King steps
// ---------------------------------------------------------------------------

function generateKingSteps(
  state: ClassifiedGameState,
  config: CheskersConfig,
  kingSquares: readonly { node: NodeId; owner: CheskersOwner }[],
): CheskersMove[] {
  const moves: CheskersMove[] = [];
  const size = config.boardSize;
  for (const { node, owner } of kingSquares) {
    for (const dir of config.kingDirections) {
      const dest = stepDiag(node, dir, size);
      if (dest === null) continue;
      if (state.pieces.has(dest)) continue;
      moves.push({
        kind: 'king-step',
        from: labelOf(node, config),
        to: labelOf(dest, config),
        piece: 'king',
        capture: [],
        meta: {
          owner,
          fromNode: node as unknown as number,
          toNode: dest as unknown as number,
          path: Object.freeze([node as unknown as number, dest as unknown as number]),
          directions: Object.freeze([dir]),
        },
      });
    }
  }
  return moves;
}

// ---------------------------------------------------------------------------
// Bishop slides + displacement captures
// ---------------------------------------------------------------------------

function generateBishopMoves(
  state: ClassifiedGameState,
  config: CheskersConfig,
  bishopSquares: readonly { node: NodeId; owner: CheskersOwner }[],
): CheskersMove[] {
  const moves: CheskersMove[] = [];
  const size = config.boardSize;
  for (const { node, owner } of bishopSquares) {
    for (const dir of config.kingDirections) {
      let cur: NodeId | null = stepDiag(node, dir, size);
      while (cur !== null) {
        const occupant = state.pieces.get(cur);
        if (!occupant) {
          moves.push(buildBishopSlide(node, cur, owner, dir, config));
          cur = stepDiag(cur, dir, size);
          continue;
        }
        // First occupant — if enemy, emit displacement capture; either way, ray ends.
        const occOwner = pieceOwnerOf(occupant);
        if (occOwner !== null && occOwner !== owner) {
          moves.push(buildBishopDisplace(node, cur, owner, dir, config));
        }
        break;
      }
    }
  }
  return moves;
}

function buildBishopSlide(
  from: NodeId,
  to: NodeId,
  owner: CheskersOwner,
  direction: DraughtsDirection,
  config: CheskersConfig,
): CheskersMove {
  return {
    kind: 'bishop-slide',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: 'bishop',
    capture: [],
    meta: {
      owner,
      fromNode: from as unknown as number,
      toNode: to as unknown as number,
      path: Object.freeze([from as unknown as number, to as unknown as number]),
      directions: Object.freeze([direction]),
    },
  };
}

function buildBishopDisplace(
  from: NodeId,
  to: NodeId,
  owner: CheskersOwner,
  direction: DraughtsDirection,
  config: CheskersConfig,
): CheskersMove {
  return {
    kind: 'bishop-displace',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: 'bishop',
    capture: [labelOf(to, config)],
    meta: {
      owner,
      fromNode: from as unknown as number,
      toNode: to as unknown as number,
      path: Object.freeze([from as unknown as number, to as unknown as number]),
      directions: Object.freeze([direction]),
    },
  };
}

// ---------------------------------------------------------------------------
// Camel leaps + displacement captures
// ---------------------------------------------------------------------------

function generateCamelMoves(
  state: ClassifiedGameState,
  config: CheskersConfig,
  camelSquares: readonly { node: NodeId; owner: CheskersOwner }[],
): CheskersMove[] {
  const moves: CheskersMove[] = [];
  const size = config.boardSize;
  const offsets = config.camelLeaper === '(3,1)' ? CAMEL_OFFSETS_31 : CAMEL_OFFSETS_21;
  const requireDark = config.camelLeaper === '(3,1)';
  for (const { node, owner } of camelSquares) {
    const r = rowOf(node, size);
    const c = colOf(node, size);
    for (const offset of offsets) {
      const [dr, dc] = offset;
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc, size)) continue;
      const dest = nodeAt(nr, nc, size);
      if (requireDark && !isDarkSquare(dest, size)) continue;
      const occupant = state.pieces.get(dest);
      if (!occupant) {
        moves.push(buildCamelLeap(node, dest, owner, offset, config));
        continue;
      }
      const occOwner = pieceOwnerOf(occupant);
      if (occOwner !== null && occOwner !== owner) {
        moves.push(buildCamelDisplace(node, dest, owner, offset, config));
      }
      // Friendly on destination → leap blocked, no move emitted.
    }
  }
  return moves;
}

function buildCamelLeap(
  from: NodeId,
  to: NodeId,
  owner: CheskersOwner,
  offset: readonly [number, number],
  config: CheskersConfig,
): CheskersMove {
  return {
    kind: 'camel-leap',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: 'camel',
    capture: [],
    meta: {
      owner,
      fromNode: from as unknown as number,
      toNode: to as unknown as number,
      camelOffset: offset,
    },
  };
}

function buildCamelDisplace(
  from: NodeId,
  to: NodeId,
  owner: CheskersOwner,
  offset: readonly [number, number],
  config: CheskersConfig,
): CheskersMove {
  return {
    kind: 'camel-displace',
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: 'camel',
    capture: [labelOf(to, config)],
    meta: {
      owner,
      fromNode: from as unknown as number,
      toNode: to as unknown as number,
      camelOffset: offset,
    },
  };
}

// ---------------------------------------------------------------------------
// Pawn / King capture chain enumeration (immediate-removal semantics)
// ---------------------------------------------------------------------------

interface CaptureFrame {
  readonly fromNode: NodeId;
  readonly workingPieces: ReadonlyMap<NodeId, ClassifiedPiece>;
  readonly path: readonly NodeId[];
  readonly captured: readonly NodeId[];
  readonly directions: readonly DraughtsDirection[];
  /** True iff the moving piece has been promoted mid-chain. */
  readonly promotedMidChain: boolean;
}

interface CaptureLeg {
  readonly direction: DraughtsDirection;
  readonly victim: NodeId;
  readonly landing: NodeId;
}

function generatePawnCaptures(
  state: ClassifiedGameState,
  config: CheskersConfig,
  pawnSquares: readonly { node: NodeId; owner: CheskersOwner }[],
): CheskersMove[] {
  const out: CheskersMove[] = [];
  for (const { node, owner } of pawnSquares) {
    explorePawnChain(state, config, node, owner, out);
  }
  return out;
}

function generateKingCaptures(
  state: ClassifiedGameState,
  config: CheskersConfig,
  kingSquares: readonly { node: NodeId; owner: CheskersOwner }[],
): CheskersMove[] {
  const out: CheskersMove[] = [];
  for (const { node, owner } of kingSquares) {
    exploreKingChain(state, config, node, owner, out);
  }
  return out;
}

function explorePawnChain(
  state: ClassifiedGameState,
  config: CheskersConfig,
  origin: NodeId,
  owner: CheskersOwner,
  out: CheskersMove[],
): void {
  const workingPieces = new Map<NodeId, ClassifiedPiece>(state.pieces);
  const root: CaptureFrame = {
    fromNode: origin,
    workingPieces,
    path: Object.freeze([origin]),
    captured: Object.freeze([]),
    directions: Object.freeze([]),
    promotedMidChain: false,
  };
  walkPawnChain(config, owner, origin, root, out);
}

function exploreKingChain(
  state: ClassifiedGameState,
  config: CheskersConfig,
  origin: NodeId,
  owner: CheskersOwner,
  out: CheskersMove[],
): void {
  const workingPieces = new Map<NodeId, ClassifiedPiece>(state.pieces);
  const root: CaptureFrame = {
    fromNode: origin,
    workingPieces,
    path: Object.freeze([origin]),
    captured: Object.freeze([]),
    directions: Object.freeze([]),
    promotedMidChain: false,
  };
  walkKingChain(config, owner, origin, root, out);
}

function walkPawnChain(
  config: CheskersConfig,
  owner: CheskersOwner,
  origin: NodeId,
  frame: CaptureFrame,
  out: CheskersMove[],
): void {
  const dirs = frame.promotedMidChain
    ? config.kingDirections
    : config.pawnCaptureDirections[owner];
  const legs = enumerateShortLegs(config, owner, frame, origin, dirs);
  if (legs.length === 0) {
    if (frame.captured.length > 0) {
      out.push(buildPawnOrKingCaptureMove(owner, frame, config));
    }
    return;
  }
  for (const leg of legs) {
    const nextWorking = new Map(frame.workingPieces);
    nextWorking.delete(leg.victim);
    const moverPiece = nextWorking.get(frame.fromNode);
    if (moverPiece) {
      nextWorking.delete(frame.fromNode);
      nextWorking.set(leg.landing, moverPiece);
    }
    // Mid-chain promotion (knob §1.3): if pawn arrives at back rank during
    // chain AND midChainPromotion=true, promote and continue with king dirs.
    let nextPromoted = frame.promotedMidChain;
    if (config.midChainPromotion && !frame.promotedMidChain) {
      const r = rowOf(leg.landing, config.boardSize);
      const backRank = owner === 'white' ? 0 : config.boardSize - 1;
      if (r === backRank) nextPromoted = true;
    }
    const nextFrame: CaptureFrame = {
      fromNode: leg.landing,
      workingPieces: nextWorking,
      path: Object.freeze([...frame.path, leg.landing]),
      captured: Object.freeze([...frame.captured, leg.victim]),
      directions: Object.freeze([...frame.directions, leg.direction]),
      promotedMidChain: nextPromoted,
    };
    walkPawnChain(config, owner, origin, nextFrame, out);
  }
}

function walkKingChain(
  config: CheskersConfig,
  owner: CheskersOwner,
  origin: NodeId,
  frame: CaptureFrame,
  out: CheskersMove[],
): void {
  const legs = enumerateShortLegs(config, owner, frame, origin, config.kingDirections);
  if (legs.length === 0) {
    if (frame.captured.length > 0) {
      out.push(buildKingCaptureMove(owner, frame, config));
    }
    return;
  }
  for (const leg of legs) {
    const nextWorking = new Map(frame.workingPieces);
    nextWorking.delete(leg.victim);
    const moverPiece = nextWorking.get(frame.fromNode);
    if (moverPiece) {
      nextWorking.delete(frame.fromNode);
      nextWorking.set(leg.landing, moverPiece);
    }
    const nextFrame: CaptureFrame = {
      fromNode: leg.landing,
      workingPieces: nextWorking,
      path: Object.freeze([...frame.path, leg.landing]),
      captured: Object.freeze([...frame.captured, leg.victim]),
      directions: Object.freeze([...frame.directions, leg.direction]),
      promotedMidChain: frame.promotedMidChain,
    };
    walkKingChain(config, owner, origin, nextFrame, out);
  }
}

function enumerateShortLegs(
  config: CheskersConfig,
  owner: CheskersOwner,
  frame: CaptureFrame,
  origin: NodeId,
  dirs: readonly DraughtsDirection[],
): readonly CaptureLeg[] {
  const size = config.boardSize;
  const legs: CaptureLeg[] = [];
  for (const dir of dirs) {
    const victim = stepDiag(frame.fromNode, dir, size);
    if (victim === null) continue;
    if (victim === origin) continue;
    const piece = frame.workingPieces.get(victim);
    if (!piece) continue;
    if (pieceOwnerOf(piece) === owner) continue;
    const landing = stepDiag(victim, dir, size);
    if (landing === null) continue;
    const occupied = frame.workingPieces.has(landing);
    const isOrigin = landing === origin;
    if (occupied && !isOrigin) continue;
    legs.push({ direction: dir, victim, landing });
  }
  return legs;
}

function buildPawnOrKingCaptureMove(
  owner: CheskersOwner,
  frame: CaptureFrame,
  config: CheskersConfig,
): CheskersMove {
  // Pawn chain — promotion at terminal arrival if landing on back rank.
  const fromId = frame.path[0] as NodeId;
  const toId = frame.path[frame.path.length - 1] as NodeId;
  const captureLabels = frame.captured.map((n) => labelOf(n, config));
  const meta: CheskersMove['meta'] = {
    owner,
    fromNode: fromId as unknown as number,
    toNode: toId as unknown as number,
    path: Object.freeze(frame.path.map((n) => n as unknown as number)),
    directions: Object.freeze([...frame.directions]),
  };
  // Terminal-arrival promotion: pawn that lands on back rank promotes (per
  // §1.2 default 'king'). Mid-chain promotion (§1.3) becomes a king-jump
  // because the moving piece transitioned during the chain.
  const r = rowOf(toId, config.boardSize);
  const backRank = owner === 'white' ? 0 : config.boardSize - 1;
  const movedAsKing = frame.promotedMidChain;
  const willPromote = !movedAsKing && r === backRank;
  const base: CheskersMove = {
    kind: movedAsKing ? 'king-jump' : 'pawn-jump',
    from: labelOf(fromId, config),
    to: labelOf(toId, config),
    piece: movedAsKing ? 'king' : 'pawn',
    capture: captureLabels,
    meta,
  };
  if (willPromote) {
    return { ...base, promotion: 'king' };
  }
  return base;
}

function buildKingCaptureMove(
  owner: CheskersOwner,
  frame: CaptureFrame,
  config: CheskersConfig,
): CheskersMove {
  const fromId = frame.path[0] as NodeId;
  const toId = frame.path[frame.path.length - 1] as NodeId;
  const captureLabels = frame.captured.map((n) => labelOf(n, config));
  const meta: CheskersMove['meta'] = {
    owner,
    fromNode: fromId as unknown as number,
    toNode: toId as unknown as number,
    path: Object.freeze(frame.path.map((n) => n as unknown as number)),
    directions: Object.freeze([...frame.directions]),
  };
  return {
    kind: 'king-jump',
    from: labelOf(fromId, config),
    to: labelOf(toId, config),
    piece: 'king',
    capture: captureLabels,
    meta,
  };
}

// ---------------------------------------------------------------------------
// Max-capture filter (Pawn/King chains only)
// ---------------------------------------------------------------------------

export function filterMaximumCapture(
  candidates: readonly CheskersMove[],
  config: CheskersConfig,
): readonly CheskersMove[] {
  if (!config.maximumCaptureMandatory) return candidates;
  if (candidates.length === 0) return candidates;
  let max = -1;
  for (const m of candidates) {
    if (m.capture.length > max) max = m.capture.length;
  }
  return candidates.filter((m) => m.capture.length === max);
}

// ---------------------------------------------------------------------------
// Pawn promotion — multi-choice expansion
// ---------------------------------------------------------------------------

function expandPawnPromotionChoices(
  moves: readonly CheskersMove[],
  config: CheskersConfig,
): readonly CheskersMove[] {
  if (config.pawnPromotion.target === 'king') return moves;
  const choices = generatePawnPromotionChoices(config);
  if (choices.length <= 1) return moves;
  const out: CheskersMove[] = [];
  for (const m of moves) {
    if (m.promotion !== undefined && m.piece === 'pawn') {
      for (const choice of choices) {
        if (choice === 'pawn') continue; // never promote to pawn
        out.push({ ...m, promotion: choice });
      }
    } else {
      out.push(m);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Top-level entry point — dual capture-obligation regime
// ---------------------------------------------------------------------------

interface PieceClassification {
  readonly pawns: readonly { node: NodeId; owner: CheskersOwner }[];
  readonly kings: readonly { node: NodeId; owner: CheskersOwner }[];
  readonly bishops: readonly { node: NodeId; owner: CheskersOwner }[];
  readonly camels: readonly { node: NodeId; owner: CheskersOwner }[];
}

function classifyOwnPieces(
  state: ClassifiedGameState,
  turn: CheskersOwner,
): PieceClassification {
  const pawns: { node: NodeId; owner: CheskersOwner }[] = [];
  const kings: { node: NodeId; owner: CheskersOwner }[] = [];
  const bishops: { node: NodeId; owner: CheskersOwner }[] = [];
  const camels: { node: NodeId; owner: CheskersOwner }[] = [];
  for (const [node, piece] of state.pieces) {
    const owner = pieceOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = pieceKindOf(piece);
    if (kind === null) continue;
    switch (kind) {
      case 'pawn':
        pawns.push({ node, owner });
        break;
      case 'king':
        kings.push({ node, owner });
        break;
      case 'bishop':
        bishops.push({ node, owner });
        break;
      case 'camel':
        camels.push({ node, owner });
        break;
    }
  }
  return { pawns, kings, bishops, camels };
}

export function computeLegalMoves(
  state: ClassifiedGameState,
  config: CheskersConfig,
): readonly CheskersMove[] {
  const turn = (state.turn ?? config.startingTurn) as CheskersOwner;
  const cls = classifyOwnPieces(state, turn);

  // Phase 1: Pawn + King captures (mandatory).
  const pawnCaptures = generatePawnCaptures(state, config, cls.pawns);
  const kingCaptures = generateKingCaptures(state, config, cls.kings);
  const mandatoryCaptures = [...pawnCaptures, ...kingCaptures];

  if (mandatoryCaptures.length > 0) {
    const filtered = filterMaximumCapture(mandatoryCaptures, config);
    const expanded = expandPawnPromotionChoices(filtered, config);
    return sortMoves(expanded);
  }

  // Phase 2: no Pawn/King captures — emit all legal moves.
  const pawnSteps = generatePawnSteps(state, config, cls.pawns);
  const kingSteps = generateKingSteps(state, config, cls.kings);
  const bishopMoves = generateBishopMoves(state, config, cls.bishops);
  const camelMoves = generateCamelMoves(state, config, cls.camels);
  const all = [...pawnSteps, ...kingSteps, ...bishopMoves, ...camelMoves];
  const expanded = expandPawnPromotionChoices(all, config);
  return sortMoves(expanded);
}

function moveKindRank(kind: CheskersMoveKind): number {
  // Ordering exists only for stable sort; semantics are not affected.
  switch (kind) {
    case 'bishop-displace':
      return 0;
    case 'bishop-slide':
      return 1;
    case 'camel-displace':
      return 2;
    case 'camel-leap':
      return 3;
    case 'king-jump':
      return 4;
    case 'king-step':
      return 5;
    case 'pawn-jump':
      return 6;
    case 'pawn-step':
      return 7;
  }
}

function sortMoves(moves: readonly CheskersMove[]): readonly CheskersMove[] {
  const copy = [...moves];
  copy.sort((a, b) => {
    const ar = moveKindRank(a.kind);
    const br = moveKindRank(b.kind);
    if (ar !== br) return ar - br;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    if (a.capture.length !== b.capture.length) return b.capture.length - a.capture.length;
    const al = a.capture.join(',');
    const bl = b.capture.join(',');
    if (al !== bl) return al < bl ? -1 : 1;
    const ap = a.promotion ?? '';
    const bp = b.promotion ?? '';
    return ap < bp ? -1 : ap > bp ? 1 : 0;
  });
  return copy;
}

// ---------------------------------------------------------------------------
// Public helpers (also used by applyMove + AI)
// ---------------------------------------------------------------------------

export {
  generatePawnSteps,
  generatePawnCaptures,
  generateKingSteps,
  generateKingCaptures,
  generateBishopMoves,
  generateCamelMoves,
};

/** Position-max chain length for Pawn/King chains; 0 if no capture available. */
export function maxCaptureChainLength(
  state: ClassifiedGameState,
  config: CheskersConfig,
): number {
  const turn = (state.turn ?? config.startingTurn) as CheskersOwner;
  const cls = classifyOwnPieces(state, turn);
  const pawnCaptures = generatePawnCaptures(state, config, cls.pawns);
  const kingCaptures = generateKingCaptures(state, config, cls.kings);
  let max = 0;
  for (const m of pawnCaptures) if (m.capture.length > max) max = m.capture.length;
  for (const m of kingCaptures) if (m.capture.length > max) max = m.capture.length;
  return max;
}
