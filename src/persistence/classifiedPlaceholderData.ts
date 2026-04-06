/**
 * Static data for all 60 Classified game placeholder entries.
 * Sourced from Design Document §2.5 and Phase 4 Tier 1–5 Classified Playbooks.
 *
 * Each entry is pre-registered with `implemented: false`. Phase 4 will
 * populate the actual rule sets and set `implemented: true`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassifiedPlaceholder {
  readonly index: number;
  readonly displayName: string;
  readonly wave: number;
  readonly family: string;
  readonly boardGeometry: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const CLASSIFIED_PLACEHOLDER_DATA: readonly ClassifiedPlaceholder[] = [
  // Wave 1 — The Draughts Family (14 games)
  { index: 1, displayName: 'Russian Draughts', wave: 1, family: 'Draughts', boardGeometry: '8×8' },
  { index: 2, displayName: 'Brazilian Draughts', wave: 1, family: 'Draughts', boardGeometry: '8×8' },
  { index: 3, displayName: 'Italian Draughts', wave: 1, family: 'Draughts', boardGeometry: '8×8' },
  { index: 4, displayName: 'International Checkers', wave: 1, family: 'Draughts', boardGeometry: '10×10' },
  { index: 5, displayName: 'Frysk!', wave: 1, family: 'Draughts', boardGeometry: '10×10' },
  { index: 6, displayName: 'Frisian Draughts', wave: 1, family: 'Draughts', boardGeometry: '10×10' },
  { index: 7, displayName: 'Malaysian Checkers', wave: 1, family: 'Draughts', boardGeometry: '12×12' },
  { index: 8, displayName: 'Canadian Draughts', wave: 1, family: 'Draughts', boardGeometry: '12×12' },
  { index: 9, displayName: 'Armenian Draughts', wave: 1, family: 'Draughts', boardGeometry: '8×8' },
  { index: 10, displayName: 'Turkish Draughts', wave: 1, family: 'Draughts', boardGeometry: '8×8' },
  { index: 11, displayName: 'Dameo', wave: 1, family: 'Draughts', boardGeometry: '8×8' },
  { index: 12, displayName: 'Harzdame', wave: 1, family: 'Draughts', boardGeometry: '8×8' },
  { index: 13, displayName: 'Lasca', wave: 1, family: 'Stacking Draughts', boardGeometry: '7×7' },
  { index: 14, displayName: 'Bashni', wave: 1, family: 'Stacking Draughts', boardGeometry: '8×8' },

  // Wave 2 — Hunt & Capture Games (13 games)
  { index: 15, displayName: 'Zamma', wave: 2, family: 'Capture Game', boardGeometry: '9×9' },
  { index: 16, displayName: 'Konane', wave: 2, family: 'Capture Game', boardGeometry: '8×8' },
  { index: 17, displayName: 'Yoté', wave: 2, family: 'Capture Game', boardGeometry: '5×6' },
  { index: 18, displayName: 'Fox and Geese', wave: 2, family: 'Hunt Game', boardGeometry: 'Cross grid' },
  { index: 19, displayName: 'Bagh-Chal', wave: 2, family: 'Hunt Game', boardGeometry: '5×5' },
  { index: 20, displayName: 'Nine Men\'s Morris', wave: 2, family: 'Mill Game', boardGeometry: 'Ring grid' },
  { index: 21, displayName: 'Fanorona', wave: 2, family: 'Capture Game', boardGeometry: '9×5' },
  { index: 22, displayName: 'Surakarta', wave: 2, family: 'Capture Game', boardGeometry: '6×6' },
  { index: 23, displayName: 'Mak-yek', wave: 2, family: 'Capture Game', boardGeometry: '8×8' },
  { index: 24, displayName: 'Hasami Shogi', wave: 2, family: 'Capture Game', boardGeometry: '9×9' },
  { index: 25, displayName: 'Rek', wave: 2, family: 'Capture Game', boardGeometry: '8×8' },
  { index: 26, displayName: 'Hnefatafl', wave: 2, family: 'Tafl', boardGeometry: '11×11' },
  { index: 27, displayName: 'Tablut', wave: 2, family: 'Tafl', boardGeometry: '9×9' },

  // Wave 3 — Race & Connection Games (10 games)
  { index: 28, displayName: 'Breakthrough', wave: 3, family: 'Race Game', boardGeometry: '8×8' },
  { index: 29, displayName: 'Ugolki', wave: 3, family: 'Race Game', boardGeometry: '8×8' },
  { index: 30, displayName: 'Crossings', wave: 3, family: 'Race Game', boardGeometry: '8×8' },
  { index: 31, displayName: 'Halma', wave: 3, family: 'Race Game', boardGeometry: '16×16' },
  { index: 32, displayName: 'Lines of Action', wave: 3, family: 'Connection Game', boardGeometry: '8×8' },
  { index: 33, displayName: 'Dai Hasami Shogi', wave: 3, family: 'Connection/Capture Game', boardGeometry: '9×9' },
  { index: 34, displayName: 'Gomoku', wave: 3, family: 'Connection Game', boardGeometry: '15×15' },
  { index: 35, displayName: 'Hex', wave: 3, family: 'Connection Game', boardGeometry: '11×11 rhombus' },
  { index: 36, displayName: 'Tak', wave: 3, family: 'Connection Game', boardGeometry: '5×5' },
  { index: 37, displayName: 'Havannah', wave: 3, family: 'Connection Game', boardGeometry: 'Hex grid (size 8)' },

  // Wave 4 — Territory Games (5 games)
  { index: 38, displayName: 'Othello', wave: 4, family: 'Territory Game', boardGeometry: '8×8' },
  { index: 39, displayName: 'Ataxx', wave: 4, family: 'Territory Game', boardGeometry: '7×7' },
  { index: 40, displayName: 'Amazons', wave: 4, family: 'Territory Game', boardGeometry: '10×10' },
  { index: 41, displayName: 'Clobber', wave: 4, family: 'Territory Game', boardGeometry: '5×6' },
  { index: 42, displayName: 'Blocker', wave: 4, family: 'Territory Game', boardGeometry: '8×8' },

  // Wave 5 — Movement & Displacement Games (5 games)
  { index: 43, displayName: 'Neutron', wave: 5, family: 'Movement Game', boardGeometry: '5×5' },
  { index: 44, displayName: 'Entropy', wave: 5, family: 'Placement Game', boardGeometry: '5×5' },
  { index: 45, displayName: 'Epaminondas', wave: 5, family: 'Phalanx Game', boardGeometry: '12×14' },
  { index: 46, displayName: 'Arimaa', wave: 5, family: 'Displacement Game', boardGeometry: '8×8' },
  { index: 47, displayName: 'Kamisado', wave: 5, family: 'Race Game', boardGeometry: '8×8' },

  // Wave 6 — Mancala Family (5 games)
  { index: 48, displayName: 'Oware', wave: 6, family: 'Mancala', boardGeometry: '2×6' },
  { index: 49, displayName: 'Bao', wave: 6, family: 'Mancala', boardGeometry: '4×8' },
  { index: 50, displayName: 'Kalah', wave: 6, family: 'Mancala', boardGeometry: '2×6' },
  { index: 51, displayName: 'Toguz Kumalak', wave: 6, family: 'Mancala', boardGeometry: '2×9' },
  { index: 52, displayName: 'Congkak', wave: 6, family: 'Mancala', boardGeometry: '2×7' },

  // Wave 7 — Chess Family (5 games)
  { index: 53, displayName: 'Shogi (mini)', wave: 7, family: 'Chess Family', boardGeometry: '5×5' },
  { index: 54, displayName: 'Xiangqi (mini)', wave: 7, family: 'Chess Family', boardGeometry: '7×7' },
  { index: 55, displayName: 'Makruk', wave: 7, family: 'Chess Family', boardGeometry: '8×8' },
  { index: 56, displayName: 'Sittuyin', wave: 7, family: 'Chess Family', boardGeometry: '8×8' },
  { index: 57, displayName: 'Janggi (mini)', wave: 7, family: 'Chess Family', boardGeometry: '7×8' },

  // Wave 8 — Abstract Games (3 games)
  { index: 58, displayName: 'Quarto', wave: 8, family: 'Abstract', boardGeometry: '4×4' },
  { index: 59, displayName: 'Quoridor', wave: 8, family: 'Abstract', boardGeometry: '9×9' },
  { index: 60, displayName: 'Abalone', wave: 8, family: 'Abstract', boardGeometry: 'Hex grid (size 5)' },
];
