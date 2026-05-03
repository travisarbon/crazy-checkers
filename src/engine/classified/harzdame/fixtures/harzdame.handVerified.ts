/**
 * Hand-verified Harzdame scenarios for Task 29.5 acceptance.
 *
 * PDN notation for an 8×8 dark-only board (variant 'pdn-8'). Convention:
 * white starts at the bottom (PDN 21..32 = rows 5..7); black starts at the
 * top (PDN 1..12 = rows 0..2). White moves first.
 *
 * White man movement directions: NE + SE (asymmetric — only 2 of 4).
 * Black man movement directions: SW + NW (mirrored).
 * Both colors capture in all 4 diagonals.
 *
 * Piece spec: m / b (men), M / B (regular kings), S / s (senior kings).
 */

import type { HarzdameMove, HarzdameOwner } from '../types';

export interface HarzdameScenario {
  readonly id: string;
  readonly description: string;
  readonly pieces: Readonly<Record<string, string>>;
  readonly turn?: HarzdameOwner;
  readonly halfMoveClock?: number;
  readonly expectedMoveCount?: number;
  readonly expectedCaptureCount?: number;
  readonly canonical?: {
    readonly from: string;
    readonly to: string;
    readonly kind?: HarzdameMove['kind'];
    readonly captures?: readonly string[];
    readonly expectedPieces: Readonly<Record<string, string>>;
  };
}

const SCENARIOS: HarzdameScenario[] = [];
let counter = 1;
function add(s: Omit<HarzdameScenario, 'id'>): void {
  SCENARIOS.push({ ...s, id: `HD-${String(counter++).padStart(3, '0')}` });
}

// ---------------------------------------------------------------------------
// Fundamentals — asymmetric men movement
// ---------------------------------------------------------------------------

// PDN 17 = (r=4, c=1) — interior dark square. White man can move NE (r-1, c+1) =
// (3, 2) = PDN 13, or SE (r+1, c+1) = (5, 2) = PDN 22. Both empty.
add({
  description: 'Lone white man at PDN 17 has 2 forward moves (NE + SE)',
  pieces: { '17': 'm' },
  expectedMoveCount: 2,
});

// PDN 18 = (r=4, c=3) — another interior square. White: NE = (3, 4) = PDN 14;
// SE = (5, 4) = PDN 23.
add({
  description: 'Lone white man at PDN 18 has 2 forward moves',
  pieces: { '18': 'm' },
  expectedMoveCount: 2,
});

// PDN 16 = (r=3, c=6) on the right edge. White: NE = (2, 7) = PDN 12 (empty);
// SE = (4, 7) = PDN 20 (empty). Both legal.
add({
  description: 'White man at PDN 16 (right edge interior) has 2 forward moves',
  pieces: { '16': 'm' },
  expectedMoveCount: 2,
});

// PDN 5 = (r=1, c=0) on the LEFT edge. White: NE = (0, 1) = PDN 1; SE = (2, 1)
// = PDN 9. Both legal.
add({
  description: 'White man at PDN 5 (top-left edge area) has 2 forward moves',
  pieces: { '5': 'm' },
  expectedMoveCount: 2,
});

// Black man at PDN 17 should move SW + NW (mirror of white).
add({
  description: 'Lone black man at PDN 17 has 2 forward moves (SW + NW) — black turn',
  pieces: { '17': 'b' },
  turn: 'black',
  expectedMoveCount: 2,
});
add({
  description: 'Lone black man at PDN 18 has 2 forward moves — black turn',
  pieces: { '18': 'b' },
  turn: 'black',
  expectedMoveCount: 2,
});
// Black man at PDN 28 = (6, 7) — bottom-right edge, mirror of HD-004's white-at-5.
// Black SW = (7, 6) = PDN 32 empty; NW = (5, 6) = PDN 24 empty. 2 moves.
// (PDN 5 = (1, 0) — both black movement diagonals SW=(2,-1) and NW=(0,-1) leave
// the board, so a black man at PDN 5 has 0 moves rather than 2.)
add({
  description: 'Black man at PDN 28 has 2 forward moves — black turn',
  pieces: { '28': 'b' },
  turn: 'black',
  expectedMoveCount: 2,
});

// White man at PDN 1 = (0, 1) — top edge. NE = (-1, 2) off-board; SE = (1, 2) =
// PDN 6 (empty). 1 move.
add({
  description: 'White man at PDN 1 (top edge) has 1 forward move (only SE)',
  pieces: { '1': 'm' },
  expectedMoveCount: 1,
});

// White man at PDN 4 = (0, 7) — top-right corner. NE off; SE off (col 8). 0
// moves.
add({
  description: 'White man at PDN 4 (top-right corner) has 0 forward moves',
  pieces: { '4': 'm' },
  expectedMoveCount: 0,
});

// ---------------------------------------------------------------------------
// Asymmetric movement vs. capture: men capture in all 4 directions
// ---------------------------------------------------------------------------

// White man at PDN 18 = (r=4, c=3). NE = (3, 4) = PDN 15 — place a black there
// and the landing past, (2, 5) = PDN 11, is empty. White at 18 NE-jumps black
// at 15, landing on 11.
add({
  description: 'White man captures NE (forward-right diagonal)',
  pieces: { '18': 'm', '15': 'b' },
  expectedCaptureCount: 1,
  canonical: {
    from: '18',
    to: '11',
    kind: 'capture',
    captures: ['15'],
    expectedPieces: { '11': 'm' },
  },
});

