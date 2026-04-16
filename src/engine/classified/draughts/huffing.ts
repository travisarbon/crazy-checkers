/**
 * Huffing (Task 28.2 §6.2, mechanism enum upgrade per Task 28.1.2).
 *
 * Implements the Malaysian-style huffing rule family: after a mover plays
 * a simple move while at least one of their pieces had a legal jump, the
 * opposing side invokes the variant's huffing penalty. The concrete
 * penalty is chosen by `config.huffingMechanism`:
 *
 *  - `'self-piece-forfeit'` — the mover forfeits the piece that *should*
 *    have captured (Malaysian Checkers). The controller picks that piece
 *    from `findHuffingCandidates` and calls `applyHuff`.
 *  - `'opponent-chooses'` — the opponent selects which of the mover's
 *    pieces to remove. Mechanically identical to self-piece-forfeit at
 *    the engine level; only the UI selection differs.
 *  - `'immediate-loss'` — there is no piece removal; `applyHuff` rejects
 *    the call. `checkGameOver` should return a loss via the next-turn
 *    legal-move path instead. (Not used by any Tier 1 variant.)
 *  - `'none'` — no huffing rule. Both hooks are no-ops / errors.
 *
 * The engine exposes this as a query: `findHuffingCandidates(state,
 * config)` returns every node of the active player's colour that *had* a
 * jump at the most-recent pre-move state. The huff itself is consummated
 * via `applyHuff(state, nodeId, config)`.
 */

import type { NodeId } from '../../boardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { DraughtsConfig } from './DraughtsConfig';
import { hasHuffing } from './DraughtsConfig';
import { exploreJumps } from './moveGen';

/**
 * Returns every piece of `prevState.turn`'s colour that had a legal jump
 * available in `prevState`. Intended for the case where the player chose a
 * simple move under a huffing mechanism; the opponent (or the engine, for
 * `'self-piece-forfeit'`) may remove any one of these.
 */
export function findHuffingCandidates(
  prevState: ClassifiedGameState,
  config: DraughtsConfig,
): readonly NodeId[] {
  if (!hasHuffing(config)) return [];
  const turn = prevState.turn ?? 'white';
  const out: NodeId[] = [];
  for (const [nodeId, piece] of prevState.pieces) {
    if (piece.owner !== turn) continue;
    if (hasAnyJump(prevState, config, nodeId, piece)) {
      out.push(nodeId);
    }
  }
  return out;
}

function hasAnyJump(
  state: ClassifiedGameState,
  config: DraughtsConfig,
  fromNode: NodeId,
  piece: ClassifiedPiece,
): boolean {
  const tree = exploreJumps(state, config, fromNode, piece);
  return tree.children.length > 0;
}

/**
 * Applies a huff: removes the nominated piece and appends a `kind: 'huff'`
 * sentinel move to `moveHistory`. Does not flip `turn` nor increment
 * `plyCount` — a huff is an *adjustment*, not a move.
 *
 * Delegates to the mechanism switch (Task 28.1.2): both the
 * `'self-piece-forfeit'` and `'opponent-chooses'` mechanisms produce the
 * same on-board transformation (remove the nominated piece); the
 * difference is purely which piece the caller selected.
 * `'immediate-loss'` rejects the call — its consequence is a loss, not a
 * piece removal, and is surfaced via `checkGameOver`.
 */
export function applyHuff(
  state: ClassifiedGameState,
  huffedNode: NodeId,
  config: DraughtsConfig,
): ClassifiedGameState {
  switch (config.huffingMechanism) {
    case 'self-piece-forfeit':
    case 'opponent-chooses':
      return removeHuffedPiece(state, huffedNode, config);
    case 'immediate-loss':
      throw new Error(
        `[${config.gameId}] applyHuff rejected: 'immediate-loss' mechanism has no piece-removal; game ends via checkGameOver`,
      );
    case 'none':
      throw new Error(
        `[${config.gameId}] applyHuff invoked on a config without a huffing mechanism`,
      );
  }
}

function removeHuffedPiece(
  state: ClassifiedGameState,
  huffedNode: NodeId,
  config: DraughtsConfig,
): ClassifiedGameState {
  const piece = state.pieces.get(huffedNode);
  if (!piece) {
    throw new Error(
      `[${config.gameId}] applyHuff: no piece at node ${String(huffedNode)}`,
    );
  }
  const newPieces = new Map(state.pieces);
  newPieces.delete(huffedNode);
  const label = config.boardGeometry.coordinateLabels.notationOf(huffedNode);
  const history = state.moveHistory ?? [];
  return {
    ...state,
    pieces: newPieces,
    moveHistory: [...history, { kind: 'huff', to: label, capture: [] }],
  };
}
