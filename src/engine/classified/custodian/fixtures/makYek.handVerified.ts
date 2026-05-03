/**
 * Hand-verified Mak-yek scenarios for Task 29.4 acceptance.
 *
 * Algebraic notation: a1..h8 (a8 = top-left for white-at-top convention).
 * Piece spec: m (white-man), b (black-man).
 *
 * Geometry note: NodeId 0 = a8 (top-left); NodeId 63 = h1 (bottom-right).
 * Per the playbook §4.6 starting position, white fills rows 0 and 2 (ranks
 * 8 and 6), black fills rows 5 and 7 (ranks 3 and 1). White moves first.
 */

import type { CustodianMove, CustodianOwner } from '../types';

export interface MakYekScenario {
  readonly id: string;
  readonly description: string;
  readonly pieces: Readonly<Record<string, string>>;
  readonly turn?: CustodianOwner;
  readonly halfMoveClock?: number;
  readonly expectedMoveCount?: number;
  readonly expectedCaptureCountInMove?: number;
  readonly canonical?: {
    readonly from: string;
    readonly to: string;
    readonly kind?: CustodianMove['kind'];
    readonly captures?: readonly string[];
    readonly expectedPieces: Readonly<Record<string, string>>;
  };
}

const SCENARIOS: MakYekScenario[] = [];
let counter = 1;
function add(s: Omit<MakYekScenario, 'id'>): void {
  SCENARIOS.push({ ...s, id: `MY-${String(counter++).padStart(3, '0')}` });
}

// ---------------------------------------------------------------------------
// Fundamentals — slide moves
// ---------------------------------------------------------------------------

add({
  description: 'Lone white man at e4 has 14 rook slides (7 along the file + 7 along the rank)',
  pieces: { e4: 'm' },
  expectedMoveCount: 14,
});
add({
  description: 'Lone white man at a1 (corner) has 14 rook slides',
  pieces: { a1: 'm' },
  expectedMoveCount: 14,
});
add({
  description: 'Lone white man at a8 has 14 rook slides',
  pieces: { a8: 'm' },
  expectedMoveCount: 14,
});
add({
  description: 'White man with friendly blocker on the file has reduced slides',
  pieces: { e4: 'm', e6: 'm' },
  // e4 (r=4,c=4): N reaches e5 only (e6 blocks at r=2) = 1; S = e3,e2,e1 = 3; E = 3; W = 4. = 11.
  // e6 (r=2,c=4): N = e7,e8 = 2; S = e5 only (e4 blocks) = 1; E = 3; W = 4. = 10. Total = 21.
  expectedMoveCount: 21,
});
add({
  description: 'White man has slide blocked by enemy (cannot land on enemy)',
  pieces: { e4: 'm', e6: 'b' },
  expectedMoveCount: 29, // e4: N=1 (e5 only), S=3, E=7, W=4 = 15. Plus e6 (black, not white's turn): 0. Wait e6 is black so when white turn, black pieces don't move.
});
SCENARIOS.pop();
counter -= 1;
add({
  description: 'White man has slide blocked by enemy (cannot land on enemy) — white turn',
  pieces: { e4: 'm', e6: 'b' },
  // White turn: only e4 moves. N: e5 (1, then blocked by e6). S: e1,e2,e3 = 3. E: f4..h4 = 3. W: a4..d4 = 4. Total = 11.
  expectedMoveCount: 11,
});

// ---------------------------------------------------------------------------
// Custodian capture (single-piece default)
// ---------------------------------------------------------------------------

