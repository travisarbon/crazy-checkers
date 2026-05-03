/**
 * Immutable tower (stack) helpers (Phase 4 Task 29.1).
 *
 * Every helper is pure — input towers are never mutated, and every transform
 * returns a freshly allocated array. The bottom-first array convention is
 * documented in `types.ts` and `RULES_NOTES.md`.
 *
 * Towers are also bridged into `ClassifiedPiece` via the `stack?:
 * readonly ClassifiedPiece[]` field. The bridge functions in this module
 * keep the commander mirrored at `ClassifiedPiece.{owner,kind}` so existing
 * renderers, the default Cogitate adapter, and the default serializer can
 * consume the top piece without inspecting `stack`.
 */

import type { ClassifiedPiece } from '../state';
import type {
  StackState,
  StackingOwner,
  StackingPiece,
  StackingPieceKind,
} from './types';

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function makeStack(pieces: readonly StackingPiece[]): StackState {
  if (pieces.length === 0) {
    throw new Error('[StackState] makeStack: tower must contain at least one piece');
  }
  return { pieces: Object.freeze([...pieces]) };
}

/** Tower of height 1 with the given commander — the starting-position case. */
export function singletonStack(
  owner: StackingOwner,
  kind: StackingPieceKind = 'man',
): StackState {
  return makeStack([{ owner, kind }]);
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export function stackHeight(stack: StackState): number {
  return stack.pieces.length;
}

export function topPieceOf(stack: StackState): StackingPiece {
  const top = stack.pieces[stack.pieces.length - 1];
  if (top === undefined) {
    throw new Error('[StackState] topPieceOf: empty stack is invalid');
  }
  return top;
}

export function ownerOfTopOf(stack: StackState): StackingOwner {
  return topPieceOf(stack).owner;
}

export function kindOfTopOf(stack: StackState): StackingPieceKind {
  return topPieceOf(stack).kind;
}

// ---------------------------------------------------------------------------
// Transforms (return fresh arrays)
// ---------------------------------------------------------------------------

/**
 * Lift the commander off the top of a stack. Returns the lifted piece and
 * the remaining tower, or `null` for the remainder if the source had only
 * one piece (the square should then be deleted from the pieces map).
 */
export function liftCommander(stack: StackState): {
  readonly lifted: StackingPiece;
  readonly remainder: StackState | null;
} {
  const top = topPieceOf(stack);
  if (stack.pieces.length === 1) {
    return { lifted: top, remainder: null };
  }
  const remainderPieces = stack.pieces.slice(0, -1);
  return {
    lifted: top,
    remainder: { pieces: Object.freeze(remainderPieces) },
  };
}

/**
 * Attach a freshly-captured prisoner to the bottom of the capturing tower.
 * Bottom-first ⇒ the new prisoner becomes `pieces[0]`, pushing existing
 * prisoners + the commander up by one index.
 */
export function attachPrisoner(stack: StackState, prisoner: StackingPiece): StackState {
  return { pieces: Object.freeze([prisoner, ...stack.pieces]) };
}

/**
 * Replace the commander's kind (used for promotion). The owner is unchanged.
 * Throws if `kind` is the same as the current commander's kind to surface
 * accidental no-op promotions in callers.
 */
export function replaceCommanderKind(
  stack: StackState,
  kind: StackingPieceKind,
): StackState {
  const top = topPieceOf(stack);
  if (top.kind === kind) {
    throw new Error(
      `[StackState] replaceCommanderKind: commander already has kind '${kind}'`,
    );
  }
  const newTop: StackingPiece = { owner: top.owner, kind };
  const newPieces = stack.pieces.slice(0, -1);
  newPieces.push(newTop);
  return { pieces: Object.freeze(newPieces) };
}

// ---------------------------------------------------------------------------
// ClassifiedPiece bridge
// ---------------------------------------------------------------------------

/**
 * Convert a tower into a `ClassifiedPiece` for the shared Phase 4 piece map.
 * Mirrors the commander into `{owner, kind}` so renderers and Cogitate
 * adapters that ignore the stack still get a coherent top-piece view.
 */
export function toClassifiedPiece(stack: StackState): ClassifiedPiece {
  const top = topPieceOf(stack);
  return Object.freeze({
    owner: top.owner,
    kind: top.kind,
    stack: Object.freeze(stack.pieces.map((p): ClassifiedPiece => Object.freeze({ owner: p.owner, kind: p.kind }))),
  });
}

/**
 * Read a tower out of a `ClassifiedPiece`. If `stack` is missing, treats the
 * piece as a height-1 tower carrying its top metadata.
 */
export function fromClassifiedPiece(piece: ClassifiedPiece): StackState {
  const layered = piece.stack;
  if (layered === undefined || layered.length === 0) {
    if (piece.owner !== 'white' && piece.owner !== 'black') {
      throw new Error(
        `[StackState] fromClassifiedPiece: invalid owner '${piece.owner}' on bare piece`,
      );
    }
    if (piece.kind !== 'man' && piece.kind !== 'king') {
      throw new Error(
        `[StackState] fromClassifiedPiece: invalid kind '${piece.kind}' on bare piece`,
      );
    }
    return singletonStack(piece.owner as StackingOwner, piece.kind as StackingPieceKind);
  }
  const pieces = layered.map((p): StackingPiece => {
    if (p.owner !== 'white' && p.owner !== 'black') {
      throw new Error(
        `[StackState] fromClassifiedPiece: invalid owner '${p.owner}' in stack layer`,
      );
    }
    if (p.kind !== 'man' && p.kind !== 'king') {
      throw new Error(
        `[StackState] fromClassifiedPiece: invalid kind '${p.kind}' in stack layer`,
      );
    }
    return { owner: p.owner, kind: p.kind };
  });
  return makeStack(pieces);
}

// ---------------------------------------------------------------------------
// Equality
// ---------------------------------------------------------------------------

export function stacksEqual(a: StackState, b: StackState): boolean {
  if (a === b) return true;
  if (a.pieces.length !== b.pieces.length) return false;
  for (let i = 0; i < a.pieces.length; i += 1) {
    const pa = a.pieces[i];
    const pb = b.pieces[i];
    if (!pa || !pb) return false;
    if (pa.owner !== pb.owner || pa.kind !== pb.kind) return false;
  }
  return true;
}
