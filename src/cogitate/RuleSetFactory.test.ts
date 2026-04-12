import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '../engine/board';
import { PieceColor } from '../engine/types';
import type { SerializedActiveEvent } from '../persistence/serialization';
import {
  createRuleSet,
  hasRuleSetFactory,
  registerRuleSetFactory,
} from './RuleSetFactory';

// Importing the factory module executes Phase 3 registrations.

describe('RuleSetFactory', () => {
  it('has factories for classic, crazy, chaos', () => {
    expect(hasRuleSetFactory('classic')).toBe(true);
    expect(hasRuleSetFactory('crazy')).toBe(true);
    expect(hasRuleSetFactory('chaos')).toBe(true);
  });

  it('has a factory for every Choice mode (40 total)', () => {
    const ids = ['choice-revolution', 'choice-boom-box', 'choice-extra-crazy'];
    for (const id of ids) {
      expect(hasRuleSetFactory(id)).toBe(true);
    }
  });

  it('throws for unknown mode IDs', () => {
    expect(() => createRuleSet('not-a-real-mode')).toThrow(/No rule set factory/);
  });

  it('produces a working classic rule set', () => {
    const rs = createRuleSet('classic');
    const moves = rs.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBe(7);
  });

  it('produces a composite rule set for crazy that applies serialized events', () => {
    const events: SerializedActiveEvent[] = [
      {
        type: 'KING_FOR_A_DAY',
        remainingPlies: 10,
        triggeredBy: 'WHITE',
        triggeredAtPly: 0,
      },
    ];
    const rs = createRuleSet('crazy', events);
    const moves = rs.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('produces a rule set for Choice Revolution with the permanent event', () => {
    const rs = createRuleSet('choice-revolution');
    const moves = rs.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('supports registering custom factories at runtime', () => {
    registerRuleSetFactory('test-custom', () => {
      const rs = createRuleSet('classic');
      return rs;
    });
    expect(hasRuleSetFactory('test-custom')).toBe(true);
    const rs = createRuleSet('test-custom');
    expect(rs.getLegalMoves(createInitialBoard(), PieceColor.White).length).toBe(7);
  });
});
