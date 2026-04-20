/**
 * PDN dialect manifest for validator parseability testing (Task 28.6 §8).
 *
 * Each entry describes one PDN dialect's grammar: coordinate scheme,
 * square range, non-standard separators, and standards-conformance status.
 */

import type { DraughtsGameId } from '../../../engine/classified/draughts/DraughtsConfig';

export type PdnDialectKey =
  | 'pdn-8'
  | 'pdn-10'
  | 'pdn-12'
  | 'pdn-frisian'
  | 'pdn-8-armenian'
  | 'pdn-8-turkish';

export interface PdnDialectManifest {
  readonly dialectKey: PdnDialectKey;
  readonly gameIds: readonly DraughtsGameId[];
  readonly standardConformant: boolean;
  readonly nonStandardSeparators: readonly string[];
  readonly coordinateScheme: 'numeric-diagonal' | 'file-rank';
  readonly boardSize: 8 | 10 | 12;
  readonly numericRange: readonly [number, number];
  readonly notes: string;
}

export const PDN_DIALECT_MANIFEST: readonly PdnDialectManifest[] = [
  {
    dialectKey: 'pdn-8',
    gameIds: ['russian-draughts', 'brazilian-draughts', 'italian-draughts'],
    standardConformant: true,
    nonStandardSeparators: [],
    coordinateScheme: 'numeric-diagonal',
    boardSize: 8,
    numericRange: [1, 32],
    notes: 'Standard 8×8 PDN with numeric diagonal squares 1–32',
  },
  {
    dialectKey: 'pdn-10',
    gameIds: ['international-checkers'],
    standardConformant: true,
    nonStandardSeparators: [],
    coordinateScheme: 'numeric-diagonal',
    boardSize: 10,
    numericRange: [1, 50],
    notes: 'Standard 10×10 PDN with numeric diagonal squares 1–50',
  },
  {
    dialectKey: 'pdn-12',
    gameIds: ['malaysian-checkers', 'canadian-draughts'],
    standardConformant: true,
    nonStandardSeparators: [],
    coordinateScheme: 'numeric-diagonal',
    boardSize: 12,
    numericRange: [1, 72],
    notes: 'Standard 12×12 PDN with numeric diagonal squares 1–72',
  },
  {
    dialectKey: 'pdn-frisian',
    gameIds: ['frysk', 'frisian-draughts'],
    standardConformant: false,
    nonStandardSeparators: ['×⊥', '×/'],
    coordinateScheme: 'numeric-diagonal',
    boardSize: 10,
    numericRange: [1, 50],
    notes: 'Frisian PDN extends pdn-10 with ×⊥ (orthogonal) and ×/ (diagonal) capture separators',
  },
  {
    dialectKey: 'pdn-8-armenian',
    gameIds: ['armenian-draughts'],
    standardConformant: false,
    nonStandardSeparators: ['×−'],
    coordinateScheme: 'file-rank',
    boardSize: 8,
    numericRange: [0, 63],
    notes: 'Armenian PDN uses file+rank notation (a1–h8) with ×− for orthogonal captures',
  },
  {
    dialectKey: 'pdn-8-turkish',
    gameIds: ['turkish-draughts'],
    standardConformant: false,
    nonStandardSeparators: [],
    coordinateScheme: 'file-rank',
    boardSize: 8,
    numericRange: [0, 63],
    notes: 'Turkish PDN uses file+rank notation (a1–h8) with uniform × separator',
  },
];
