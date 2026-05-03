/**
 * Hand-verified Bashni scenarios for Task 29.1 acceptance.
 *
 * Each scenario is a starting tower layout (PDN-numbered squares 1..32 on the
 * 8×8 dark grid), with optional canonical-move + post-apply assertions.
 * Bashni differs from Lasca in:
 *
 *   - Backward capture for men (`menCaptureBackward: true`)
 *   - Flying-king movement and capture (`kingType: 'flying'`)
 *   - Mid-capture promotion (`midCapturePromotion: true`)
 *   - No max-mandatory pruning (`maximumCaptureMandatory: false`)
 *
 * Tower spec uses `m | M | b | B` (white-man, white-king, black-man,
 * black-king), bottom-first.
 *
 * PDN numbering (8×8 dark, parity 1):
 *   row 0: 1=b8 2=d8 3=f8 4=h8
 *   row 1: 5=a7 6=c7 7=e7 8=g7
 *   row 2: 9=b6 10=d6 11=f6 12=h6
 *   row 3: 13=a5 14=c5 15=e5 16=g5
 *   row 4: 17=b4 18=d4 19=f4 20=h4
 *   row 5: 21=a3 22=c3 23=e3 24=g3
 *   row 6: 25=b2 26=d2 27=f2 28=h2
 *   row 7: 29=a1 30=c1 31=e1 32=g1
 */

import type { StackingOwner } from '../types';

export interface BashniScenario {
  readonly id: string;
  readonly description: string;
  readonly pieces: Readonly<Record<string, string>>;
  readonly turn?: StackingOwner;
  readonly expectedMoveCount?: number;
  readonly canonical?: {
    readonly from: string;
    readonly to: string;
    readonly captures?: readonly string[];
    readonly expectedPieces: Readonly<Record<string, string>>;
  };
  /** Number of distinct legal capture chains expected (for non-mandatory choice). */
  readonly expectedCaptureCount?: number;
}

const SCENARIOS: BashniScenario[] = [];
let counter = 1;
function add(s: Omit<BashniScenario, 'id'>): void {
  SCENARIOS.push({ ...s, id: `B-${String(counter++).padStart(3, '0')}` });
}

// ---------------------------------------------------------------------------
// Step fundamentals (mostly identical to Lasca; verify on 8×8)
// ---------------------------------------------------------------------------

add({
  description: 'White man at c3 has two forward diagonals',
  pieces: { '22': 'm' },
  expectedMoveCount: 2,
  canonical: { from: 'c3', to: 'b4', expectedPieces: { '17': 'm' } },
});
add({
  description: 'Black man at c5 has two forward (south) diagonals',
  pieces: { '14': 'b' },
  turn: 'black',
  expectedMoveCount: 2,
  canonical: { from: 'c5', to: 'b4', expectedPieces: { '17': 'b' } },
});
add({
  description: 'White king at d4 (flying) has many diagonals',
  pieces: { '18': 'M' },
  // d4: nw → c5(14), b6(9), a7(5). ne → e5(15), f6(11), g7(8), h8(4). sw → c3(22), b2(25), a1(29). se → e3(23), f2(27), g1(32).
  expectedMoveCount: 3 + 4 + 3 + 3, // 13 destinations.
});
add({
  description: 'White king at corner a1 (flying) traces one diagonal across the board',
  pieces: { '29': 'M' },
  // a1: ne → b2(25), c3(22), d4(18), e5(15), f6(11), g7(8), h8(4) = 7 destinations.
  expectedMoveCount: 7,
});
add({
  description: 'White king at h8 (flying) traces one diagonal sw',
  pieces: { '4': 'M' },
  expectedMoveCount: 7,
});

// ---------------------------------------------------------------------------
// Capture — single short jump
// ---------------------------------------------------------------------------

add({
  description: 'White man at c3 forward-jumps b4 lands a5',
  pieces: { '22': 'm', '17': 'b' },
  expectedMoveCount: 1,
  canonical: { from: 'c3', to: 'a5', captures: ['b4'], expectedPieces: { '13': 'bm' } },
});
add({
  description: 'White man at c3 BACKWARD-jumps d2 lands e1 (Bashni allows backward man capture)',
  pieces: { '22': 'm', '26': 'b' },
  expectedMoveCount: 1,
  canonical: { from: 'c3', to: 'e1', captures: ['d2'], expectedPieces: { '31': 'bm' } },
});
add({
  description: 'Black man at b6 forward-jumps c5 lands d4 (Bashni black forward = south)',
  pieces: { '9': 'b', '14': 'm' },
  turn: 'black',
  expectedMoveCount: 1,
  // Black captures white: prisoner m at bottom; commander b on top.
  canonical: { from: 'b6', to: 'd4', captures: ['c5'], expectedPieces: { '18': 'mb' } },
});

// ---------------------------------------------------------------------------
// Mid-chain promotion (Bashni)
// ---------------------------------------------------------------------------

add({
  description: 'White man promotes mid-chain (at f8) and continues with king range to h6',
  // d6 (10) jumps e7 (7) → f8 (3). At f8 the man hits the white promotion row
  // and becomes a king. f8 king then jumps g7 (8) → h6 (12), capturing g7.
  // Just-captured towers (e7, g7) stay on the board as blockers, but the
  // king's continuation does not need to traverse them again.
  pieces: { '10': 'm', '7': 'b', '8': 'b' },
  canonical: {
    from: 'd6',
    to: 'h6',
    captures: ['e7', 'g7'],
    expectedPieces: { '12': 'bbM' },
  },
});

