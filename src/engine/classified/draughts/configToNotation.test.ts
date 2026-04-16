/**
 * configToNotation — routing coverage and per-variant capture annotation
 * (Task 28.1 §7.6).
 */

import { describe, expect, it } from 'vitest';
import {
  TIER_1_DRAUGHTS_GAME_IDS,
  createDraughtsConfig,
  type DraughtsGameId,
} from './DraughtsConfig';
import { configToNotation } from './configToNotation';

const EXPECTED_ADAPTER_KEY: Record<DraughtsGameId, string> = {
  'russian-draughts': 'pdn-8',
  'brazilian-draughts': 'pdn-8',
  'italian-draughts': 'pdn-8',
  'international-checkers': 'pdn-10',
  frysk: 'pdn-frisian',
  'frisian-draughts': 'pdn-frisian',
  'malaysian-checkers': 'pdn-12',
  'canadian-draughts': 'pdn-12',
  'armenian-draughts': 'pdn-8-armenian',
  'turkish-draughts': 'pdn-8-turkish',
};

describe('configToNotation — routing (T-28.1-50)', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)('%s routes to the expected adapter key', (id) => {
    const config = createDraughtsConfig(id);
    const adapter = configToNotation(config);
    expect('adapterKey' in adapter && (adapter as { adapterKey: string }).adapterKey).toBe(
      EXPECTED_ADAPTER_KEY[id],
    );
  });

  it('routes are referentially stable per gameId', () => {
    for (const id of TIER_1_DRAUGHTS_GAME_IDS) {
      const c = createDraughtsConfig(id);
      expect(configToNotation(c)).toBe(configToNotation(c));
    }
  });
});

describe('pdn-8 (Russian/Brazilian/Italian) — basic notation', () => {
  const adapter = configToNotation(createDraughtsConfig('russian-draughts'));
  const state = { pieces: new Map() };

  it('notates a simple move as "from-to"', () => {
    const s = adapter.notate(state, { kind: 'move', from: '11', to: '15' });
    expect(s).toBe('11-15');
  });

  it('notates a single capture as "from×captured×to"', () => {
    const s = adapter.notate(state, {
      kind: 'capture',
      from: '24',
      to: '17',
      capture: ['20'],
    });
    expect(s).toBe('24×20×17');
  });

  it('parses "11-15" back to a simple move', () => {
    const m = adapter.parse(state, '11-15');
    expect(m?.kind).toBe('move');
    expect(m?.from).toBe('11');
    expect(m?.to).toBe('15');
  });

  it('parses "24×20×17" back to a capture with an intermediate', () => {
    const m = adapter.parse(state, '24×20×17');
    expect(m?.kind).toBe('capture');
    expect(m?.from).toBe('24');
    expect(m?.to).toBe('17');
    expect(m?.capture).toEqual(['20']);
  });
});

describe('pdn-frisian — dual-axis capture annotation (T-28.1-51a)', () => {
  const adapter = configToNotation(createDraughtsConfig('frisian-draughts'));
  const state = { pieces: new Map() };
  // PDN 10x10 dark-squares: squares are 1..50. The labeler maps nodeIds to
  // these square numbers. Rather than precompute labels, we construct moves
  // using actual labels derived from the geometry.
  const geometry = createDraughtsConfig('frisian-draughts').boardGeometry;
  const label = (row: number, col: number): string =>
    geometry.coordinateLabels.notationOf((row * 10 + col) as never);

  it('annotates a diagonal capture with ×/', () => {
    // from (3,1) to (5,3) jumping (4,2): diagonal leg.
    const from = label(3, 1);
    const mid = label(4, 2);
    const to = label(5, 3);
    const s = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    expect(s).toContain('×/');
    expect(s.startsWith(from)).toBe(true);
    expect(s.endsWith(to)).toBe(true);
  });

  it('annotates an orthogonal capture with ×⊥', () => {
    // from (3,1) to (3,5) jumping (3,3): orthogonal leg (same row).
    // Note: on a dark-squares-only 10×10, (3,1), (3,3), (3,5) are all dark.
    const from = label(3, 1);
    const mid = label(3, 3);
    const to = label(3, 5);
    const s = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    expect(s).toContain('×⊥');
  });

  it('annotates a mixed chain with both separators', () => {
    // from (3,1) → jump (4,2) → landing (5,3) diagonal
    //           → jump (5,5) → landing (5,7) orthogonal
    const from = label(3, 1);
    const mid1 = label(4, 2);
    const land1 = label(5, 3);
    const mid2 = label(5, 5);
    const to = label(5, 7);
    const s = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid1, land1, mid2],
    });
    // Diagonal legs encoded as ×/, orthogonal as ×⊥.
    expect(s).toMatch(/×\//);
    expect(s).toMatch(/×⊥/);
  });

  it('round-trips a simple orthogonal capture', () => {
    const from = label(3, 1);
    const mid = label(3, 3);
    const to = label(3, 5);
    const annotated = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    const parsed = adapter.parse(state, annotated);
    expect(parsed?.from).toBe(from);
    expect(parsed?.to).toBe(to);
    expect(parsed?.capture).toEqual([mid]);
  });

  it('parses a pure-diagonal chain back to capture tokens', () => {
    const from = label(3, 1);
    const mid = label(4, 2);
    const to = label(5, 3);
    const annotated = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    const parsed = adapter.parse(state, annotated);
    expect(parsed?.capture).toEqual([mid]);
  });
});

