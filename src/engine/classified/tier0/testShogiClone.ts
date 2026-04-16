// TESTING ONLY — Task 27.4 Tier 0 fixture exercising the hand pathway
// (T7-08 coverage). Minimal 3×3 board with rook and pawn piece kinds;
// the interesting bits are `hasPiecesInHand: true`, a non-empty `getLegalDrops`,
// and a `PieceVocabulary` with a populated `inHand` list.

import type { BoardGeometry } from '../../boardGeometry';
import { squareGeometry, asNodeId } from '../../boardGeometry';
import type {
  ClassifiedRuleSet,
  ClassifiedMove,
  ClassifiedGameId,
  GameStateSerializer,
} from '../ClassifiedRuleSet';
import { asClassifiedGameId } from '../ClassifiedRuleSet';
import {
  asPieceVocabularyId,
  createPieceVocabulary,
  type PieceVocabulary,
} from '../pieceVocabulary';

export const TEST_SHOGI_CLONE_ID: ClassifiedGameId =
  asClassifiedGameId('classified-test-tier-shogi');

const geometry: BoardGeometry = squareGeometry({
  size: 3,
  indexing: 'squares',
});

export const TEST_SHOGI_VOCABULARY: PieceVocabulary = createPieceVocabulary(
  asPieceVocabularyId('test-tier-shogi'),
  [
    { pieceId: 'rook', displayName: 'Rook', owner: 'either' },
    { pieceId: 'pawn', displayName: 'Pawn', owner: 'either' },
  ],
  [
    { pieceId: 'rook-in-hand', displayName: 'Rook (in hand)', owner: 'either' },
    { pieceId: 'pawn-in-hand', displayName: 'Pawn (in hand)', owner: 'either' },
  ],
);

const serializer: GameStateSerializer = {
  version: 1,
  toJSON(state) {
    return {
      pieces: [...state.pieces.entries()],
      turn: state.turn ?? 'white',
      plyCount: state.plyCount ?? 0,
      hands: state.hands
        ? {
            white: [...state.hands.white.entries()],
            black: [...state.hands.black.entries()],
          }
        : undefined,
    };
  },
  fromJSON(json) {
    const data = json as {
      readonly pieces: ReadonlyArray<readonly [number, { owner: string; kind: string }]>;
      readonly turn: string;
      readonly plyCount: number;
      readonly hands?: {
        readonly white: ReadonlyArray<readonly [string, number]>;
        readonly black: ReadonlyArray<readonly [string, number]>;
      };
    };
    return {
      pieces: new Map(data.pieces.map(([n, p]) => [asNodeId(n), p])),
      turn: data.turn,
      plyCount: data.plyCount,
      moveHistory: [],
      hands: data.hands
        ? { white: new Map(data.hands.white), black: new Map(data.hands.black) }
        : undefined,
    };
  },
};

export const testShogiCloneRuleSet: ClassifiedRuleSet = {
  gameId: TEST_SHOGI_CLONE_ID,
  boardGeometry: geometry,
  pieceVocabulary: TEST_SHOGI_VOCABULARY,

  hasPlacementPhase: false,
  hasPiecesInHand: true,
  hasStacks: false,
  isAsymmetric: false,
  hasMutableGeometry: false,
  hasPiecesOfDistinctTypes: true,

  startingPosition: () => ({
    pieces: new Map([
      [asNodeId(1), { owner: 'white', kind: 'rook' }],
      [asNodeId(9), { owner: 'black', kind: 'rook' }],
    ]),
    turn: 'white',
    plyCount: 0,
    moveHistory: [],
    hands: {
      white: new Map([['pawn-in-hand', 1]]),
      black: new Map([['pawn-in-hand', 1]]),
    },
  }),

  getLegalMoves: () => [],
  applyMove: (state) => state,
  checkGameOver: () => null,

  // Hand-capability hook — any empty square is a legal drop for each hand piece.
  getLegalDrops: (state) => {
    const drops: ClassifiedMove[] = [];
    const hands = state.hands;
    if (!hands) return drops;
    const byOwner = state.turn === 'white' ? hands.white : hands.black;
    for (let n = 1; n <= 9; n += 1) {
      if (!state.pieces.has(asNodeId(n))) {
        for (const [pieceId, count] of byOwner.entries()) {
          if (count > 0) drops.push({ kind: 'drop', to: String(n), piece: pieceId });
        }
      }
    }
    return drops;
  },

  serializer,
};