// ---------------------------------------------------------------------------
// Flying-king ray jumps
// ---------------------------------------------------------------------------

add({
  description: 'White flying king at a1 jumps a tower at d4 lands e5 / f6 / g7 / h8',
  pieces: { '29': 'M', '18': 'b' },
  // a1 → ne ray: b2(25,empty), c3(22,empty), d4(18,b), past d4: e5(15), f6(11), g7(8), h8(4). All empty → 4 landings.
  expectedMoveCount: 4,
  canonical: {
    from: 'a1',
    to: 'e5',
    captures: ['d4'],
    expectedPieces: { '15': 'bM' },
  },
});
add({
  description: 'Flying king blocked by friendly past victim (only one landing)',
  pieces: { '29': 'M', '18': 'b', '11': 'm' },
  // a1 ne → d4=b(victim), past it: e5(empty), f6(11=m friendly blocks). Landings: e5 only.
  expectedMoveCount: 1,
  canonical: {
    from: 'a1',
    to: 'e5',
    captures: ['d4'],
    expectedPieces: { '15': 'bM', '11': 'm' },
  },
});

// ---------------------------------------------------------------------------
// Non-maximal capture choice (Bashni)
// ---------------------------------------------------------------------------

add({
  description: 'Bashni allows player to pick a single-jump even when a double exists',
  pieces: { '22': 'm', '17': 'b', '13': 'b' },
  // c3 (22) ne → b4 (17, victim) past → a5 (13, occupied — but black, so could be a continuation? Actually a5 (13) is along ne ray from b4 = (3,0). a5=(3,0). Landing past 17=(4,1) ne is (3,0)=13. 13 is OCCUPIED → not a valid landing.
  //  So only 1 leg available — single jump c3→a5? Wait: 17 at (4,1), 13 at (3,0). Past 17 in nw direction = (3,0) = a5 = 13. 13 occupied = blocked. So no valid landing → capture impossible from c3 → b4.
  //  Try ne direction: c3 (22) ne → d4 (18, empty, no victim).
  //  Hmm, this layout doesn't expose a capture for white. Adjust.
});
SCENARIOS.pop();
counter -= 1;

add({
  description: 'Bashni: white man with two single captures (forward + backward) — both legal',
  pieces: { '22': 'm', '17': 'b', '26': 'b' },
  // c3 forward (n*) jump 17 → past 17 = a5(13) empty. ✓
  // c3 backward (s*) jump 26 → past 26 = e1(31) empty. ✓
  expectedMoveCount: 2,
});
add({
  description: 'Bashni allows the player to choose either single (no max-mandatory pruning)',
  pieces: { '22': 'm', '17': 'b', '26': 'b' },
  expectedCaptureCount: 2,
});

// ---------------------------------------------------------------------------
// Stack mechanics on 8×8
// ---------------------------------------------------------------------------

add({
  description: 'Capture peels commander (height-2 victim) — remainder switches allegiance',
  pieces: { '22': 'm', '17': 'mb' },
  expectedMoveCount: 1,
  canonical: {
    from: 'c3',
    to: 'a5',
    captures: ['b4'],
    expectedPieces: { '13': 'bm', '17': 'm' },
  },
});
add({
  description: 'Capture of tall tower with mixed prisoners',
  pieces: { '22': 'm', '17': 'mbBb' },
  // Tower at 17: m (bottom), b, B, b (commander). Capture lifts b. Remainder: [m, b, B] (B-led, since top now is B).
  expectedMoveCount: 1,
  canonical: {
    from: 'c3',
    to: 'a5',
    captures: ['b4'],
    expectedPieces: { '13': 'bm', '17': 'mbB' },
  },
});

// ---------------------------------------------------------------------------
// Capture obligation
// ---------------------------------------------------------------------------

add({
  description: 'Bashni: capture obligation suppresses simple steps',
  pieces: { '22': 'm', '17': 'b' },
  expectedMoveCount: 1, // Only c3 → a5 capture (no steps).
});

// ---------------------------------------------------------------------------
// Bulk per-square coverage — every dark square × every commander variant
// ---------------------------------------------------------------------------

const ALL_SQUARES = Array.from({ length: 32 }, (_, i) => String(i + 1));
for (const sq of ALL_SQUARES) {
  add({
    description: `Bulk: lone white man at PDN ${sq}`,
    pieces: { [sq]: 'm' },
    turn: 'white',
  });
  add({
    description: `Bulk: lone black man at PDN ${sq} (black turn)`,
    pieces: { [sq]: 'b' },
    turn: 'black',
  });
  add({
    description: `Bulk: lone white king at PDN ${sq}`,
    pieces: { [sq]: 'M' },
    turn: 'white',
  });
  add({
    description: `Bulk: lone black king at PDN ${sq} (black turn)`,
    pieces: { [sq]: 'B' },
    turn: 'black',
  });
}

export const BASHNI_HAND_VERIFIED_SCENARIOS: readonly BashniScenario[] = Object.freeze(
  SCENARIOS.map((s) => Object.freeze(s)),
);
