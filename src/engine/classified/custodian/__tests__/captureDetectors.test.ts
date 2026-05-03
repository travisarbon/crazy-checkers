import { describe, expect, it } from 'vitest';
import {
  findCornerCaptures,
  findCustodianCaptures,
  findImmobilizationCaptures,
  findInterventionCaptures,
  findLineCaptures,
} from '../captureDetectors';
import { createMakYekConfig } from '../makYekConfig';
import { createHasamiShogiConfig } from '../hasamiShogiConfig';
import { createRekConfig } from '../rekConfig';
import { buildState } from '../testHelpers';
import type { CustodianConfig } from '../types';

const MAK = createMakYekConfig();
const HSG = createHasamiShogiConfig();
const REK = createRekConfig();

function landing(label: string, config: CustodianConfig): import('../../../boardGeometry').NodeId {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) throw new Error(`bad label ${label}`);
  return node;
}

describe('findCustodianCaptures — single-piece pattern (Mak-yek default)', () => {
  it('captures a single black sandwiched between two whites', () => {
    const state = buildState({
      config: MAK,
      pieces: { d4: 'm', e4: 'b', f4: 'm' },
    });
    const caps = findCustodianCaptures(state.pieces, landing('d4', MAK), 'white', MAK);
    expect(caps.length).toBeGreaterThanOrEqual(1);
    // The capture target is e4.
    const e4Node = landing('e4', MAK) as unknown as number;
    expect(caps.map((n) => n as unknown as number)).toContain(e4Node);
  });

  it('does NOT capture when the far square is enemy (no friendly anchor)', () => {
    const state = buildState({
      config: MAK,
      pieces: { d4: 'm', e4: 'b', f4: 'b' },
    });
    const caps = findCustodianCaptures(state.pieces, landing('d4', MAK), 'white', MAK);
    expect(caps).toHaveLength(0);
  });

  it('does NOT capture when the far square is empty', () => {
    const state = buildState({
      config: MAK,
      pieces: { d4: 'm', e4: 'b' },
    });
    const caps = findCustodianCaptures(state.pieces, landing('d4', MAK), 'white', MAK);
    expect(caps).toHaveLength(0);
  });

  it('captures in multiple directions simultaneously', () => {
    // From e4, two custodian patterns: N (e5 b, e6 m) and S (e3 b, e2 m).
    const state = buildState({
      config: MAK,
      pieces: { e4: 'm', e3: 'b', e2: 'm', e5: 'b', e6: 'm' },
    });
    const caps = findCustodianCaptures(state.pieces, landing('e4', MAK), 'white', MAK);
    expect(caps).toHaveLength(2);
  });

  it('board edge does NOT substitute for a friendly anchor', () => {
    // Black at a4 (edge). e.g., m at b4 lands → custodian needs a friendly past a4 (off-board). No.
    const state = buildState({
      config: MAK,
      pieces: { b4: 'm', a4: 'b' },
    });
    const caps = findCustodianCaptures(state.pieces, landing('b4', MAK), 'white', MAK);
    expect(caps).toHaveLength(0);
  });
});

describe('findCustodianCaptures — whole-line knob', () => {
  it('captures every contiguous opponent in the direction terminated by friendly', () => {
    // Use a Mak-yek-derived config with 'whole-line' enabled.
    const variant: CustodianConfig = {
      ...MAK,
      capture: { ...MAK.capture, lineCapture: 'whole-line' },
    };
    const state = buildState({
      config: variant,
      pieces: { d4: 'm', e4: 'b', f4: 'b', g4: 'b', h4: 'm' },
    });
    const caps = findCustodianCaptures(state.pieces, landing('d4', variant), 'white', variant);
    // Three opponents (e4, f4, g4) all captured.
    expect(caps).toHaveLength(3);
  });

  it('whole-line stops at the first non-opponent (empty interrupts)', () => {
    const variant: CustodianConfig = {
      ...MAK,
      capture: { ...MAK.capture, lineCapture: 'whole-line' },
    };
    const state = buildState({
      config: variant,
      // e4 b, f4 EMPTY → line interrupted, no capture.
      pieces: { d4: 'm', e4: 'b', g4: 'm' },
    });
    const caps = findCustodianCaptures(state.pieces, landing('d4', variant), 'white', variant);
    expect(caps).toHaveLength(0);
  });
});

describe('findInterventionCaptures', () => {
  it('captures both opponents in BFB pattern along a rank', () => {
    const state = buildState({
      config: MAK,
      pieces: { d4: 'b', e4: 'm', f4: 'b' },
    });
    const caps = findInterventionCaptures(state.pieces, landing('e4', MAK), 'white', MAK);
    expect(caps).toHaveLength(2);
  });

  it('does NOT capture if one neighbor is friendly', () => {
    const state = buildState({
      config: MAK,
      pieces: { d4: 'b', e4: 'm', f4: 'm' },
    });
    const caps = findInterventionCaptures(state.pieces, landing('e4', MAK), 'white', MAK);
    expect(caps).toHaveLength(0);
  });

  it('captures on both axes when both BFB patterns exist', () => {
    // Vertical (e3 b, e5 b) AND horizontal (d4 b, f4 b).
    const state = buildState({
      config: MAK,
      pieces: { e4: 'm', e3: 'b', e5: 'b', d4: 'b', f4: 'b' },
    });
    const caps = findInterventionCaptures(state.pieces, landing('e4', MAK), 'white', MAK);
    expect(caps).toHaveLength(4);
  });
});

