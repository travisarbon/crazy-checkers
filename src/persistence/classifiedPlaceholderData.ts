/**
 * Static data for all 64 Classified game placeholder entries.
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
  { index: 36, displayName: 'Tak', wave: 3, family: 'Connection Game', boardGeometry: '5×5 or 6×6' },
  { index: 37, displayName: 'Havannah', wave: 3, family: 'Connection Game', boardGeometry: 'Hex grid (size 8)' },

  // Wave 4 — Territory & Enclosure Games (5 games)
  { index: 38, displayName: 'Reversi', wave: 4, family: 'Flipping Game', boardGeometry: '8×8' },
  { index: 39, displayName: 'Dots and Boxes', wave: 4, family: 'Mathematical', boardGeometry: 'Dot grid' },
  { index: 40, displayName: 'Atari Go', wave: 4, family: 'Go Family', boardGeometry: '9×9' },
  { index: 41, displayName: 'Amazons', wave: 4, family: 'Territory Game', boardGeometry: '10×10' },
  { index: 42, displayName: 'Go', wave: 4, family: 'Go Family', boardGeometry: '19×19' },

  // Wave 5 — Deep Strategy & Unique Systems (6 games)
  { index: 43, displayName: 'Oware', wave: 5, family: 'Mancala', boardGeometry: '2×6' },
  { index: 44, displayName: 'Bao', wave: 5, family: 'Mancala', boardGeometry: '4×8' },
  { index: 45, displayName: 'Dou Shou Qi', wave: 5, family: 'Hierarchy Game', boardGeometry: '7×9' },
  { index: 46, displayName: 'Phutball', wave: 5, family: 'Mathematical', boardGeometry: '19×15' },
  { index: 47, displayName: 'Epaminondas', wave: 5, family: 'Phalanx Game', boardGeometry: '12×14' },
  { index: 48, displayName: 'Arimaa', wave: 5, family: 'Displacement Game', boardGeometry: '8×8' },

  // Wave 6 — The Chess Family (9 games)
  { index: 49, displayName: 'Cheskers', wave: 6, family: 'Chess/Draughts Hybrid', boardGeometry: '8×8' },
  { index: 50, displayName: 'Makruk', wave: 6, family: 'Chess Family', boardGeometry: '8×8' },
  { index: 51, displayName: 'Sittuyin', wave: 6, family: 'Chess Family', boardGeometry: '8×8' },
  { index: 52, displayName: 'Minichess', wave: 6, family: 'Chess Family', boardGeometry: '5×5' },
  { index: 53, displayName: 'Grand Chess', wave: 6, family: 'Chess Family', boardGeometry: '10×10' },
  { index: 54, displayName: 'Atomic Chess', wave: 6, family: 'Chess Family', boardGeometry: '8×8' },
  { index: 55, displayName: 'Minixiangqi', wave: 6, family: 'Chess Family', boardGeometry: '7×7' },
  { index: 56, displayName: 'Janggi', wave: 6, family: 'Chess Family', boardGeometry: '9×10' },
  { index: 57, displayName: 'Xiangqi', wave: 6, family: 'Chess Family', boardGeometry: '9×10' },

  // Wave 7 — The Shogi Family (5 games)
  { index: 58, displayName: 'Crazyhouse', wave: 7, family: 'Chess/Shogi Bridge', boardGeometry: '8×8' },
  { index: 59, displayName: 'Kyoto Shogi', wave: 7, family: 'Shogi Family', boardGeometry: '5×5' },
  { index: 60, displayName: 'Tori Shogi', wave: 7, family: 'Shogi Family', boardGeometry: '7×7' },
  { index: 61, displayName: 'Minishogi', wave: 7, family: 'Shogi Family', boardGeometry: '5×5' },
  { index: 62, displayName: 'Shogi', wave: 7, family: 'Shogi Family', boardGeometry: '9×9' },

  // Wave 8 — The Final Unlocks (2 games)
  { index: 63, displayName: 'Chess 960', wave: 8, family: 'Chess Family', boardGeometry: '8×8' },
  { index: 64, displayName: 'Chess', wave: 8, family: 'Chess Family', boardGeometry: '8×8' },
];
