/**
 * dameoAriaLabel tests (Phase 4 Task 29.G.1-B §8.3).
 */

import { describe, expect, it } from 'vitest';
import { dameoAriaLabel } from '../dameoAriaLabels';
import type { LinearMove } from '../../../engine/classified/linear/types';

describe('dameoAriaLabel', () => {
  it('emits "phalanx of N advances forward" for a group-advance move', () => {
    const move = {
      kind: 'group-advance',
      from: 'a1',
      to: 'a3',
      capture: [],
      groupMembers: ['a1', 'a2'],
    } as unknown as LinearMove;
    expect(dameoAriaLabel(move)).toBe('phalanx of 2 advances forward');
  });

  it('emits "phalanx of 4 advances forward-right" for an NE-direction phalanx', () => {
    const move = {
      kind: 'group-advance',
      from: 'a1',
      to: 'e5',
      capture: [],
      groupMembers: ['a1', 'b2', 'c3', 'd4'],
      direction: 'NE',
    } as unknown as LinearMove;
    expect(dameoAriaLabel(move)).toBe('phalanx of 4 advances forward-right');
  });

  it('emits "phalanx of 3 advances forward-left" for an NW-direction phalanx', () => {
    const move = {
      kind: 'group-advance',
      from: 'd1',
      to: 'a4',
      capture: [],
      groupMembers: ['d1', 'c2', 'b3'],
      direction: 'NW',
    } as unknown as LinearMove;
    expect(dameoAriaLabel(move)).toBe('phalanx of 3 advances forward-left');
  });

  it('emits standard step format for kind=step', () => {
    const move = {
      kind: 'step',
      from: 'c3',
      to: 'c4',
      piece: 'man',
      capture: [],
    } as unknown as LinearMove;
    expect(dameoAriaLabel(move)).toBe('man moves from c3 to c4');
  });

  it('emits capture format with count + opponent piece kind', () => {
    const move = {
      kind: 'capture',
      from: 'c3',
      to: 'e5',
      piece: 'man',
      capture: ['d4'],
    } as unknown as LinearMove;
    expect(dameoAriaLabel(move)).toBe('man captures 1 opponent piece from c3 to e5');
  });

  it('pluralizes "opponent pieces" for multi-jump captures', () => {
    const move = {
      kind: 'capture',
      from: 'c3',
      to: 'g7',
      piece: 'man',
      capture: ['d4', 'e5', 'f6'],
    } as unknown as LinearMove;
    expect(dameoAriaLabel(move)).toBe('man captures 3 opponent pieces from c3 to g7');
  });

  it('appends ", promotes to king" on capture+promotion', () => {
    const move = {
      kind: 'capture',
      from: 'c3',
      to: 'g7',
      piece: 'man',
      capture: ['d4', 'e5', 'f6'],
      promotion: 'king',
    } as unknown as LinearMove;
    expect(dameoAriaLabel(move)).toBe(
      'man captures 3 opponent pieces from c3 to g7, promotes to king',
    );
  });

  it('appends ", promotes to king" on step+promotion', () => {
    const move = {
      kind: 'step',
      from: 'c7',
      to: 'c8',
      piece: 'man',
      capture: [],
      promotion: 'king',
    } as unknown as LinearMove;
    expect(dameoAriaLabel(move)).toBe('man moves from c7 to c8, promotes to king');
  });
});
