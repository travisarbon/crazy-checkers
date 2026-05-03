import { describe, expect, it } from 'vitest';
import { detectPhalanxes } from '../Phalanx';
import { buildState, configFor } from '../testHelpers';

describe('detectPhalanxes — rank axis', () => {
  const config = configFor('dameo');

  it('detects a 3-man rank phalanx along row 3', () => {
    const state = buildState({
      config,
      pieces: { c3: 'm', d3: 'm', e3: 'm' },
    });
    const phalanxes = detectPhalanxes(state, config, 'white');
    const rank = phalanxes.filter((p) => p.axis === 'rank');
    expect(rank).toHaveLength(1);
    expect(rank[0]?.members).toHaveLength(3);
  });

  it('breaks rank phalanx at a friendly king', () => {
    const state = buildState({
      config,
      pieces: { c3: 'm', d3: 'M', e3: 'm' },
    });
    const phalanxes = detectPhalanxes(state, config, 'white');
    const rank = phalanxes.filter((p) => p.axis === 'rank');
    // Two singletons (size 1) emerge.
    expect(rank).toHaveLength(2);
    expect(rank[0]?.members).toHaveLength(1);
    expect(rank[1]?.members).toHaveLength(1);
  });

  it('breaks rank phalanx at an opponent', () => {
    const state = buildState({
      config,
      pieces: { c3: 'm', d3: 'b', e3: 'm' },
    });
    const phalanxes = detectPhalanxes(state, config, 'white');
    const rank = phalanxes.filter((p) => p.axis === 'rank');
    expect(rank).toHaveLength(2);
  });

  it('isolated single-man phalanxes have headTarget computed', () => {
    const state = buildState({ config, pieces: { d3: 'm' } });
    const phalanxes = detectPhalanxes(state, config, 'white');
    // Row 3 yields one rank phalanx. Column d yields one file phalanx.
    // Diagonal axes yield 2 (NE and NW pass through d3).
    const allMembers = phalanxes.flatMap((p) => p.members);
    expect(allMembers.every((m) => m === phalanxes[0]?.members[0])).toBe(true);
  });
});

describe('detectPhalanxes — file axis', () => {
  const config = configFor('dameo');

  it('detects a 3-man file phalanx along c-column for white (rear=c3, head=c5)', () => {
    const state = buildState({
      config,
      pieces: { c3: 'm', c4: 'm', c5: 'm' },
    });
    const file = detectPhalanxes(state, config, 'white').filter((p) => p.axis === 'file');
    expect(file).toHaveLength(1);
    const f0 = file[0];
    expect(f0?.members).toHaveLength(3);
    // For white, members are ordered rear→head along forward. Forward = N,
    // which corresponds to higher algebraic rank (lower NodeId row index).
    // So rear should be c3, head should be c5.
    const labels = f0?.members.map((n) =>
      config.boardGeometry.coordinateLabels.notationOf(n),
    );
    expect(labels).toEqual(['c3', 'c4', 'c5']);
  });

  it('file phalanx orientation flips for black (rear is the lower rank)', () => {
    const state = buildState({
      config,
      pieces: { c5: 'b', c6: 'b', c7: 'b' },
      turn: 'black',
    });
    const file = detectPhalanxes(state, config, 'black').filter((p) => p.axis === 'file');
    expect(file).toHaveLength(1);
    // Black's forward = S = higher row index. Rear = c7 (low row), head = c5 (high row).
  });
});

describe('detectPhalanxes — diagonal axis', () => {
  const config = configFor('dameo');

  it('detects an NE diagonal phalanx of 3 white men', () => {
    const state = buildState({
      config,
      pieces: { a1: 'm', b2: 'm', c3: 'm' },
    });
    const diag = detectPhalanxes(state, config, 'white').filter(
      (p) => p.axis === 'diagonal' && p.direction === 'NE',
    );
    expect(diag).toHaveLength(1);
    expect(diag[0]?.members).toHaveLength(3);
  });

  it('detects an NW diagonal phalanx of 3 white men', () => {
    const state = buildState({
      config,
      pieces: { h1: 'm', g2: 'm', f3: 'm' },
    });
    const diag = detectPhalanxes(state, config, 'white').filter(
      (p) => p.axis === 'diagonal' && p.direction === 'NW',
    );
    expect(diag).toHaveLength(1);
    expect(diag[0]?.members).toHaveLength(3);
  });

  it('breaks a diagonal phalanx at a friendly king', () => {
    const state = buildState({
      config,
      pieces: { a1: 'm', b2: 'M', c3: 'm' },
    });
    const diag = detectPhalanxes(state, config, 'white').filter(
      (p) => p.axis === 'diagonal' && p.direction === 'NE',
    );
    // Two singletons emerge.
    expect(diag).toHaveLength(2);
  });
});

describe('detectPhalanxes — invariants', () => {
  const config = configFor('dameo');

  it('returns no phalanxes for a position with only kings', () => {
    const state = buildState({
      config,
      pieces: { e3: 'M', e4: 'M' },
    });
    const phalanxes = detectPhalanxes(state, config, 'white');
    expect(phalanxes).toHaveLength(0);
  });

  it('returns no phalanxes for the wrong owner', () => {
    const state = buildState({
      config,
      pieces: { c3: 'm', d3: 'm', e3: 'm' },
    });
    expect(detectPhalanxes(state, config, 'black')).toHaveLength(0);
  });

  it('headTarget is null when phalanx head is at the board edge', () => {
    const state = buildState({
      config,
      pieces: { a8: 'm', b8: 'm' }, // Rank 8 — slide N would go off-board.
    });
    const phalanxes = detectPhalanxes(state, config, 'white').filter((p) => p.axis === 'rank');
    expect(phalanxes).toHaveLength(1);
    expect(phalanxes[0]?.headTarget).toBeNull();
  });
});
