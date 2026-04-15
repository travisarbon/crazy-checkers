/**
 * Go family scaffold → Task 31. Go stones use `absolute` colour policy —
 * black and white stones are tradition-locked and do not honour the piece
 * Theme tokens. Selection/halo chrome still reads from Theme.
 */
import { asPieceVocabularyId } from '../../../../engine/classified/pieceVocabulary';
import { registerPieceVisual } from '../../PieceRegistry';
import type { PieceVisualSpec } from '../../PieceVisualSpec';
import { renderStubPiece } from '../stub';

const GO_VOCAB = asPieceVocabularyId('go-standard');

export const GO_PIECE_VISUALS: readonly PieceVisualSpec[] = [
  {
    pieceId: 'go-stone-white',
    vocabularyId: GO_VOCAB,
    viewBox: [-50, -50, 100, 100],
    colorPolicy: { kind: 'absolute', light: '#F5F5F0', dark: '#111111' },
    shortLabel: 'Stone',
    render: (props) => renderStubPiece(props, 'o', 'white'),
    __PIECE_STUB__: true,
  },
  {
    pieceId: 'go-stone-black',
    vocabularyId: GO_VOCAB,
    viewBox: [-50, -50, 100, 100],
    colorPolicy: { kind: 'absolute', light: '#F5F5F0', dark: '#111111' },
    shortLabel: 'Stone',
    render: (props) => renderStubPiece(props, 'o', 'black'),
    __PIECE_STUB__: true,
  },
];

export function registerGoPieces(): void {
  for (const s of GO_PIECE_VISUALS) registerPieceVisual(s);
}
