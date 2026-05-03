import { describe, expect, it } from 'vitest';
import { asNodeId } from '../boardGeometry';
import { buildAlquerqueCoordinates } from './AlquerqueCoordinates';

describe('AlquerqueCoordinates — Zamma 9×9', () => {
  const labels = buildAlquerqueCoordinates({ size: 9 });

  it('notationOf produces 1..81 for NodeId 0..80', () => {
    for (let i = 0; i < 81; i += 1) {
      expect(labels.notationOf(asNodeId(i))).toBe(String(i + 1));
    }
  });

  it('displayOf produces algebraic a9..i1 (top-left = a9; bottom-right = i1)', () => {
    expect(labels.displayOf(asNodeId(0))).toBe('a9');
    expect(labels.displayOf(asNodeId(8))).toBe('i9');
    expect(labels.displayOf(asNodeId(40))).toBe('e5');
    expect(labels.displayOf(asNodeId(72))).toBe('a1');
    expect(labels.displayOf(asNodeId(80))).toBe('i1');
  });

  it('parseNotation — numeric round-trip for every node', () => {
    for (let i = 0; i < 81; i += 1) {
      const token = labels.notationOf(asNodeId(i));
      expect(labels.parseNotation(token)).toBe(asNodeId(i));
    }
  });

  it('parseNotation — algebraic round-trip for every node', () => {
    for (let i = 0; i < 81; i += 1) {
      const token = labels.displayOf(asNodeId(i));
      expect(labels.parseNotation(token)).toBe(asNodeId(i));
    }
  });

  it('parseNotation rejects unknown formats', () => {
    expect(labels.parseNotation('foo')).toBeNull();
    expect(labels.parseNotation('')).toBeNull();
    expect(labels.parseNotation('z9')).toBeNull(); // 'z' is past the file range for size 9
    expect(labels.parseNotation('a99')).toBeNull();
    expect(labels.parseNotation('82')).toBeNull(); // out of numeric range
    expect(labels.parseNotation('0')).toBeNull(); // 1-based numbering
  });

  it('parseNotation accepts uppercase and whitespace', () => {
    expect(labels.parseNotation(' E5 ')).toBe(asNodeId(40));
    expect(labels.parseNotation(' 41 ')).toBe(asNodeId(40));
  });

  it('ariaOf includes "center intersection" for the center', () => {
    expect(labels.ariaOf(asNodeId(40))).toBe('alquerque center intersection e5');
  });

  it('ariaOf includes "corner intersection" for the four corners', () => {
    expect(labels.ariaOf(asNodeId(0))).toBe('alquerque corner intersection a9');
    expect(labels.ariaOf(asNodeId(8))).toBe('alquerque corner intersection i9');
    expect(labels.ariaOf(asNodeId(72))).toBe('alquerque corner intersection a1');
    expect(labels.ariaOf(asNodeId(80))).toBe('alquerque corner intersection i1');
  });

  it('ariaOf says "intersection <alg>" for non-corner / non-center nodes', () => {
    expect(labels.ariaOf(asNodeId(1))).toBe('alquerque intersection b9');
    expect(labels.ariaOf(asNodeId(13))).toBe('alquerque intersection e8');
  });
});

describe('AlquerqueCoordinates — Bagh-Chal 5×5', () => {
  const labels = buildAlquerqueCoordinates({ size: 5 });

  it('notationOf produces 1..25', () => {
    for (let i = 0; i < 25; i += 1) {
      expect(labels.notationOf(asNodeId(i))).toBe(String(i + 1));
    }
  });

  it('center on a 5×5 is c3 (NodeId 12)', () => {
    expect(labels.displayOf(asNodeId(12))).toBe('c3');
    expect(labels.ariaOf(asNodeId(12))).toBe('alquerque center intersection c3');
  });

  it('parseNotation rejects out-of-range files (e.g., f1 on a 5-wide board)', () => {
    expect(labels.parseNotation('f1')).toBeNull();
  });
});

describe('AlquerqueCoordinates — even-size variant has no "center" intersection', () => {
  const labels = buildAlquerqueCoordinates({ size: 4 });

  it('ariaOf does not call any node "center" on an even-size board', () => {
    for (let i = 0; i < 16; i += 1) {
      expect(labels.ariaOf(asNodeId(i))).not.toContain('center');
    }
  });
});
