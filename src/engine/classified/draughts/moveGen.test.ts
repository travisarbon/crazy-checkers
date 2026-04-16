/**
 * moveGen — simple moves, short-king jumps, flying-king jumps, direction
 * dispatch, promotion variants, Italian filter, Frisian orthogonal-limited
 * landings, removal-timing distinctions.
 *
 * Convention: on dark-only boards, dark squares satisfy `(row + col) % 2 === 1`.
 * All test placements honour this.
 */

import { describe, expect, it } from 'vitest';
import {
  createArmenianDraughtsConfig,
  createBrazilianDraughtsConfig,
  createFrisianDraughtsConfig,
  createInternationalCheckersConfig,
  createItalianDraughtsConfig,
  createMalaysianCheckersConfig,
  createRussianDraughtsConfig,
  createTurkishDraughtsConfig,
} from './DraughtsConfig';
import {
  generateSimpleMoves,
  generateJumpSequences,
  reflectForOwner,
} from './moveGen';
import { makeState, labelOf } from './testHelpers';

describe('reflectForOwner', () => {
  it('white returns input unchanged', () => {
    expect(reflectForOwner(['nw', 'ne'], 'white')).toEqual(['nw', 'ne']);
  });
  it('black inverts diagonals', () => {
    expect(reflectForOwner(['nw', 'ne'], 'black')).toEqual(['se', 'sw']);
  });
  it('black inverts orthogonals', () => {
    expect(reflectForOwner(['n', 'e', 'w'], 'black')).toEqual(['s', 'w', 'e']);
  });
});

describe('simple moves — forward-only diagonal (Russian)', () => {
  const config = createRussianDraughtsConfig();

  it('a lone white man on (5,2) can step to (4,1) and (4,3)', () => {
    // (5,2): 5+2=7 odd → dark.
    const state = makeState(config, [{ row: 5, col: 2, owner: 'white', kind: 'man' }], 'white');
    const moves = generateSimpleMoves(state, config);
    const tos = moves.map((m) => m.to).sort();
    expect(tos).toEqual([labelOf(config, 4, 1), labelOf(config, 4, 3)].sort());
    for (const m of moves) {
      expect(m.kind).toBe('simple');
      expect(m.piece).toBe('man');
    }
  });

  it('black man moves forward (increasing row)', () => {
    // (2,3): 2+3=5 odd → dark.
    const state = makeState(config, [{ row: 2, col: 3, owner: 'black', kind: 'man' }], 'black');
    const moves = generateSimpleMoves(state, config);
    const tos = moves.map((m) => m.to).sort();
    expect(tos).toEqual([labelOf(config, 3, 2), labelOf(config, 3, 4)].sort());
  });

  it('a pinned man emits zero moves', () => {
    // White (5,2) blocked by white (4,1) and (4,3).
    const state = makeState(
      config,
      [
        { row: 5, col: 2, owner: 'white', kind: 'man' },
        { row: 4, col: 1, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'white', kind: 'man' },
      ],
      'white',
    );
    const pinnedMoves = generateSimpleMoves(state, config).filter(
      (m) => m.from === labelOf(config, 5, 2),
    );
    expect(pinnedMoves.length).toBe(0);
  });
});

