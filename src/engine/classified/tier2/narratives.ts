/**
 * Tier 2 narrative copy — Task 29.7.
 *
 * Wave/family labels and per-gameId connection prose for the 10 Tier 2
 * games. Sourced from the Phase 4 Tier 2 Classified Playbook + each
 * engine task's RULES_NOTES. Strings are kept as `Object.freeze`-d
 * literal records so per-game registrations reference them by identity
 * (no duplication).
 *
 * Tier 2 spans 4 waves (1, 2, 3, 6) and 4 families. Per the Master
 * Playbook, each game's narrative blurb explains its connection to the
 * Tier 1 + Crazy Mode anchor (American Rules) and its place in the
 * worldwide draughts/capture/hybrid taxonomy.
 *
 * Edits to any string here must land in the same commit as the playbook
 * edit they mirror.
 */

export const TIER_2_WAVE_LABELS = Object.freeze({
  1: 'Wave 1 — The Draughts Family',
  2: 'Wave 2 — Capture Games',
  3: 'Wave 3 — Connection & Hybrid Captures',
  6: 'Wave 6 — Chess/Draughts Hybrids',
} as const);

export const TIER_2_FAMILY_LABELS = Object.freeze({
  Draughts: 'Draughts variants — kings, jumps, promotion',
  'Stacking Draughts': 'Stacking — captured pieces ride underneath the captor',
  'Capture Game': 'Custodian capture — pieces flanked between two enemies are removed',
  'Connection Game':
    'Connection capture — line up your pieces to win, while still removing the opponent\'s',
  'Abstract Strategy':
    'Sui-generis hybrid — chess pieces in a draughts world',
} as const);

export const TIER_2_CONNECTIONS = Object.freeze({
  dameo:
    'Linear movement arrives. Men and kings slide along ranks, files, and diagonals like chess rooks/bishops, but the draughts framework — mandatory captures, promotion, two-player zero-sum — stays intact. The first Tier 2 game introduces a new movement vocabulary while preserving familiar territory.',
  harzdame:
    'Asymmetric men — only 2 of 4 diagonal directions, with a non-standard 11-square promotion area and a "senior king" tier earned by completing the position\'s longest capture chain. A bridge between American Rules\' simplicity and the variant-rich draughts world.',
  lasca:
    'Pieces stack on capture — the captor lands on top of the captured, who rides underneath. A column captured later releases the riders one stratum at a time. Played on a 7×7 board with seven dark squares per row, Lasca turns a draughts game into a stratigraphic puzzle.',
  bashni:
    'The Russian cousin of Lasca, played on the full 8×8 American board. Same stack-on-capture mechanic, but with flying kings inside towers and 12 pieces per side. Wave 1\'s most strategically rich draughts variant.',
  zamma:
    'Saharan capture game on the alquerque graph (9×9 squares plus diagonal lines forming an extended X-pattern). Pieces move and jump along the lines; a "Mullah" (king) earns extra mobility on completion of a long chain. Diagonal movement returns, but the connectivity is graph-defined rather than grid-defined.',
  'mak-yek':
    'Burmese custodian capture on an 8×8 board. Pieces move orthogonally or diagonally; an opponent flanked between two of your pieces (vertically or horizontally) is removed. The first appearance of custodian capture in the Classified library.',
  'hasami-shogi':
    'Japanese flanking-capture game on a 9×9 board. Pieces move like chess rooks (any distance, any cardinal direction). An opponent\'s line of pieces caught between two of yours is captured wholesale. Custodian capture meets long-range movement.',
  rek:
    'Mak-yek with a King — capture the opponent\'s King to win. The King moves like the other pieces but its capture ends the game. Adds a chess-flavored win condition to the custodian framework.',
  'dai-hasami-shogi':
    '"Big Hasami Shogi" on a 9×9 board with two starting rows per side. Win by either custodian capture (reduce opponent to ≤ 5 pieces) OR by lining up 5 of your pieces in a row. The first connection game in the wave.',
  cheskers:
    'Solomon Golomb\'s 1948 hybrid: 4 piece types per side (Pawn, King, Bishop, Camel) on a draughts-style 8×8 dark-square board. Pawn + King use draughts capture (mandatory jumps); Bishop + Camel use chess capture (optional displacement). The dual capture-obligation regime makes Cheskers structurally unique in the Classified library.',
} as const);