describe('pdn-8-armenian — orthogonal-capture annotation (T-28.1-51b)', () => {
  const adapter = configToNotation(createDraughtsConfig('armenian-draughts'));
  const state = { pieces: new Map() };
  const geometry = createDraughtsConfig('armenian-draughts').boardGeometry;
  const label = (row: number, col: number): string =>
    geometry.coordinateLabels.notationOf((row * 8 + col) as never);

  it('annotates an orthogonal capture with ×−', () => {
    // Men horizontal capture: (3,1) × (3,2) × (3,3)
    const from = label(3, 1);
    const mid = label(3, 2);
    const to = label(3, 3);
    const s = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    expect(s).toContain('×−');
  });

  it('annotates a diagonal capture with bare ×', () => {
    // Men diagonal: (3,1) × (4,2) × (5,3) — wait that's actually diagonal
    // For armenian men capture diagonal-forward is ne/nw.
    const from = label(5, 1);
    const mid = label(4, 2);
    const to = label(3, 3);
    const s = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    // Should contain × but not ×−
    expect(s.includes('×')).toBe(true);
    expect(s.includes('×−')).toBe(false);
  });

  it('annotates mixed legs', () => {
    const from = label(5, 1);
    const mid1 = label(4, 2);
    const land1 = label(3, 3);
    const mid2 = label(3, 4);
    const to = label(3, 5);
    const s = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid1, land1, mid2],
    });
    expect(s).toMatch(/×−/);
    expect(s).toContain('×');
  });

  it('round-trips a horizontal capture', () => {
    const from = label(3, 1);
    const mid = label(3, 2);
    const to = label(3, 3);
    const annotated = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    const parsed = adapter.parse(state, annotated);
    expect(parsed?.from).toBe(from);
    expect(parsed?.to).toBe(to);
    expect(parsed?.capture).toEqual([mid]);
  });

  it('parses a diagonal capture', () => {
    const from = label(5, 1);
    const mid = label(4, 2);
    const to = label(3, 3);
    const annotated = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    expect(adapter.parse(state, annotated)?.capture).toEqual([mid]);
  });
});

describe('pdn-8-turkish — uniform × separator (T-28.1-51c)', () => {
  const adapter = configToNotation(createDraughtsConfig('turkish-draughts'));
  const state = { pieces: new Map() };
  const geometry = createDraughtsConfig('turkish-draughts').boardGeometry;
  const label = (row: number, col: number): string =>
    geometry.coordinateLabels.notationOf((row * 8 + col) as never);

  it('annotates with bare ×', () => {
    const from = label(3, 1);
    const mid = label(3, 2);
    const to = label(3, 3);
    const s = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    expect(s).toContain('×');
    expect(s.includes('×−')).toBe(false);
    expect(s.includes('×⊥')).toBe(false);
    expect(s.includes('×/')).toBe(false);
  });

  it('annotates a vertical capture', () => {
    const from = label(3, 1);
    const mid = label(2, 1);
    const to = label(1, 1);
    const s = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid],
    });
    expect(s).toBe(`${from}×${mid}×${to}`);
  });

  it('annotates an L-shaped chain', () => {
    const from = label(5, 1);
    const mid1 = label(4, 1);
    const land = label(3, 1);
    const mid2 = label(3, 2);
    const to = label(3, 3);
    const s = adapter.notate(state, {
      kind: 'capture',
      from,
      to,
      capture: [mid1, land, mid2],
    });
    expect(s).toBe(`${from}×${mid1}×${land}×${mid2}×${to}`);
  });

  it('parses a simple move', () => {
    const from = label(5, 1);
    const to = label(4, 1);
    const m = adapter.parse(state, `${from}-${to}`);
    expect(m?.kind).toBe('move');
    expect(m?.from).toBe(from);
    expect(m?.to).toBe(to);
  });

  it('round-trips a simple capture', () => {
    const from = label(3, 1);
    const mid = label(3, 2);
    const to = label(3, 3);
    const notation = `${from}×${mid}×${to}`;
    const parsed = adapter.parse(state, notation);
    expect(parsed?.from).toBe(from);
    expect(parsed?.to).toBe(to);
    expect(parsed?.capture).toEqual([mid]);
  });
});
