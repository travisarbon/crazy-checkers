/**
 * Hasami Shogi (Tier 2 #24) configuration (Phase 4 Task 29.4).
 *
 * Per playbook §4.7:
 *   - 9×9 board, 9 men per side.
 *   - White fills row 0; black fills row 8.
 *   - Rook-style slide movement; no jump.
 *   - Custodian + corner captures (no intervention, no immobilization).
 *   - Win condition: opponent reduced to ≤ 1 piece (`'reduce-below'` threshold 1).
 */

import type { CustodianConfig } from './types';
import { geometryFor, validateCustodianConfig } from './types';

let CACHE: CustodianConfig | null = null;

export function createHasamiShogiConfig(): CustodianConfig {
  if (CACHE) return CACHE;
  const config: CustodianConfig = Object.freeze({
    gameId: 'hasami-shogi',
    displayName: 'Hasami Shogi',
    boardGeometry: geometryFor(9),
    boardSize: 9,
    movement: Object.freeze({ slide: 'rook', nonCapturingAdjacentJump: false }),
    capture: Object.freeze({
      custodian: true,
      intervention: false,
      corner: true,
      immobilization: false,
      lineCapture: 'single-piece',
      immobilizationScope: 'group',
    }),
    pieceTypes: Object.freeze(['man'] as const),
    startingPosition: Object.freeze({
      menRanks: Object.freeze([0] as const),
      piecesPerSide: 9,
    }),
    winCondition: Object.freeze({ kind: 'reduce-below', threshold: 1 } as const),
    stalemateIsLoss: true,
    enableThreefoldDraw: true,
  });
  validateCustodianConfig(config);
  CACHE = config;
  return config;
}
