// TESTING ONLY — Task 27.4 Tier 0 fixture.
//
// Minimal ClassifiedRuleSet that exercises the registration pipeline
// end-to-end. Uses a simplified checkers-like representation on an 8×8
// dark-squares-only square grid. Not a playable game: `getLegalMoves`
// returns an empty array, `applyMove` is identity, `checkGameOver` returns
// null. The goal is coverage of the registration surface, not gameplay.

import type { BoardGeometry, NodeId } from '../../boardGeometry';
import { squareGeometry, darkSquaresOnly, asNodeId } from '../../boardGeometry';
import type {
  ClassifiedRuleSet,
  ClassifiedGameId,
  GameStateSerializer,
} from '../ClassifiedRuleSet';
import { asClassifiedGameId } from '../ClassifiedRuleSet';
import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import { DRAUGHTS_PIECE_VOCABULARY } from '../pieceVocabulary';

export const TEST_CHECKERS_CLONE_ID: ClassifiedGameId =
  asClassifiedGameId('classified-test-tier-0');

const geometry: BoardGeometry = squareGeometry({
  size: 8,
  indexing: 'squares',
  playableMask: darkSquaresOnly,
});

function startingPieces(): ReadonlyMap<NodeId, ClassifiedPiece> {
  const m = new Map<NodeId, ClassifiedPiece>();
  // Top three rows: black pawns on dark squares 1..12
  for (let n = 1; n <= 12; n += 1) m.set(asNodeId(n), { owner: 'black', kind: 'pawn' });
  // Bottom three rows: white pawns on 21..32
  for (let n = 21; n <= 32; n += 1) m.set(asNodeId(n), { owner: 'white', kind: 'pawn' });
  return m;
}

const serializer: GameStateSerializer<ClassifiedGameState> = {
  version: 1,
  toJSON(state) {
    return {
      pieces: [...state.pieces.entries()].map(([nodeId, p]) => [nodeId, p]),
      turn: state.turn ?? 'white',
      plyCount: state.plyCount ?? 0,
    };
  },
  fromJSON(json) {
    const data = json as {
      readonly pieces: ReadonlyArray<readonly [number, ClassifiedPiece]>;
      readonly turn: string;
      readonly plyCount: number;
    };
    return {
      pieces: new Map(data.pieces.map(([n, p]) => [asNodeId(n), p])),
      turn: data.turn,
      plyCount: data.plyCount,
      moveHistory: [],
    };
  },
};

export const testCheckersCloneRuleSet: ClassifiedRuleSet = {
  gameId: TEST_CHECKERS_CLONE_ID,
  boardGeometry: geometry,
  pieceVocabulary: DRAUGHTS_PIECE_VOCABULARY,

  hasPlacementPhase: false,
  hasPiecesInHand: false,
  hasStacks: false,
  isAsymmetric: false,
  hasMutableGeometry: false,
  hasPiecesOfDistinctTypes: false,

  startingPosition: () => ({
    pieces: startingPieces(),
    turn: 'white',
    plyCount: 0,
    moveHistory: [],
  }),

  getLegalMoves: () => [],
  applyMove: (state) => state,
  checkGameOver: () => null,

  serializer,
};
