/**
 * Scaffold factory — generates `__PIECE_STUB__` placeholder specs for a
 * family (Task 27.5 §4.5). Each scaffold family registers a single stub
 * entry so tier tasks have a stable pieceId to replace.
 */

import {
  asPieceVocabularyId,
  type PieceVocabularyId,
} from '../../../engine/classified/pieceVocabulary';
import { registerPieceVisual } from '../PieceRegistry';
import type { PieceVisualSpec } from '../PieceVisualSpec';
import { renderStubPiece } from './stub';

export interface ScaffoldEntry {
  readonly pieceId: string;
  readonly glyph: string;
  readonly shortLabel: string;
  readonly owner?: 'white' | 'black' | 'either';
}

export function makeScaffoldVisuals(
  vocabularyId: string,
  entries: readonly ScaffoldEntry[],
): readonly PieceVisualSpec[] {
  const vocab: PieceVocabularyId = asPieceVocabularyId(vocabularyId);
  return entries.map((entry): PieceVisualSpec => ({
    pieceId: entry.pieceId,
    vocabularyId: vocab,
    viewBox: [-50, -50, 100, 100],
    colorPolicy: { kind: 'theme-driven' },
    shortLabel: entry.shortLabel,
    render: (props) => renderStubPiece(props, entry.glyph, entry.owner ?? 'either'),
    __PIECE_STUB__: true,
  }));
}

export function registerScaffoldVisuals(specs: readonly PieceVisualSpec[]): void {
  for (const s of specs) registerPieceVisual(s);
}
