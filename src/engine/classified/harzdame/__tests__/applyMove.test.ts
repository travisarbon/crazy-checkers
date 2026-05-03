import { describe, expect, it } from 'vitest';
import { applyHarzdameMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { buildState, pieceSpecAt } from '../testHelpers';
import { createHarzdameConfig, type HarzdameConfig, type HarzdameMove } from '../types';

const CFG = createHarzdameConfig();

describe('applyHarzdameMove — step move + promotion', () => {
  it('non-capturing step into promotion area promotes a man to king', () => {
    const state = buildState({ pieces: { '5': 'm' } });
    const moves = computeLegalMoves(state, CFG);
    const move = moves.find((m) => m.from === '5' && m.to === '1') as HarzdameMove;
    expect(move).toBeDefined();
    const next = applyHarzdameMove(state, move, CFG);
    expect(pieceSpecAt(next, '1', CFG)).toBe('M');
  });

  it('non-capturing step outside promotion area does not promote', () => {
    const state = buildState({ pieces: { '17': 'm' } });
    const moves = computeLegalMoves(state, CFG);
    const move = moves.find((m) => m.from === '17' && m.to === '14') as HarzdameMove;
    expect(move).toBeDefined();
    const next = applyHarzdameMove(state, move, CFG);
    expect(pieceSpecAt(next, '14', CFG)).toBe('m');
  });
});

describe('applyHarzdameMove — capture-arrival promotion DENIAL', () => {
  it('man landing on promotion area via capture stays a man', () => {
    const state = buildState({ pieces: { '9': 'm', '6': 'b' } });
    const moves = computeLegalMoves(state, CFG);
    const move = moves.find((m) => m.kind === 'capture' && m.from === '9' && m.to === '2') as HarzdameMove;
    expect(move).toBeDefined();
    const next = applyHarzdameMove(state, move, CFG);
    // PDN 2 IS in the promotion area for white; man does NOT promote on capture-arrival.
    expect(pieceSpecAt(next, '2', CFG)).toBe('m');
  });
});

describe('applyHarzdameMove — capture chain mechanics', () => {
  it('removes all victims from the pieces map', () => {
    // Two-leg NE chain: 18 → over 15 → 11 → over 8 → 4.
    const state = buildState({
      pieces: { '18': 'm', '15': 'b', '8': 'b' },
    });
    const moves = computeLegalMoves(state, CFG);
    const longChain = moves.find((m) => m.kind === 'capture' && m.capture.length === 2) as HarzdameMove;
    expect(longChain).toBeDefined();
    const next = applyHarzdameMove(state, longChain, CFG);
    expect(pieceSpecAt(next, '15', CFG)).toBe('_');
    expect(pieceSpecAt(next, '8', CFG)).toBe('_');
  });

  it('senior-king flip on max-chain (default seniorKing.enabled=true)', () => {
    // White king at PDN 18 jumping over a black at PDN 14 to PDN 4 (the only
    // landing past 14 along NE that we'll force by placing a friendly past 4).
    // Actually the king's NE ray from 18 is: jump 14 lands on {11, 8, 4}. We
    // need to ensure exactly one chain length so it's both a valid chain AND
    // the position-max chain.
    // Simpler: use a position with only one capture chain available, and
    // verify the king becomes senior.
    const state = buildState({ pieces: { '18': 'M', '14': 'b' } });
    const moves = computeLegalMoves(state, CFG);
    const cap = moves[0] as HarzdameMove;
    expect(cap).toBeDefined();
    const next = applyHarzdameMove(state, cap, CFG);
    // The king completed the position-max chain (length 1; max = 1) → senior.
    const destNode = CFG.boardGeometry.coordinateLabels.parseNotation(cap.to);
    expect(destNode).not.toBeNull();
    if (destNode === null) return;
    const piece = next.pieces.get(destNode);
    expect(piece?.kind).toBe('king');
    expect(piece?.promoted).toBe(true);
  });

  it('senior-king flip suppressed when seniorKing.enabled=false', () => {
    const variant: HarzdameConfig = { ...CFG, seniorKing: { ...CFG.seniorKing, enabled: false } };
    const state = buildState({ config: variant, pieces: { '18': 'M', '14': 'b' } });
    const moves = computeLegalMoves(state, variant);
    const cap = moves[0] as HarzdameMove;
    const next = applyHarzdameMove(state, cap, variant);
    const destNode = variant.boardGeometry.coordinateLabels.parseNotation(cap.to);
    if (destNode === null) return;
    const piece = next.pieces.get(destNode);
    expect(piece?.kind).toBe('king');
    expect(piece?.promoted === true).toBe(false);
  });

  it('senior status is monotonic: senior king completing a chain stays senior', () => {
    const state = buildState({ pieces: { '18': 'S', '14': 'b' } });
    const moves = computeLegalMoves(state, CFG);
    const cap = moves[0] as HarzdameMove;
    const next = applyHarzdameMove(state, cap, CFG);
    const destNode = CFG.boardGeometry.coordinateLabels.parseNotation(cap.to);
    if (destNode === null) return;
    const piece = next.pieces.get(destNode);
    expect(piece?.promoted).toBe(true);
  });
});

describe('applyHarzdameMove — invariants', () => {
  it('input state is never mutated', () => {
    const state = buildState({ pieces: { '17': 'm' } });
    const moves = computeLegalMoves(state, CFG);
    const piecesSnap = JSON.stringify([...state.pieces.entries()]);
    applyHarzdameMove(state, moves[0] as HarzdameMove, CFG);
    expect(JSON.stringify([...state.pieces.entries()])).toBe(piecesSnap);
  });

  it('plyCount increments by 1', () => {
    const state = buildState({ pieces: { '17': 'm' } });
    const next = applyHarzdameMove(
      state,
      computeLegalMoves(state, CFG)[0] as HarzdameMove,
      CFG,
    );
    expect(next.plyCount).toBe(1);
  });

  it('halfMoveClock resets to 0 on capture', () => {
    const state = buildState({
      pieces: { '18': 'm', '14': 'b' },
      halfMoveClock: 7,
    });
    const moves = computeLegalMoves(state, CFG);
    const next = applyHarzdameMove(state, moves[0] as HarzdameMove, CFG);
    expect(next.meta.halfMoveClock).toBe(0);
  });

  it('halfMoveClock increments on a non-capture step', () => {
    const state = buildState({
      pieces: { '17': 'm' },
      halfMoveClock: 3,
    });
    const moves = computeLegalMoves(state, CFG);
    const next = applyHarzdameMove(state, moves[0] as HarzdameMove, CFG);
    expect(next.meta.halfMoveClock).toBe(4);
  });

  it('turn toggles after each move', () => {
    const state = buildState({ pieces: { '17': 'm' } });
    const next = applyHarzdameMove(
      state,
      computeLegalMoves(state, CFG)[0] as HarzdameMove,
      CFG,
    );
    expect(next.turn).toBe('black');
  });

  it('seniorKings cache reflects post-move senior status', () => {
    const state = buildState({ pieces: { '18': 'M', '14': 'b' } });
    const moves = computeLegalMoves(state, CFG);
    const next = applyHarzdameMove(state, moves[0] as HarzdameMove, CFG);
    expect((next.meta.seniorKings ?? []).length).toBeGreaterThan(0);
  });
});