describe('findCornerCaptures', () => {
  it('captures opponent at corner with both orthogonal neighbors friendly', () => {
    const state = buildState({
      config: HSG,
      pieces: { a1: 'b', a2: 'm', b1: 'm' },
    });
    const caps = findCornerCaptures(state.pieces, 'white', HSG);
    expect(caps).toHaveLength(1);
  });

  it('does NOT capture when only one neighbor is friendly', () => {
    const state = buildState({
      config: HSG,
      pieces: { a1: 'b', a2: 'm' },
    });
    const caps = findCornerCaptures(state.pieces, 'white', HSG);
    expect(caps).toHaveLength(0);
  });

  it('does NOT capture when corner holds a friendly', () => {
    const state = buildState({
      config: HSG,
      pieces: { a1: 'm', a2: 'm', b1: 'm' },
    });
    const caps = findCornerCaptures(state.pieces, 'white', HSG);
    expect(caps).toHaveLength(0);
  });

  it('checks all four corners', () => {
    const state = buildState({
      config: HSG,
      pieces: {
        a1: 'b',
        a2: 'm',
        b1: 'm',
        i1: 'b',
        i2: 'm',
        h1: 'm',
        a9: 'b',
        a8: 'm',
        b9: 'm',
        i9: 'b',
        i8: 'm',
        h9: 'm',
      },
    });
    const caps = findCornerCaptures(state.pieces, 'white', HSG);
    expect(caps).toHaveLength(4);
  });
});

describe('findImmobilizationCaptures — group scope (Rek default)', () => {
  it('captures a single piece with no exits (group of 1)', () => {
    // Black at h1 surrounded: g1 friendly-of-active = white = m, h2 = m.
    // Active side white; opponent black — h1 has no exits.
    const state = buildState({
      config: REK,
      pieces: { h1: 'b', g1: 'm', h2: 'm', a1: 'K', h8: 'k' },
    });
    const caps = findImmobilizationCaptures(state.pieces, 'white', REK);
    expect(caps.map((n) => n as unknown as number)).toContain(
      landing('h1', REK) as unknown as number,
    );
  });

  it('captures a 2-piece group with no exits', () => {
    // Black at h1+h2 (vertical pair). Surround:
    // h1 ortho: g1, h2 (in-group). g1 must block.
    // h2 ortho: g2, h1 (in-group), h3. g2 + h3 must block.
    // Place white at g1, g2, h3.
    const state = buildState({
      config: REK,
      pieces: { h1: 'b', h2: 'b', g1: 'm', g2: 'm', h3: 'm', a1: 'K', a8: 'k' },
    });
    const caps = findImmobilizationCaptures(state.pieces, 'white', REK);
    const captureNodes = caps.map((n) => n as unknown as number);
    expect(captureNodes).toContain(landing('h1', REK) as unknown as number);
    expect(captureNodes).toContain(landing('h2', REK) as unknown as number);
  });

  it('does NOT capture if any piece in the group has an exit', () => {
    // Black at h1+h2. Block h1 fully but leave h2 with an exit (h3 empty).
    const state = buildState({
      config: REK,
      pieces: { h1: 'b', h2: 'b', g1: 'm', g2: 'm', a1: 'K', a8: 'k' },
    });
    const caps = findImmobilizationCaptures(state.pieces, 'white', REK);
    // h2 has h3 empty → group {h1, h2} has at least one exit → no capture.
    expect(caps).toHaveLength(0);
  });
});

describe('findImmobilizationCaptures — piece scope (variant)', () => {
  it('captures a single piece with no exits even when its group has exits', () => {
    const variant: CustodianConfig = {
      ...REK,
      capture: { ...REK.capture, immobilizationScope: 'piece' },
    };
    const state = buildState({
      config: variant,
      pieces: { h1: 'b', h2: 'b', g1: 'm', g2: 'm', a1: 'K', a8: 'k' },
    });
    const caps = findImmobilizationCaptures(state.pieces, 'white', variant);
    // h1 alone has no exits (h2 is friendly = blocks per piece-scope; g1 = m blocks).
    // h2 has h3 empty = exit. So only h1 captured.
    const captureNodes = caps.map((n) => n as unknown as number);
    expect(captureNodes).toContain(landing('h1', variant) as unknown as number);
  });
});

describe('findLineCaptures', () => {
  it('returns empty for default single-piece config', () => {
    const state = buildState({
      config: MAK,
      pieces: { d4: 'm', e4: 'b', f4: 'b', g4: 'm' },
    });
    expect(findLineCaptures(state.pieces, landing('d4', MAK), 'white', MAK)).toHaveLength(0);
  });

  it('delegates to whole-line custodian when knob enabled', () => {
    const variant: CustodianConfig = {
      ...MAK,
      capture: { ...MAK.capture, lineCapture: 'whole-line' },
    };
    const state = buildState({
      config: variant,
      pieces: { d4: 'm', e4: 'b', f4: 'b', g4: 'm' },
    });
    const caps = findLineCaptures(state.pieces, landing('d4', variant), 'white', variant);
    expect(caps).toHaveLength(2);
  });
});
