import { describe, expect, it } from 'vitest';
import { createRekRuleSet } from '../rek';

describe('createRekRuleSet', () => {
  it('declares hasPiecesOfDistinctTypes: true (Rek has Men + 1 King)', () => {
    const rs = createRekRuleSet();
    expect(rs.gameId).toBe('rek');
    expect(rs.hasPiecesOfDistinctTypes).toBe(true);
  });

  it('startingPosition places 32 pieces (15 men + 1 king per side)', () => {
    const rs = createRekRuleSet();
    expect(rs.startingPosition().pieces.size).toBe(32);
  });

  it('pieceVocabulary includes both man and king', () => {
    const rs = createRekRuleSet();
    const ids = rs.pieceVocabulary.onBoard.map((p) => p.pieceId);
    expect(ids).toContain('man');
    expect(ids).toContain('king');
  });

  it('serializer round-trips the starting state with king characters', () => {
    const rs = createRekRuleSet();
    const state = rs.startingPosition();
    const json = rs.serializer.toJSON(state);
    expect(rs.serializer.toJSON(rs.serializer.fromJSON(json))).toEqual(json);
  });
});
