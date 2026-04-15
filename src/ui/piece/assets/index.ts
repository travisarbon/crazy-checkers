/**
 * Asset family barrel — registers every Classified piece family on first
 * import (Task 27.5). Side-effectful. Marked PURE for bundlers so tree-
 * shaking can remove unused families when a tier explicitly opts out.
 */

/* @__PURE__ */
import { registerDraughtsPieces } from './draughts';
import { registerStackingPieces } from './stacking';
import { registerCheskersPieces } from './cheskers';
import { registerChessPieces } from './chess';
import { registerXiangqiPieces } from './xiangqi';
import { registerJangqiPieces } from './jangqi';
import { registerShogiPieces } from './shogi';
import { registerCrazyhousePieces } from './crazyhouse';
import { registerGoPieces } from './go';
import { registerTaflPieces } from './tafl';
import { registerMorrisPieces } from './morris';
import { registerMancalaPieces } from './mancala';
import { registerAbstractPieces } from './abstract';

let registered = false;
export function registerAllPieceFamilies(): void {
  if (registered) return;
  registered = true;
  registerDraughtsPieces();
  registerStackingPieces();
  registerCheskersPieces();
  registerChessPieces();
  registerXiangqiPieces();
  registerJangqiPieces();
  registerShogiPieces();
  registerCrazyhousePieces();
  registerGoPieces();
  registerTaflPieces();
  registerMorrisPieces();
  registerMancalaPieces();
  registerAbstractPieces();
}

/** Test-only: allow registry re-population after `_clearPieceRegistry`. */
export function _resetPieceFamilyRegistration(): void {
  registered = false;
}