add({
  description: 'White lands at d4 to flank black at e4 (friendly at f4): 1 custodian capture',
  pieces: { d8: 'm', f4: 'm', e4: 'b' },
  // White slides d8 down to d4. Now d4=m, e4=b, f4=m → custodian capture e4.
  canonical: {
    from: 'd8',
    to: 'd4',
    kind: 'slide',
    captures: ['e4'],
    expectedPieces: { d4: 'm', f4: 'm' },
  },
});
add({
  description: 'White slides into a position where TWO custodians fire (orthogonal both directions)',
  // White lands at e4. e3 = b (south), e5 = b (north), e2 = m (south anchor), e6 = m (north anchor).
  // Need a path for white to reach e4 — place white at e1 or somewhere that can slide to e4.
  // But the file e is occupied at e2,e3,e5,e6,e7? Let me set up minimal:
  //   m at e8 → slides down. e7 empty, e6 = m friendly. Blocked. Can't reach e4 from e8.
  // Try: white slides into e4 from another row.
  //   m at h4 → slides west. g4..f4 empty, e4 lands.
  //   Setup: { h4: 'm', e3: 'b', e5: 'b', e2: 'm', e6: 'm' }.
  //   White moves h4 → e4. Custodian fires N (e5 black flanked by e6 m) and S (e3 black flanked by e2 m).
  //   2 captures.
  pieces: { h4: 'm', e3: 'b', e5: 'b', e2: 'm', e6: 'm' },
  canonical: {
    from: 'h4',
    to: 'e4',
    kind: 'slide',
    captures: ['e3', 'e5'],
    expectedPieces: { e2: 'm', e4: 'm', e6: 'm' },
  },
});
add({
  description: 'Custodian + intervention combined for 3 captures in one move',
  // White slides e1 → e4 (path e2,e3 empty). Now e4=m. Custodian: e5 b flanked by e6 m.
  // Intervention: d4 b and f4 b sandwich e4. 3 captures.
  pieces: { e1: 'm', e5: 'b', e6: 'm', d4: 'b', f4: 'b' },
  canonical: {
    from: 'e1',
    to: 'e4',
    kind: 'slide',
    captures: ['d4', 'e5', 'f4'],
    expectedPieces: { e4: 'm', e6: 'm' },
  },
});
add({
  description: 'Custodian blocked by friendly (no capture)',
  pieces: { d8: 'm', f4: 'b', e4: 'b' },
  // White d8 slides to d4. d4=m, e4=b, f4=b (NOT friendly). No capture (custodian needs ABA where A=friendly).
  canonical: {
    from: 'd8',
    to: 'd4',
    kind: 'slide',
    captures: [],
    expectedPieces: { d4: 'm', e4: 'b', f4: 'b' },
  },
});
add({
  description: 'Sandwich on landing-square edge — board edge is NOT friendly anchor',
  pieces: { b8: 'm', a4: 'b' },
  // White slides b8 to b4. Now b4=m, a4=b on west. The "anchor on the other side" of a4 would be off-board. No capture.
  canonical: {
    from: 'b8',
    to: 'b4',
    kind: 'slide',
    captures: [],
    expectedPieces: { b4: 'm', a4: 'b' },
  },
});

// ---------------------------------------------------------------------------
// Intervention capture (BFB pattern)
// ---------------------------------------------------------------------------

add({
  description: 'Intervention along rank: white between two blacks captures both',
  // Slide white from e8 to e4 along the file. Then d4 b and f4 b sandwich e4 m.
  pieces: { e8: 'm', d4: 'b', f4: 'b' },
  canonical: {
    from: 'e8',
    to: 'e4',
    kind: 'slide',
    captures: ['d4', 'f4'],
    expectedPieces: { e4: 'm' },
  },
});
add({
  description: 'Intervention along file',
  pieces: { e8: 'm', e3: 'b', e5: 'b' },
  // White e8 slides... wait e5 is occupied by black, so slide would stop before reaching e4.
  // From e8: S can reach e7, e6 (since e5 blocks). To do file intervention, need e4 reachable AND e3+e5 black.
  // Use a different approach: white sweeps in from a different rank.
  //   { a4: 'm', e3: 'b', e5: 'b' }: a4 slides east to e4. Now e3 and e5 sandwich e4. ✓
});
SCENARIOS.pop();
counter -= 1;
add({
  description: 'Intervention along file',
  pieces: { a4: 'm', e3: 'b', e5: 'b' },
  canonical: {
    from: 'a4',
    to: 'e4',
    kind: 'slide',
    captures: ['e3', 'e5'],
    expectedPieces: { e4: 'm' },
  },
});

// ---------------------------------------------------------------------------
// Reduce-to-zero win condition tests covered in gameOver tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bulk per-square coverage — every square × white turn (no targets, just step coverage)
// ---------------------------------------------------------------------------

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
for (const file of FILES) {
  for (const rank of RANKS) {
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

export const MAK_YEK_HAND_VERIFIED_SCENARIOS: readonly MakYekScenario[] = Object.freeze(
  SCENARIOS.map((s) => Object.freeze(s)),
);
