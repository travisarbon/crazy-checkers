/**
 * Draughts family registration barrel (Task 27.5).
 *
 * Imports side-effectfully from `src/ui/piece/assets/index.ts` registering the
 * four canonical `draughts-standard` pieces: pawn-white, pawn-black,
 * king-white, king-black. Matches the engine-level `DRAUGHTS_PIECE_VOCABULARY`
 * (src/engine/classified/pieceVocabulary.ts).
 */

import { asPieceVocabularyId } from '../../../../engine/classified/pieceVocabulary';
import { registerPieceVisual } from '../../PieceRegistry';
import type { PieceVisualSpec } from '../../PieceVisualSpec';
import { renderDraughtsPawn } from './pawn';
import { renderDraughtsKing } from './king';

const DRAUGHTS_VOCAB_ID = asPieceVocabularyId('draughts-standard');

const pawnWhite: PieceVisualSpec = {
  pieceId: 'pawn-white',
  vocabularyId: DRAUGHTS_VOCAB_ID,
  viewBox: [-50, -50, 100, 100],
  colorPolicy: { kind: 'theme-driven' },
  shortLabel: 'Pawn',
  render: (props) => renderDraughtsPawn(props, 'white'),
};

const pawnBlack: PieceVisualSpec = {
  pieceId: 'pawn-black',
  vocabularyId: DRAUGHTS_VOCAB_ID,
  viewBox: [-50, -50, 100, 100],
  colorPolicy: { kind: 'theme-driven' },
  shortLabel: 'Pawn',
  render: (props) => renderDraughtsPawn(props, 'black'),
};

const kingWhite: PieceVisualSpec = {
  pieceId: 'king-white',
  vocabularyId: DRAUGHTS_VOCAB_ID,
  viewBox: [-50, -50, 100, 100],
  colorPolicy: { kind: 'theme-driven' },
  shortLabel: 'King',
  render: (props) => renderDraughtsKing(props, 'white'),
};

const kingBlack: PieceVisualSpec = {
  pieceId: 'king-black',
  vocabularyId: DRAUGHTS_VOCAB_ID,
  viewBox: [-50, -50, 100, 100],
  colorPolicy: { kind: 'theme-driven' },
  shortLabel: 'King',
  render: (props) => renderDraughtsKing(props, 'black'),
};

export const DRAUGHTS_PIECE_VISUALS: readonly PieceVisualSpec[] = [
  pawnWhite,
  pawnBlack,
  kingWhite,
  kingBlack,
];

export function registerDraughtsPieces(): void {
  for (const spec of DRAUGHTS_PIECE_VISUALS) registerPieceVisual(spec);
}
