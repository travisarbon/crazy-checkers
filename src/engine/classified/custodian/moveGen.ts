/**
 * Custodian-engine move generator (Phase 4 Task 29.4).
 *
 * Two move kinds:
 *  - `'slide'`: rook-style, any distance along a file or rank, blocked by
 *    any piece (friend or enemy) and by the board edge.
 *  - `'jump'` (Dai Hasami only, when `config.movement.nonCapturingAdjacentJump`):
 *    single jump over an orthogonally adjacent piece (any color) to the
 *    empty square immediately beyond. Single-jump only; never chained.
 *
 * NO capture obligation: the legal-move list is the union of all slides +
 * jumps regardless of whether captures are available. This is a structural
 * difference from draughts-family games (Tier 1, Tasks 29.1/29.2/29.3).
 *
 * Determinism: every output list is sorted by `(kind, fromNodeId, toNodeId)`
 * so the AI worker and main thread enumerate identically.
 */

import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  CustodianConfig,
  CustodianMove,
  CustodianOwner,
  CustodianPieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Direction primitives
// ---------------------------------------------------------------------------

const ORTHO_DELTAS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [-1, 0], // N
  [1, 0], // S
  [0, -1], // W
  [0, 1], // E
]);

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

function pieceOwnerOf(piece: ClassifiedPiece): CustodianOwner | null {
  return piece.owner === 'white' || piece.owner === 'black' ? piece.owner : null;
}

function pieceKindOf(piece: ClassifiedPiece): CustodianPieceKind | null {
  return piece.kind === 'man' || piece.kind === 'king' ? piece.kind : null;
}

function labelOf(node: NodeId, config: CustodianConfig): string {
  return config.boardGeometry.coordinateLabels.notationOf(node);
}

// ---------------------------------------------------------------------------
// Slide moves
// ---------------------------------------------------------------------------

export function generateSlideMoves(
  state: ClassifiedGameState,
  config: CustodianConfig,
): CustodianMove[] {
  const turn = (state.turn ?? 'white') as CustodianOwner;
  const moves: CustodianMove[] = [];
  const size = config.boardSize;

  for (const [nodeId, piece] of state.pieces) {
    const owner = pieceOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = pieceKindOf(piece);
    if (kind === null) continue;

    const r = rowOf(nodeId, size);
    const c = colOf(nodeId, size);
    for (const [dr, dc] of ORTHO_DELTAS) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc, size)) {
        const dest = nodeAt(nr, nc, size);
        if (state.pieces.has(dest)) break;
        moves.push(buildMove('slide', nodeId, dest, kind, owner, config));
        nr += dr;
        nc += dc;
      }
    }
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Non-capturing single-jump (Dai Hasami)
// ---------------------------------------------------------------------------

export function generateJumpMoves(
  state: ClassifiedGameState,
  config: CustodianConfig,
): CustodianMove[] {
  if (!config.movement.nonCapturingAdjacentJump) return [];
  const turn = (state.turn ?? 'white') as CustodianOwner;
  const moves: CustodianMove[] = [];
  const size = config.boardSize;

  for (const [nodeId, piece] of state.pieces) {
    const owner = pieceOwnerOf(piece);
    if (owner !== turn) continue;
    const kind = pieceKindOf(piece);
    if (kind === null) continue;

    const r = rowOf(nodeId, size);
    const c = colOf(nodeId, size);
    for (const [dr, dc] of ORTHO_DELTAS) {
      const adjR = r + dr;
      const adjC = c + dc;
      if (!inBounds(adjR, adjC, size)) continue;
      const adjNode = nodeAt(adjR, adjC, size);
      if (!state.pieces.has(adjNode)) continue; // need a piece to jump over
      const landR = adjR + dr;
      const landC = adjC + dc;
      if (!inBounds(landR, landC, size)) continue;
      const landNode = nodeAt(landR, landC, size);
      if (state.pieces.has(landNode)) continue; // landing must be empty
      moves.push(buildMove('jump', nodeId, landNode, kind, owner, config));
    }
  }

  return moves;
}

function buildMove(
  kind: 'slide' | 'jump',
  from: NodeId,
  to: NodeId,
  pieceKind: CustodianPieceKind,
  owner: CustodianOwner,
  config: CustodianConfig,
): CustodianMove {
  return {
    kind,
    from: labelOf(from, config),
    to: labelOf(to, config),
    piece: pieceKind,
    capture: [],
    meta: {
      owner,
      fromNode: from as unknown as number,
      toNode: to as unknown as number,
    },
  };
}

// ---------------------------------------------------------------------------
// Top-level legal-move composer
// ---------------------------------------------------------------------------

export function computeLegalMoves(
  state: ClassifiedGameState,
  config: CustodianConfig,
): readonly CustodianMove[] {
  // No capture obligation — the union of slides + jumps is always returned.
  const slides = generateSlideMoves(state, config);
  const jumps = generateJumpMoves(state, config);
  return sortMoves([...slides, ...jumps]);
}

function sortMoves(moves: readonly CustodianMove[]): readonly CustodianMove[] {
  const copy = [...moves];
  copy.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    return 0;
  });
  return copy;
}
