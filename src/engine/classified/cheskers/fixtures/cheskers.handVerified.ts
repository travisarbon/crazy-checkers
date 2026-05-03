/**
 * Hand-verified Cheskers scenarios for Task 29.6 acceptance.
 *
 * Chess algebraic notation for an 8×8 dark-only board. Convention: white
 * back rank = rank 1 (rows 7); black back rank = rank 8 (rows 0). Black
 * moves first per playbook §4.10 (§1.5).
 *
 * Piece spec: P/p (pawn), K/k (king), B/b (bishop), C/c (camel).
 *
 * Each scenario covers one canonical situation; the loader in
 * `__tests__/moveGen.test.ts` runs three asserts per entry: legal-move
 * count matches; canonical move present; serializer round-trip.
 */

import type { CheskersMove, CheskersOwner } from '../types';

export interface CheskersScenario {
  readonly id: string;
  readonly description: string;
  readonly pieces: Readonly<Record<string, string>>;
  readonly turn?: CheskersOwner;
  readonly halfMoveClock?: number;
  readonly expectedMoveCount?: number;
  readonly expectedCaptureCount?: number;
  /** True iff at least one Pawn or King capture is mandatory in this position. */
  readonly mandatoryCapture?: boolean;
  readonly canonical?: {
    readonly from: string;
    readonly to: string;
    readonly kind?: CheskersMove['kind'];
    readonly captures?: readonly string[];
    readonly expectedPieces: Readonly<Record<string, string>>;
  };
}

const SCENARIOS: CheskersScenario[] = [];
let counter = 1;
function add(s: Omit<CheskersScenario, 'id'>): void {
  SCENARIOS.push({ ...s, id: `CK-${String(counter++).padStart(3, '0')}` });
}

// ---------------------------------------------------------------------------
// Pawn — step
// ---------------------------------------------------------------------------

// White Pawn at d2 with empty diagonals → 2 forward steps (NE = e3, NW = c3).
add({
  description: 'Lone white Pawn at d2 has 2 forward step moves',
  pieces: { d2: 'P' },
  turn: 'white',
  expectedMoveCount: 2,
});

// Black Pawn at e7 with empty diagonals → 2 forward steps (SE = f6, SW = d6).
add({
  description: 'Lone black Pawn at e7 has 2 forward step moves — black turn',
  pieces: { e7: 'p' },
  turn: 'black',
  expectedMoveCount: 2,
});

// White Pawn at a3 (left edge) → 1 forward step (NE = b4 only; NW off-board).
add({
  description: 'White Pawn at a3 (left edge) has 1 forward step',
  pieces: { a3: 'P' },
  turn: 'white',
  expectedMoveCount: 1,
});

// Black Pawn at h6 (right edge) → 1 forward step (SW = g5 only; SE off-board).
add({
  description: 'Black Pawn at h6 (right edge) has 1 forward step — black turn',
  pieces: { h6: 'p' },
  turn: 'black',
  expectedMoveCount: 1,
});

// Pawn forward-only — no backward moves.
// White at d4 with empty diagonals; black peer at e5 absent. White: NE = e5 (empty), NW = c5 (empty). Steps: 2.
add({
  description: 'White Pawn at d4 NEVER moves backward (no SE/SW step)',
  pieces: { d4: 'P' },
  turn: 'white',
  expectedMoveCount: 2,
  // both forward (e5, c5) — verified separately by direction-vocabulary test.
});

// ---------------------------------------------------------------------------
// Pawn — jump capture (mandatory)
// ---------------------------------------------------------------------------

// White Pawn d4, black piece e5 (NE), empty f6 → 1-jump chain.
add({
  description: 'White Pawn at d4 jumps black at e5 to f6 (single jump)',
  pieces: { d4: 'P', e5: 'p' },
  turn: 'white',
  expectedMoveCount: 1,
  expectedCaptureCount: 1,
  mandatoryCapture: true,
  canonical: {
    from: 'd4',
    to: 'f6',
    kind: 'pawn-jump',
    captures: ['e5'],
    expectedPieces: { f6: 'P' },
  },
});

// White Pawn d4, black at e5, empty f6, black at g7, empty h8 → 2-jump chain.
add({
  description: 'White Pawn at d4 jumps e5 then g7 (2-jump chain ending on back rank → promotion)',
  pieces: { d4: 'P', e5: 'p', g7: 'p' },
  turn: 'white',
  // Two-jump chain to h8 (back rank) → promote to King.
  // Note: short single-jump 18→f6 won't surface because immediate-removal-style
  // chain enumeration always extends locally-maximal chains.
  expectedCaptureCount: 1,
  mandatoryCapture: true,
  canonical: {
    from: 'd4',
    to: 'h8',
    kind: 'pawn-jump',
    captures: ['e5', 'g7'],
    expectedPieces: { h8: 'K' },
  },
});

