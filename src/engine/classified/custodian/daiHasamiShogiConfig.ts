/**
 * Dai Hasami Shogi (Tier 2 #33) configuration (Phase 4 Task 29.4).
 *
 * Per playbook §4.9:
 *   - 9×9 board, 18 men per side.
 *   - White fills rows 0 and 1; black fills rows 7 and 8.
 *   - Rook-style slide movement PLUS optional non-capturing single-jump
 *     (jump exactly one square over an adjacent piece of any color to the
 *     empty square immediately beyond — single jump only, never chained).
 *   - Custodian + corner captures (no intervention, no immobilization).
 *   - Win condition: opponent reduced to ≤ 4 pieces OR own 5-in-a-row line
 *     formed entirely outside own starting two ranks (per playbook §4.9
 *     "the 5-in-a-row must lie entirely OUTSIDE the player's own starting
 *     two rows to count as a win").
 *
 * 5-in-a-row axes default to `['horizontal', 'vertical']` per playbook §4.9
 * implementation note ("some sources restrict the 5-in-a-row to orthogonal
 * lines only"). Flippable in config to add `'diagonal'`.
 */

import type { CustodianConfig } from './types';
import { geometryFor, validateCustodianConfig } from './types';

let CACHE: CustodianConfig | null = null;

export function createDaiHasamiShogiConfig(): CustodianConfig {
  if (CACHE) return CACHE;
  const config: CustodianConfig = Object.freeze({
    gameId: 'dai-hasami-shogi',
    displayName: 'Dai Hasami Shogi',
    boardGeometry: geometryFor(9),
    boardSize: 9,
    movement: Object.freeze({ slide: 'rook', nonCapturingAdjacentJump: true }),
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
      menRanks: Object.freeze([0, 1] as const),
      piecesPerSide: 18,
    }),
    winCondition: Object.freeze({
      kind: 'reduce-below-or-line-formation',
      captureThreshold: 4,
      lineLength: 5,
      lineAxes: Object.freeze(['horizontal', 'vertical'] as const),
      excludeOwnStartingRanks: 2,
    } as const),
    stalemateIsLoss: true,
    enableThreefoldDraw: true,
  });
  validateCustodianConfig(config);
  CACHE = config;
  return config;
}