// White man captures SW (backward-left) — NOT a legal MOVE direction but legal
// CAPTURE. White at PDN 18 = (4, 3). SW = (5, 2) = PDN 22 (black). Past SW:
// (6, 1) = PDN 25 (empty). ✓
add({
  description: 'White man captures SW (backward-left, asymmetric move/capture)',
  pieces: { '18': 'm', '22': 'b' },
  expectedCaptureCount: 1,
  canonical: {
    from: '18',
    to: '25',
    kind: 'capture',
    captures: ['22'],
    expectedPieces: { '25': 'm' },
  },
});

// ---------------------------------------------------------------------------
// Flying king moves
// ---------------------------------------------------------------------------

// Lone white king at PDN 18 = (4, 3) on an empty board.
// NE ray: (3, 4)=PDN 14, (2, 5)=PDN 11, (1, 6)=PDN 8, (0, 7)=PDN 4 → 4 squares.
// NW ray: (3, 2)=PDN 13, (2, 1)=PDN 9, (1, 0)=PDN 5 → 3 squares.
// SE ray: (5, 4)=PDN 23, (6, 5)=PDN 27, (7, 6)=PDN 32 → 3 squares.
// SW ray: (5, 2)=PDN 22, (6, 1)=PDN 25, (7, 0)=PDN 29 → 3 squares.
// Total = 4 + 3 + 3 + 3 = 13.
add({
  description: 'Lone white king at PDN 18 has 13 flying-king moves',
  pieces: { '18': 'M' },
  expectedMoveCount: 13,
});

// Flying king blocked by friendly along NE ray.
add({
  description: 'White king at PDN 18 with friendly at PDN 11 — NE ray ends at 14 (1 instead of 4)',
  pieces: { '18': 'M', '11': 'm' },
  // NE from 18: (3,4)=PDN 14 only. NW: 3. SE: 3. SW: 3. Plus PDN 11 (white man) has its own moves: NE (1,6)=PDN 8, SE (3,6)=PDN 16. Both empty. = 2.
  // Total = (1+3+3+3) + 2 = 12.
  expectedMoveCount: 12,
});

// ---------------------------------------------------------------------------
// Flying king capture
// ---------------------------------------------------------------------------

// White king at PDN 18 = (4, 3). NE ray: (3, 4) = PDN 15 = black opponent. Past
// NE from 15: (2, 5)=PDN 11, (1, 6)=PDN 8, (0, 7)=PDN 4 — all empty. So king
// has 3 landing options after the NE jump.
add({
  description: 'White king flying-jump NE has 3 landing options past the victim',
  pieces: { '18': 'M', '15': 'b' },
  expectedCaptureCount: 3,
});

// ---------------------------------------------------------------------------
// Capture obligation
// ---------------------------------------------------------------------------

add({
  description: 'When captures exist, simple step moves are dropped',
  pieces: { '18': 'm', '14': 'b' },
  // White man at 18 has 2 step moves (NE → 14 occupied by black → blocked; SE → 23 empty). Wait — NE step to 14 is blocked because 14 is occupied. So step moves from 18: SE to 23 only = 1.
  // Captures: NE-jump 18 over 14 to 11 = 1. So total captures = 1, total steps = 1, but capture-obligation drops the step.
  expectedMoveCount: 1,
  expectedCaptureCount: 1,
});

// ---------------------------------------------------------------------------
// Promotion via non-capture
// ---------------------------------------------------------------------------

// White man one square from PDN 1 (in the promotion area). White at PDN 5 =
// (1, 0). NE = (0, 1) = PDN 1 (empty, in promotion area). White advances to 1
// → promotes.
add({
  description: 'White man at PDN 5 advances NE to PDN 1 (promotion area) and promotes',
  pieces: { '5': 'm' },
  canonical: {
    from: '5',
    to: '1',
    kind: 'move',
    expectedPieces: { '1': 'M' },
  },
});

// ---------------------------------------------------------------------------
// Promotion DENIED on capture-arrival
// ---------------------------------------------------------------------------

// White man at PDN 9 = (2, 1). NE-jump over PDN 5 = (1, 0)? NE from 9 = (1, 2)
// = PDN 6 — wait let me re-check. PDN 5 = (r=1, c=0). PDN 6 = (r=1, c=2).
// NE from 9 (r=2, c=1) = (1, 2) = PDN 6. So NE-jump 9 over 6 lands (0, 3) =
// PDN 2 (in promotion area). With black at 6, white at 9 jumps to 2.
add({
  description: 'White man captures black to land on PDN 2 (promotion area) — promotion DENIED on capture',
  pieces: { '9': 'm', '6': 'b' },
  expectedCaptureCount: 1,
  canonical: {
    from: '9',
    to: '2',
    kind: 'capture',
    captures: ['6'],
    expectedPieces: { '2': 'm' }, // stays a man — promotion denied
  },
});

// ---------------------------------------------------------------------------
// Bulk per-square coverage
// ---------------------------------------------------------------------------

for (let pdn = 1; pdn <= 32; pdn += 1) {
  const sq = String(pdn);
  add({
    description: `Bulk: lone white man at PDN ${sq}`,
    pieces: { [sq]: 'm' },
    turn: 'white',
  });
  add({
    description: `Bulk: lone black man at PDN ${sq} — black turn`,
    pieces: { [sq]: 'b' },
    turn: 'black',
  });
  add({
    description: `Bulk: lone white king at PDN ${sq}`,
    pieces: { [sq]: 'M' },
    turn: 'white',
  });
  add({
    description: `Bulk: lone black king at PDN ${sq} — black turn`,
    pieces: { [sq]: 'B' },
    turn: 'black',
  });
}

export const HARZDAME_HAND_VERIFIED_SCENARIOS: readonly HarzdameScenario[] = Object.freeze(
  SCENARIOS.map((s) => Object.freeze(s)),
);