// Black Pawn e5, white at d4 (SW from e5), empty c3 → 1-jump.
add({
  description: 'Black Pawn at e5 jumps white at d4 to c3 — black turn',
  pieces: { e5: 'p', d4: 'P' },
  turn: 'black',
  expectedCaptureCount: 1,
  mandatoryCapture: true,
  canonical: {
    from: 'e5',
    to: 'c3',
    kind: 'pawn-jump',
    captures: ['d4'],
    expectedPieces: { c3: 'p' },
  },
});

// ---------------------------------------------------------------------------
// Pawn — promotion via step (terminal arrival, no capture)
// ---------------------------------------------------------------------------

// White Pawn at a7 = (1, 0) — dark square on row 1 (one row before back rank).
// NE = (0, 1) = b8 (dark, on back rank) → promote. NW off-board.
add({
  description: 'White Pawn at a7 advances NE to b8 (back rank) and promotes to King',
  pieces: { a7: 'P' },
  turn: 'white',
  canonical: {
    from: 'a7',
    to: 'b8',
    kind: 'pawn-step',
    expectedPieces: { b8: 'K' },
  },
});

// ---------------------------------------------------------------------------
// King — step + jump capture (mandatory, 4 directions)
// ---------------------------------------------------------------------------

// Lone white King at d4 → 4 step moves (NE, NW, SE, SW each empty).
add({
  description: 'Lone white King at d4 has 4 step moves',
  pieces: { d4: 'K' },
  turn: 'white',
  expectedMoveCount: 4,
});

// White King at d4, black at c3 (SW of d4) → 1-jump SW.
add({
  description: 'White King at d4 jumps black at c3 (SW capture)',
  pieces: { d4: 'K', c3: 'p' },
  turn: 'white',
  // King capture obligation kicks in: only the jump (1 capture) returned.
  // The black at c3 is an enemy and adjacent; landing past it = b2.
  expectedMoveCount: 1,
  expectedCaptureCount: 1,
  mandatoryCapture: true,
  canonical: {
    from: 'd4',
    to: 'b2',
    kind: 'king-jump',
    captures: ['c3'],
    expectedPieces: { b2: 'K' },
  },
});

// ---------------------------------------------------------------------------
// Bishop — slide
// ---------------------------------------------------------------------------

// Lone white Bishop at d4 → slides on 4 diagonals; total accessible squares = 13.
//   NE: e5 f6 g7 h8 = 4; NW: c5 b6 a7 = 3; SE: e3 f2 g1 = 3; SW: c3 b2 a1 = 3. Sum 13.
add({
  description: 'Lone white Bishop at d4 has 13 slide moves',
  pieces: { d4: 'B' },
  turn: 'white',
  expectedMoveCount: 13,
});

// Bishop slide blocked by friendly. White Bishop d4, white Pawn at f6 (NE direction).
// NE ray now: e5 only (1 square; f6 blocks). Total: 1 + 3 + 3 + 3 = 10. Plus the white pawn at f6 has its own moves: NE = g7 (empty), NW = e7 (empty) → 2.
// Total = 10 + 2 = 12.
add({
  description: 'Bishop NE ray blocked by friendly Pawn at f6',
  pieces: { d4: 'B', f6: 'P' },
  turn: 'white',
  expectedMoveCount: 12,
});

// Bishop displacement capture. White Bishop d4, black Pawn at f6.
// NE ray: e5 (slide), then f6 occupied by enemy → emit displace, landing on f6.
// So NE ray contributes 1 slide + 1 displace = 2 moves.
// Plus NW (3) + SE (3) + SW (3) = 9. Bishop total = 11.
// Black pawn at f6 cannot move (it's not white's turn and we're checking white).
add({
  description: 'White Bishop at d4 displacement-captures black Pawn at f6',
  pieces: { d4: 'B', f6: 'p' },
  turn: 'white',
  expectedMoveCount: 11,
  // canonical: the displacement capture (not the slides).
  canonical: {
    from: 'd4',
    to: 'f6',
    kind: 'bishop-displace',
    captures: ['f6'],
    expectedPieces: { f6: 'B' },
  },
});

// ---------------------------------------------------------------------------
// Camel — (3, 1) leap
// ---------------------------------------------------------------------------

// Camel at d4 (row 3, col 3): (3,1) destinations relative to (3,3):
//   (0, 2) (0, 4) (2, 0) (2, 6) (4, 0) (4, 6) (6, 2) (6, 4)
// All on-board, all dark squares (verified by parity).
// As chess squares: (0,2)=c8, (0,4)=e8, (2,0)=a6, (2,6)=g6, (4,0)=a4, (4,6)=g4, (6,2)=c2, (6,4)=e2.
// 8 leap destinations.
add({
  description: 'Lone white Camel at d4 reaches 8 (3, 1) leap destinations',
  pieces: { d4: 'C' },
  turn: 'white',
  expectedMoveCount: 8,
});

