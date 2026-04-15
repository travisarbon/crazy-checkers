/**
 * Public barrel for the Task 27.5 piece-rendering subsystem.
 *
 * Downstream tier tasks import components + registry helpers from here.
 * The asset barrel (`./assets`) is kept separate so tiers can opt-in to
 * per-family registration rather than pulling every family.
 */

export type {
  PieceVisualSpec,
  PieceRenderProps,
  PieceA11yContext,
  PieceColorPolicy,
  PieceSvgPart,
} from './PieceVisualSpec';
export {
  PieceVisualMissingError,
  PieceVisualCollisionError,
} from './PieceVisualSpec';
export {
  registerPieceVisual,
  getPieceVisual,
  tryGetPieceVisual,
  listVocabularyVisuals,
  listRegisteredPieceIds,
  resolvePieceFill,
  hasStubbedPieces,
  validatePieceVisualSpec,
  _clearPieceRegistry,
} from './PieceRegistry';
export { Piece } from './Piece';
export type { PieceProps } from './Piece';
export { StackPiece } from './StackPiece';
export type { StackPieceProps } from './StackPiece';
export { PiecePalette } from './PiecePalette';
export type { PiecePaletteProps } from './PiecePalette';
export { PromotionPicker } from './PromotionPicker';
export type { PromotionPickerProps } from './PromotionPicker';
export { HandReserve } from './HandReserve';
export type { HandReserveProps, HandReserveLayout } from './HandReserve';
export { describePiece } from './describePiece';
export {
  registerAllPieceFamilies,
  _resetPieceFamilyRegistration,
} from './assets';