describe('flying king simple moves (Russian)', () => {
  const config = createRussianDraughtsConfig();

  it('flying king emits every empty diagonal square along each ray', () => {
    // (3,2): 3+2=5 odd → dark.
    const state = makeState(
      config,
      [{ row: 3, col: 2, owner: 'white', kind: 'king' }],
      'white',
    );
    const moves = generateSimpleMoves(state, config);
    // nw: (2,1),(1,0) = 2; ne: (2,3),(1,4),(0,5) = 3;
    // sw: (4,1),(5,0) = 2; se: (4,3),(5,4),(6,5),(7,6) = 4 → 11 total.
    expect(moves.length).toBe(11);
  });

  it('ray stops at the first occupied square', () => {
    const state = makeState(
      config,
      [
        { row: 3, col: 2, owner: 'white', kind: 'king' },
        { row: 5, col: 4, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const tos = generateSimpleMoves(state, config).map((m) => m.to);
    expect(tos).toContain(labelOf(config, 4, 3));
    expect(tos).not.toContain(labelOf(config, 5, 4));
    expect(tos).not.toContain(labelOf(config, 6, 5));
  });
});

describe('short-king simple moves (Italian)', () => {
  const config = createItalianDraughtsConfig();

  it('short king emits exactly the direction-count adjacent empties', () => {
    const state = makeState(
      config,
      [{ row: 3, col: 2, owner: 'white', kind: 'king' }],
      'white',
    );
    const moves = generateSimpleMoves(state, config);
    const tos = moves.map((m) => m.to).sort();
    expect(tos).toEqual(
      [
        labelOf(config, 2, 1),
        labelOf(config, 2, 3),
        labelOf(config, 4, 1),
        labelOf(config, 4, 3),
      ].sort(),
    );
  });
});

describe('jump — single-capture man (Russian)', () => {
  const config = createRussianDraughtsConfig();

  it('forward diagonal jump', () => {
    // (5,2) white man → jump (4,3) black → land (3,4). All dark.
    const state = makeState(
      config,
      [
        { row: 5, col: 2, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const moves = generateJumpSequences(state, config);
    expect(moves.length).toBe(1);
    expect(moves[0]?.from).toBe(labelOf(config, 5, 2));
    expect(moves[0]?.to).toBe(labelOf(config, 3, 4));
    expect(moves[0]?.capture).toEqual([labelOf(config, 4, 3)]);
  });

  it('Russian man can capture backward (diagonal both ways)', () => {
    // (3,2) white → jump (4,3) black → land (5,4). Backward.
    const state = makeState(
      config,
      [
        { row: 3, col: 2, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const moves = generateJumpSequences(state, config);
    expect(moves.map((m) => m.to)).toContain(labelOf(config, 5, 4));
  });
});

describe('jump — Italian men filter', () => {
  const config = createItalianDraughtsConfig();

  it('Italian man has no backward jump (forward-only capture dirs)', () => {
    const state = makeState(
      config,
      [
        { row: 3, col: 2, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    expect(generateJumpSequences(state, config).length).toBe(0);
  });

  it('Italian exploreJumps does not surface man-over-king jumps', () => {
    const state = makeState(
      config,
      [
        { row: 5, col: 2, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'black', kind: 'king' },
      ],
      'white',
    );
    expect(generateJumpSequences(state, config).length).toBe(0);
  });
});

describe('jump — flying king multiple landings (International)', () => {
  const config = createInternationalCheckersConfig();

  it('emits each empty landing past the victim along the ray', () => {
    // White king (2,1), black man (4,3). se ray: (5,4),(6,5),(7,6),(8,7),(9,8) = 5 landings.
    const state = makeState(
      config,
      [
        { row: 2, col: 1, owner: 'white', kind: 'king' },
        { row: 4, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const moves = generateJumpSequences(state, config);
    expect(moves.length).toBe(5);
    for (const m of moves) {
      expect(m.capture).toEqual([labelOf(config, 4, 3)]);
    }
  });
});

describe('jump — Turkish orthogonal movement', () => {
  const config = createTurkishDraughtsConfig();

  it('Turkish man captures eastward', () => {
    // Full-board 8×8; any row/col playable.
    const state = makeState(
      config,
      [
        { row: 4, col: 2, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const moves = generateJumpSequences(state, config);
    expect(moves.length).toBe(1);
    expect(moves[0]?.to).toBe(labelOf(config, 4, 4));
  });

  it('Turkish man cannot capture diagonally', () => {
    const state = makeState(
      config,
      [
        { row: 4, col: 2, owner: 'white', kind: 'man' },
        { row: 3, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    expect(generateJumpSequences(state, config).length).toBe(0);
  });

  it('Turkish flying king slides orthogonally any distance', () => {
    const state = makeState(
      config,
      [{ row: 4, col: 0, owner: 'white', kind: 'king' }],
      'white',
    );
    const moves = generateSimpleMoves(state, config);
    // n: 4, s: 3, e: 7 → 14.
    expect(moves.length).toBe(14);
  });

  it('Turkish full-board: pieces at any square, no dark-mask filter', () => {
    const state = makeState(
      config,
      [{ row: 0, col: 0, owner: 'white', kind: 'man' }],
      'white',
    );
    const moves = generateSimpleMoves(state, config);
    // Man at back row, owner white → no forward (row -1). Sideways: (0,1).
    // n excluded by bounds; e and w both allowed for Turkish.
    // Actually white man moves n,e,w on Turkish. n → off-board. e → (0,1).
    // w → off-board. So exactly one move.
    expect(moves.map((m) => m.to)).toContain(labelOf(config, 0, 1));
  });
});

describe('jump — Armenian orthogonal sideways capture', () => {
  const config = createArmenianDraughtsConfig();

  it('Armenian man captures east across an opponent', () => {
    const state = makeState(
      config,
      [
        { row: 4, col: 2, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const moves = generateJumpSequences(state, config);
    expect(moves.length).toBe(1);
    expect(moves[0]?.to).toBe(labelOf(config, 4, 4));
  });

  it('Armenian man cannot capture south (no backward capture)', () => {
    const state = makeState(
      config,
      [
        { row: 3, col: 3, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    expect(generateJumpSequences(state, config).length).toBe(0);
  });
});

describe('jump — Frisian orthogonal 2-step on dark-only', () => {
  const config = createFrisianDraughtsConfig();

  it('Frisian king captures orthogonally at 2-step spacing (dark-only)', () => {
    // White king (5,0), black man (5,2). Post Task 28.2.1: Frisian kings
    // fly on all six lines — orthogonal captures enumerate every empty
    // landing past the victim. On a dark-only 10×10, the 2-step spacing
    // means landings at (5,4), (5,6), (5,8) (three landings).
    const state = makeState(
      config,
      [
        { row: 5, col: 0, owner: 'white', kind: 'king' },
        { row: 5, col: 2, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const moves = generateJumpSequences(state, config).filter((m) =>
      m.capture.includes(labelOf(config, 5, 2)),
    );
    const landings = moves.map((m) => m.to);
    expect(landings).toContain(labelOf(config, 5, 4));
    expect(landings.length).toBeGreaterThan(1);
  });

  it('Frisian king captures diagonally with full ray landings', () => {
    const state = makeState(
      config,
      [
        { row: 1, col: 0, owner: 'white', kind: 'king' },
        { row: 3, col: 2, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const moves = generateJumpSequences(state, config).filter((m) =>
      m.capture.includes(labelOf(config, 3, 2)),
    );
    // se ray past (3,2): (4,3),(5,4),(6,5),(7,6),(8,7),(9,8) = 6.
    expect(moves.length).toBe(6);
  });
});

describe('jump — promotion variants', () => {
  it('Brazilian standard: man promotes on final back-row landing', () => {
    const config = createBrazilianDraughtsConfig();
    // White (2,1) man, black (1,2) man → land (0,3). All dark.
    const state = makeState(
      config,
      [
        { row: 2, col: 1, owner: 'white', kind: 'man' },
        { row: 1, col: 2, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const moves = generateJumpSequences(state, config);
    expect(moves.length).toBe(1);
    expect(moves[0]?.to).toBe(labelOf(config, 0, 3));
    expect(moves[0]?.promotion).toBe('king');
  });

  it('Russian mid-capture: continuation after reaching back row', () => {
    const config = createRussianDraughtsConfig();
    // White (2,1) man, black (1,2) man, black (1,4) man.
    // jump (1,2) → land (0,3); mid-capture promote to flying king;
    // diagonal ne from (0,3) won't find victim; sw from (0,3) blocked;
    // se from (0,3): (1,4) is adjacent but flying king scans — first piece at (1,4). Victim. Landing (2,5),(3,6),(4,7). All dark.
    const state = makeState(
      config,
      [
        { row: 2, col: 1, owner: 'white', kind: 'man' },
        { row: 1, col: 2, owner: 'black', kind: 'man' },
        { row: 1, col: 4, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const moves = generateJumpSequences(state, config);
    const doubleCapture = moves.find((m) => m.capture.length === 2);
    expect(doubleCapture).toBeDefined();
    expect(doubleCapture?.promotion).toBe('king');
    expect(doubleCapture?.meta?.promotionSquare).toBe(labelOf(config, 0, 3));
  });

  it('Brazilian end-of-turn: man continues as man mid-chain (Task 28.2.1)', () => {
    // Brazilian is now `'end-of-turn'`: a man reaching the back row mid-chain
    // stays a man and continues capturing. Promotion fires only if the
    // final landing is on the back row.
    const config = createBrazilianDraughtsConfig();
    const state = makeState(
      config,
      [
        { row: 2, col: 1, owner: 'white', kind: 'man' },
        { row: 1, col: 2, owner: 'black', kind: 'man' },
        { row: 1, col: 4, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const chain = generateJumpSequences(state, config);
    const doubleCapture = chain.find((m) => m.capture.length === 2);
    expect(doubleCapture).toBeDefined();
    // (2,1) → (0,3) → (2,5): final landing (2,5) is not the back row, so no promotion.
    expect(doubleCapture?.promotion).toBeUndefined();
    expect(doubleCapture?.piece).toBe('man');
  });
});

describe('capturedNodesInFlight meta key', () => {
  it('populated on end-of-sequence jumps (Russian)', () => {
    const config = createRussianDraughtsConfig();
    const state = makeState(
      config,
      [
        { row: 5, col: 2, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    const move = generateJumpSequences(state, config)[0];
    expect(move?.meta?.capturedNodesInFlight).toEqual([labelOf(config, 4, 3)]);
  });

  it('absent on simple moves', () => {
    const config = createRussianDraughtsConfig();
    const state = makeState(
      config,
      [{ row: 5, col: 2, owner: 'white', kind: 'man' }],
      'white',
    );
    const move = generateSimpleMoves(state, config)[0];
    expect(move?.meta?.capturedNodesInFlight).toBeUndefined();
  });
});

describe('Malaysian — simple + jump coexist at generator level', () => {
  const config = createMalaysianCheckersConfig();
  it('generator produces both sets; captureObligatory filtering is the class concern', () => {
    const state = makeState(
      config,
      [
        { row: 5, col: 2, owner: 'white', kind: 'man' },
        { row: 4, col: 3, owner: 'black', kind: 'man' },
      ],
      'white',
    );
    expect(generateSimpleMoves(state, config).length).toBeGreaterThan(0);
    expect(generateJumpSequences(state, config).length).toBeGreaterThan(0);
  });
});
