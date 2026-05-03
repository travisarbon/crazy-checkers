/**
 * Rek (Tier 2 #25) configuration (Phase 4 Task 29.4).
 *
 * Per playbook §4.8:
 *   - 8×8 board, 16 pieces per side: 15 Men + 1 King.
 *   - Men fill ranks 1 and 3 (rows 0 and 2 in NodeId terms; same gapped layout
 *     as Mak-yek). Kings are placed crosswise on the 2nd and 7th ranks.
 *   - Rook-style slide movement; no jump.
 *   - Intervention + immobilization captures (no custodian, no corner per
 *     playbook §3.3 row for Rek). The "Mak-yek line capture" is irrelevant
 *     because custodian mode is off.
 *   - Win condition: opponent's King removed (`'capture-king'`).
 *
 * The "exact King column varies by convention" note in playbook §4.8 is
 * resolved per Task 29.4 Plan §19.3: White King at row 1 file 0 (a-file
 * between rows 0 and 2 of Men); Black King mirrored at row 6 file 7.
 *
 * Immobilization-scope knob defaults to `'group'` per playbook §4.8
 * disambiguation (Task 29.4 Plan §1.2); flippable to `'piece'` for the
 * per-piece reading.
 */

import type { CustodianConfig } from './types';
import { geometryFor, validateCustodianConfig } from './types';

let CACHE: CustodianConfig | null = null;

export function createRekConfig(): CustodianConfig {
  if (CACHE) return CACHE;
  const config: CustodianConfig = Object.freeze({
    gameId: 'rek',
    displayName: 'Rek',
    boardGeometry: geometryFor(8),
    boardSize: 8,
    movement: Object.freeze({ slide: 'rook', nonCapturingAdjacentJump: false }),
    capture: Object.freeze({
      custodian: false,
      intervention: true,
      corner: false,
      immobilization: true,
      lineCapture: 'single-piece',
      immobilizationScope: 'group',
    }),
    pieceTypes: Object.freeze(['man', 'king'] as const),
    startingPosition: Object.freeze({
      menRanks: Object.freeze([0, 2] as const),
      // Default King placements per Task 29.4 Plan §19.3.
      // White King at row 1 col 0 (the rank between Men rows 0 and 2).
      // Black King mirrored: row 6 col 7.
      kings: Object.freeze([
        Object.freeze({ side: 'white', rank: 1, file: 0 } as const),
        Object.freeze({ side: 'black', rank: 6, file: 7 } as const),
      ]),
      // Reserve a Men slot for the King (one square in the men-rank zone is replaced).
      // Default: white King replaces the row-2 col-0 Man; black King replaces row-5 col-7 Man.
      menGapsForKing: Object.freeze([
        Object.freeze({ side: 'white', rank: 2, file: 0 } as const),
        Object.freeze({ side: 'black', rank: 5, file: 7 } as const),
      ]),
      piecesPerSide: 16,
    }),
    winCondition: Object.freeze({ kind: 'capture-king' } as const),
    stalemateIsLoss: true,
    enableThreefoldDraw: true,
  });
  validateCustodianConfig(config);
  CACHE = config;
  return config;
}
