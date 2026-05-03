/**
 * Tier 2 notation edge cases (Phase 4 Task 29.8 §7.5).
 *
 * Hand-authored scenarios that exercise per-game notation grammars.
 */

import { describe, expect, it } from 'vitest';
import { createCheskersRuleSet } from '../../../../engine/classified/cheskers/CheskersRules';
import { createHarzdameRuleSet } from '../../../../engine/classified/harzdame/HarzdameRules';
import { createMakYekRuleSet } from '../../../../engine/classified/custodian/makYek';
import { createDameoRuleSet } from '../../../../engine/classified/linear/LinearMovementEngine';
import { createZammaRuleSet } from '../../../../engine/classified/alquerque/ZammaRules';
import { createCheskersNotationAdapter } from '../cheskers';
import { createHarzdameNotationAdapter } from '../harzdame';
import { createMakYekNotationAdapter } from '../makYek';
import { createDameoNotationAdapter } from '../dameo';
import { createZammaNotationAdapter } from '../zamma';

describe('Cheskers notation — piece-type prefix', () => {
  const rs = createCheskersRuleSet();
  const adapter = createCheskersNotationAdapter(rs.boardGeometry);
  const start = rs.startingPosition();

  it('emits Pawn prefix on a pawn step', () => {
    const text = adapter.notate(start, {
      kind: 'pawn-step',
      from: 'a3',
      to: 'b4',
      piece: 'pawn',
      capture: [],
    });
    expect(text.startsWith('P')).toBe(true);
  });

  it('emits King prefix on a king step', () => {
    const text = adapter.notate(start, {
      kind: 'king-step',
      from: 'c1',
      to: 'd2',
      piece: 'king',
      capture: [],
    });
    expect(text.startsWith('K')).toBe(true);
  });

  it('emits Bishop prefix on a bishop slide', () => {
    const text = adapter.notate(start, {
      kind: 'bishop-slide',
      from: 'a1',
      to: 'c3',
      piece: 'bishop',
      capture: [],
    });
    expect(text.startsWith('B')).toBe(true);
  });

  it('emits Camel prefix on a camel leap', () => {
    const text = adapter.notate(start, {
      kind: 'camel-leap',
      from: 'g1',
      to: 'h4',
      piece: 'camel',
      capture: [],
    });
    expect(text.startsWith('C')).toBe(true);
  });

  it('round-trips a pawn promotion =K', () => {
    const move = {
      kind: 'pawn-step',
      from: 'a7',
      to: 'b8',
      piece: 'pawn' as const,
      capture: [],
      promotion: 'king' as const,
    };
    const text = adapter.notate(start, move);
    expect(text).toContain('=K');
    const parsed = adapter.parse(start, text);
    expect(parsed?.promotion).toBe('king');
  });
});

describe('Harzdame notation — senior-king K+ token', () => {
  const rs = createHarzdameRuleSet();
  const adapter = createHarzdameNotationAdapter(rs.boardGeometry);
  const start = rs.startingPosition();

  it('emits =K+ for senior promotion', () => {
    const text = adapter.notate(start, {
      kind: 'capture',
      from: '18',
      to: '11',
      piece: 'king',
      capture: ['14'],
      promotion: 'senior',
    });
    expect(text.endsWith('=K+')).toBe(true);
  });

  it('emits =K for regular promotion', () => {
    const text = adapter.notate(start, {
      kind: 'move',
      from: '17',
      to: '14',
      piece: 'man',
      capture: [],
      promotion: 'king',
    });
    expect(text.endsWith('=K')).toBe(true);
    expect(text.endsWith('=K+')).toBe(false);
  });

  it('round-trips =K+ through notate/parse', () => {
    const move = {
      kind: 'capture',
      from: '18',
      to: '11',
      piece: 'king' as const,
      capture: ['14'],
      promotion: 'senior' as const,
    };
    const text = adapter.notate(start, move);
    const parsed = adapter.parse(start, text);
    expect(parsed?.promotion).toBe('senior');
  });
});

describe('Mak-yek notation — captures-list', () => {
  const rs = createMakYekRuleSet();
  const adapter = createMakYekNotationAdapter(rs.boardGeometry);
  const start = rs.startingPosition();

  it('emits (captures: ...) annotation when captures present', () => {
    const text = adapter.notate(start, {
      kind: 'capture',
      from: 'a1',
      to: 'a4',
      capture: ['a3', 'a5'],
    });
    expect(text).toContain('(captures: a3, a5)');
  });

  it('omits annotation when no captures', () => {
    const text = adapter.notate(start, {
      kind: 'move',
      from: 'a1',
      to: 'a4',
      capture: [],
    });
    expect(text).toBe('a1-a4');
  });

  it('round-trips (captures: ...) annotation', () => {
    const text = adapter.notate(start, {
      kind: 'capture',
      from: 'a1',
      to: 'a4',
      capture: ['a3', 'a5'],
    });
    const parsed = adapter.parse(start, text);
    expect(parsed?.capture).toEqual(['a3', 'a5']);
  });
});

describe('Dameo notation — phalanx group-advance', () => {
  const rs = createDameoRuleSet();
  const adapter = createDameoNotationAdapter(rs.boardGeometry);
  const start = rs.startingPosition();

  it('emits (members)→head for group-advance', () => {
    const move = {
      kind: 'group-advance',
      from: 'a1',
      to: 'd4',
      capture: [],
      groupMembers: ['a1', 'b2', 'c3'],
    } as never;
    const text = adapter.notate(start, move);
    expect(text).toBe('(a1,b2,c3)→d4');
  });

  it('round-trips group-advance', () => {
    const move = {
      kind: 'group-advance',
      from: 'a1',
      to: 'd4',
      capture: [],
      groupMembers: ['a1', 'b2', 'c3'],
    } as never;
    const text = adapter.notate(start, move);
    const parsed = adapter.parse(start, text);
    expect(parsed?.kind).toBe('group-advance');
    expect(parsed?.to).toBe('d4');
  });
});

describe('Zamma notation — Mullah promotion', () => {
  const rs = createZammaRuleSet();
  const adapter = createZammaNotationAdapter(rs.boardGeometry);
  const start = rs.startingPosition();

  it('emits =M for Mullah promotion', () => {
    const move = {
      kind: 'move',
      from: '1',
      to: '2',
      capture: [],
      promotion: 'king' as const,
    };
    const text = adapter.notate(start, move);
    expect(text.endsWith('=M')).toBe(true);
  });

  it('round-trips Mullah promotion', () => {
    const move = {
      kind: 'move',
      from: '1',
      to: '2',
      capture: [],
      promotion: 'king' as const,
    };
    const text = adapter.notate(start, move);
    const parsed = adapter.parse(start, text);
    expect(parsed?.promotion).toBe('king');
  });
});
