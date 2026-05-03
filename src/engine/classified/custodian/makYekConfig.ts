/**
 * Mak-yek (Tier 2 #23) configuration (Phase 4 Task 29.4).
 *
 * Per playbook §4.6:
 *   - 8×8 board, 16 men per side.
 *   - White fills ranks 1 and 3 (rows 0 and 2 in NodeId terms); row 1 gap.
 *     Black mirrored: rows 5 and 7 filled, row 6 gap.
 *   - Rook-style slide movement; no jump.
 *   - Custodian + intervention captures (no corner, no immobilization).
 *   - Capture obligation: NO (per playbook §4.6).
 *   - Win condition: opponent reduced to 0 pieces (`'no-pieces'`).
 *
 * Line-capture knob defaults to `'single-piece'` per playbook §4.6 disambiguation
 * (Task 29.4 Plan §1.1); flippable for the more aggressive "whole line between
 * two friendlies" reading.
 */

import type { CustodianConfig } from './types';
import { geometryFor, validateCustodianConfig } from './types';

let CACHE: CustodianConfig | null = null;

export function createMakYekConfig(): CustodianConfig {
  if (CACHE) return CACHE;
  const config: CustodianConfig = Object.freeze({
    gameId: 'mak-yek',
    displayName: 'Mak-yek',
    boardGeometry: geometryFor(8),
    boardSize: 8,
    movement: Object.freeze({ slide: 'rook', nonCapturingAdjacentJump: false }),
    capture: Object.freeze({
      custodian: true,
      intervention: true,
      corner: false,
      immobilization: false,
      lineCapture: 'single-piece',
      immobilizationScope: 'group',
    }),
    pieceTypes: Object.freeze(['man'] as const),
    startingPosition: Object.freeze({
      menRanks: Object.freeze([0, 2] as const),
      piecesPerSide: 16,
    }),
    winCondition: Object.freeze({ kind: 'no-pieces' } as const),
    stalemateIsLoss: true,
    enableThreefoldDraw: true,
  });
  validateCustodianConfig(config);
  CACHE = config;
  return config;
}
