/**
 * Hand-verified Dai Hasami Shogi scenarios for Task 29.4 acceptance.
 *
 * Algebraic notation: a1..i9. Piece spec: m / b.
 *
 * Mechanics: rook slide + non-capturing single-jump (over any-color
 * adjacent piece to empty square beyond). Custodian + corner captures.
 * Win: opponent ≤ 4 pieces OR own 5-in-a-row outside own starting two ranks.
 *
 * Geometry: NodeId 0 = a9 (top-left). White starts rows 0..1 (ranks 9..8);
 * black starts rows 7..8 (ranks 2..1). White's "own starting two ranks" =
 * rows 0..1; black's = rows 7..8.
 */

import type { CustodianMove, CustodianOwner } from '../types';

export interface DaiHasamiShogiScenario {
  readonly id: string;
  readonly description: string;
  readonly pieces: Readonly<Record<string, string>>;
  readonly turn?: CustodianOwner;
  readonly halfMoveClock?: number;
  readonly expectedMoveCount?: number;
  readonly expectedJumpCount?: number;
  readonly canonical?: {
    readonly from: string;
    readonly to: string;
    readonly kind?: CustodianMove['kind'];
    readonly captures?: readonly string[];
    readonly expectedPieces: Readonly<Record<string, string>>;
  };
}

const SCENARIOS: DaiHasamiShogiScenario[] = [];
let counter = 1;
function add(s: Omit<DaiHasamiShogiScenario, 'id'>): void {
  SCENARIOS.push({ ...s, id: `DH-${String(counter++).padStart(3, '0')}` });
}

// ---------------------------------------------------------------------------
// Fundamentals — slide
// ---------------------------------------------------------------------------

add({
  description: 'Lone white man at e5 has 16 rook slides',
  pieces: { e5: 'm' },
  expectedMoveCount: 16,
});

// ---------------------------------------------------------------------------
// Non-capturing single-jump
// ---------------------------------------------------------------------------

add({
  description: 'White man jumps over an adjacent friendly to the empty square beyond',
  pieces: { e5: 'm', e6: 'm' },
  // From e5 N → e6 (friendly, blocks slide). Jump over e6 to e7 if e7 is empty. e7 empty. ✓
  // Total moves: e5 slides (S=4, E=4, W=4 = 12 + N=0 since blocked by e6) + 1 jump (e5→e7).
  // e6 slides: N=3, S=0 (blocked by e5), E=4, W=4 = 11. Plus jump e6→e4 over e5 (S direction, e5 occupied, e4 empty ✓).
  // Total = 12 + 1 + 11 + 1 = 25.
  expectedMoveCount: 25,
});
add({
  description: 'White man jumps over an adjacent enemy to the empty square beyond',
  pieces: { e5: 'm', e6: 'b' },
  // White turn. e5: N (0 — slide blocked by e6). Jump e5→e7 over e6 (enemy, allowed). e7 empty.
  // e5 other slides: S=4, E=4, W=4 = 12. Plus the jump. = 13.
  // Black pieces don't move on white turn.
  expectedMoveCount: 13,
});
add({
  description: 'Jump is illegal when target landing is occupied',
  pieces: { e5: 'm', e6: 'b', e7: 'm' },
  // Jump e5→e7 over e6 — but e7 is occupied. Jump suppressed.
  // e5 slides: N=0 (blocked by e6). S=4, E=4, W=4 = 12. Jump=0. Total e5 = 12.
  // e7 slides: N=2, S=0 (blocked by e6), E=4, W=4 = 10. Jump e7→e5 over e6 — e5 occupied, illegal. = 10.
  // Total = 22.
  expectedMoveCount: 22,
});
add({
  description: 'Jump is illegal when target landing would be off-board',
  pieces: { a8: 'm', a9: 'm' },
  // a8 N → a9 friendly. Jump a8→? would be (r=-1, c=0) off-board. 0 jumps.
  // a8 slides: S=7, E=8, W=0, N=0 = 15. (Plus jump=0.)
  // a9 slides: S=0 (blocked by a8 on the file… wait a9=(r=0,c=0), a8=(r=1,c=0). So S from a9 reaches a8 (blocked), then a7, a6... Let me recompute.
  //   a9 = (r=0, c=0). N off, S = (r=1..8, c=0). a8 (r=1) is friendly → blocks. So S = 0 squares.
  //   E = b9..i9 (8 squares). W off. = 8.
  //   Jump a9 over a8 to (r=2,c=0)=a7 — empty. Jump LEGAL.
  // a9 total: 8 slides + 1 jump = 9.
  // Total = 15 + 9 = 24.
  expectedMoveCount: 24,
});

// ---------------------------------------------------------------------------
// 5-in-a-row line formation tests covered in applyMove + gameOver tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bulk per-square coverage
// ---------------------------------------------------------------------------

const FILES_9 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const;
const RANKS_9 = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
for (const file of FILES_9) {
  for (const rank of RANKS_9) {
    const sq = `${file}${rank}`;
    add({
      description: `Bulk: lone white man at ${sq}`,
      pieces: { [sq]: 'm' },
      turn: 'white',
    });
    add({
      description: `Bulk: lone black man at ${sq} (black turn)`,
      pieces: { [sq]: 'b' },
      turn: 'black',
    });
  }
}

export const DAI_HASAMI_SHOGI_HAND_VERIFIED_SCENARIOS: readonly DaiHasamiShogiScenario[] =
  Object.freeze(SCENARIOS.map((s) => Object.freeze(s)));