// Camel at a1 (row 7, col 0). (3, 1) destinations: (4, -1) (4, 1) (6, -3) (6, 3) (8, -3) (8, 3) (10, -1) (10, 1).
// In-bounds: (4, 1) = b4; (6, 3) = d2. All others off-board. 2 destinations.
add({
  description: 'White Camel at a1 (corner) has 2 (3, 1) leap destinations',
  pieces: { a1: 'C' },
  turn: 'white',
  expectedMoveCount: 2,
});

// Camel jumping over intervening pieces (knight-like). White Camel d4 + arbitrary
// pieces at e4, e5, f4 (which would block a slider) — Camel still has 8 moves.
add({
  description: 'White Camel jumps over intervening pieces (knight-like)',
  pieces: { d4: 'C', e4: 'p', e5: 'p', f4: 'p' },
  // Pieces at e4, e5, f4 are enemies but not on Camel destinations.
  // Camel destinations from d4: c8, e8, a6, g6, a4, g4, c2, e2. None occupied.
  // 8 leap moves. Plus the enemies don't move on white's turn.
  // Wait — these black pawns could be captured by Pawn/King with mandatory capture
  // obligation if any white Pawn/King can jump them. There are no white Pawn/King
  // pieces in this setup. So no mandatory captures; full Camel mobility surfaces.
  turn: 'white',
  expectedMoveCount: 8,
});

// Camel displacement capture. White Camel d4 = (4, 3), black Pawn at c7 (a
// Camel (3, 1) destination at offset (-3, -1) = (1, 2)).
add({
  description: 'White Camel at d4 displacement-captures black Pawn at c7',
  pieces: { d4: 'C', c7: 'p' },
  turn: 'white',
  // 7 empty destinations (leaps) + 1 displacement capture.
  expectedMoveCount: 8,
  canonical: {
    from: 'd4',
    to: 'c7',
    kind: 'camel-displace',
    captures: ['c7'],
    expectedPieces: { c7: 'C' },
  },
});

// ---------------------------------------------------------------------------
// Dual capture-obligation regime
// ---------------------------------------------------------------------------

// Pawn capture exists AND Bishop displacement-capture exists → Bishop drops out.
// White Pawn at d4, black Pawn at e5 (NE-jump available from d4 to f6).
// White Bishop at a1, black Pawn at d4? No, d4 is white's Pawn.
// Set up: white Pawn d4 + black e5 (Pawn jump 1) + white Bishop f2 + black piece h4 (Bishop slide capture along NE).
// Actually the simpler test: Pawn jump + Bishop slide — verify Bishop slides are dropped.
add({
  description: 'When Pawn capture exists, Bishop slides are DROPPED (dual obligation)',
  pieces: { d4: 'P', e5: 'p', a1: 'B' },
  turn: 'white',
  expectedMoveCount: 1,
  expectedCaptureCount: 1,
  mandatoryCapture: true,
  // Only the pawn-jump d4 -> e5 -> f6 surfaces. The Bishop's 13 slides are dropped.
});

// No Pawn/King capture → all moves surface.
add({
  description: 'When no Pawn/King capture, Bishop + Camel moves surface',
  pieces: { a1: 'B', g1: 'C' },
  turn: 'white',
  // Bishop a1: NE ray = b2 c3 d4 e5 f6 g7 h8 = 7 squares. Other 3 rays go off-board.
  // Camel g1 (row 7, col 6): (3,1) offsets: (4,5)=f4 (4,7)=h4 (6,3)=d2 (6,9)=off
  //   (8,...)=off (10,...)=off. So 3 destinations: f4, h4, d2.
  // Total = 7 + 3 = 10.
  expectedMoveCount: 10,
});

// ---------------------------------------------------------------------------
// Black-moves-first scenario
// ---------------------------------------------------------------------------

// Initial position has black to move; verify black has at least one legal step.
// (Detailed assertion in startingPosition.test.ts; here we simply confirm the
// scenario loader handles black-default turn correctly.)
add({
  description: 'Black Pawn at e7 with white Pawn at d4 (no captures) — black to move surfaces 2 steps',
  pieces: { e7: 'p', d4: 'P' },
  turn: 'black',
  expectedMoveCount: 2,
});

export const CHESKERS_HAND_VERIFIED_SCENARIOS: readonly CheskersScenario[] = Object.freeze(
  SCENARIOS.map((s) => Object.freeze(s)),
);
