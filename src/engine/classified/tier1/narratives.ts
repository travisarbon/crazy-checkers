/**
 * Tier 1 narrative copy — Task 28.3.
 *
 * Sourced from the Classified Library Playbook v1.x §86–§106 (Wave 1).
 * The constants live in their own module so each per-game registration
 * references them by identity instead of duplicating literals; tests in
 * `__tests__/tier1.registryInvariants.test.ts` enforce non-empty
 * connection text per gameId.
 *
 * Edits to any string here must land in the same commit as the playbook
 * edit they mirror.
 */

export const TIER_1_WAVE_LABEL = 'Wave 1 — The Draughts Family';
export const TIER_1_FAMILY_LABEL = 'Draughts';

export const TIER_1_CONNECTIONS = Object.freeze({
  'russian-draughts':
    'Closest neighbour to American Rules — men capture backwards, kings fly across any distance, and a man that lands on the king row during a capture sequence is immediately promoted and can continue capturing as a king in the same turn. Maximum captures are not required: any legal capture sequence may be chosen. The first small-but-legible twist.',
  'brazilian-draughts':
    'Full International rules on the familiar 8×8 board — men capture backwards, kings fly, and maximum captures are mandatory. Brazilian bridges Russian to International, teaching the any-max capture obligation before the board grows to 10×10.',
  'italian-draughts':
    'The capture-and-promotion tweak set that completes the 8×8 diagonal family. Men cannot capture kings, and the capture-priority ladder (more pieces > more kings > king-capturing) forces disciplined calculation. Italian echoes the Class Divides Choice mode — a familiar chaos rule showing up as a historical game rule.',
  'international-checkers':
    "The global competitive standard: 10×10 board, 20 pieces per side, flying kings, mandatory maximum captures, and end-of-sequence piece removal. Wave 1's first board-size expansion.",
  'frysk':
    'A lighter, faster companion to Frisian Draughts — the same orthogonal-plus-diagonal capture mechanic, but only five pieces per side on the back row. Short, intense games that introduce orthogonal capture without the full strategic weight.',
  'frisian-draughts':
    'The full 20-piece Frisian experience on 10×10: kings are worth 1.5 men in capture-priority tiebreaks, kings may capture orthogonally and diagonally, and a king moved three times without a capture is forfeited. Rewards the player who found Frysk! intriguing.',
  'malaysian-checkers':
    'Dam Haji on the 12×12 board. International rules with two distinctive restrictions: men cannot move backwards, and a player who fails to make an available capture forfeits the piece that should have captured (self-piece-forfeit huffing). Preserves the huffing tradition as a first-class rule.',
  'canadian-draughts':
    'International rules scaled to 12×12 with 30 pieces per side — no huffing, men capture backwards, kings fly. The counterpart to Malaysian: same board, same piece count, standard rules. Together they give the full 12×12 experience from two angles.',
  'armenian-draughts':
    'Orthogonal movement arrives. Men move diagonally forward but capture orthogonally; kings fly along ranks and files. After eight games of pure diagonal play the axis shift is genuinely disorienting — but the draughts idiom is still intact.',
  'turkish-draughts':
    'Fully orthogonal: men and kings both move and capture along ranks and files, with no diagonal movement anywhere. The full 64-square board is used (not just dark squares), and mandatory maximum captures apply. The most radical standard draughts variant in the wave.',
} as const);
