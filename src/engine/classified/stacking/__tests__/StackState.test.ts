import { describe, expect, it } from 'vitest';
import {
  attachPrisoner,
  fromClassifiedPiece,
  kindOfTopOf,
  liftCommander,
  makeStack,
  ownerOfTopOf,
  replaceCommanderKind,
  singletonStack,
  stackHeight,
  stacksEqual,
  toClassifiedPiece,
  topPieceOf,
} from '../StackState';
import type { StackingPiece } from '../types';

describe('StackState — construction and accessors', () => {
  it('singletonStack creates a height-1 tower with the given commander', () => {
    const s = singletonStack('white', 'man');
    expect(stackHeight(s)).toBe(1);
    expect(topPieceOf(s)).toEqual({ owner: 'white', kind: 'man' });
    expect(ownerOfTopOf(s)).toBe('white');
    expect(kindOfTopOf(s)).toBe('man');
  });

  it('makeStack rejects empty input', () => {
    expect(() => makeStack([])).toThrow(/at least one piece/);
  });

  it('makeStack returns a frozen array', () => {
    const s = makeStack([
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
    ]);
    expect(Object.isFrozen(s.pieces)).toBe(true);
  });

  it('topPieceOf returns commander for a height-2 tower', () => {
    const s = makeStack([
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
    ]);
    expect(topPieceOf(s)).toEqual({ owner: 'black', kind: 'king' });
  });
});

describe('StackState — transforms', () => {
  it('liftCommander returns top + remainder for height ≥ 2', () => {
    const s = makeStack([
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
      { owner: 'white', kind: 'king' },
    ]);
    const { lifted, remainder } = liftCommander(s);
    expect(lifted).toEqual({ owner: 'white', kind: 'king' });
    expect(remainder).not.toBeNull();
    if (!remainder) throw new Error('unreachable');
    expect(remainder.pieces).toEqual([
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
    ]);
  });

  it('liftCommander returns null remainder for height 1', () => {
    const s = singletonStack('white', 'man');
    const { lifted, remainder } = liftCommander(s);
    expect(lifted).toEqual({ owner: 'white', kind: 'man' });
    expect(remainder).toBeNull();
  });

  it('attachPrisoner places the new piece at the bottom (index 0)', () => {
    const s = singletonStack('white', 'king');
    const next = attachPrisoner(s, { owner: 'black', kind: 'man' });
    expect(next.pieces).toEqual([
      { owner: 'black', kind: 'man' },
      { owner: 'white', kind: 'king' },
    ]);
    // Original tower untouched.
    expect(s.pieces).toEqual([{ owner: 'white', kind: 'king' }]);
  });

  it('replaceCommanderKind promotes the top layer', () => {
    const s = singletonStack('white', 'man');
    const next = replaceCommanderKind(s, 'king');
    expect(topPieceOf(next).kind).toBe('king');
    expect(topPieceOf(next).owner).toBe('white');
  });

  it('replaceCommanderKind throws on no-op promotion', () => {
    const s = singletonStack('white', 'king');
    expect(() => replaceCommanderKind(s, 'king')).toThrow(/already has kind/);
  });

  it('replaceCommanderKind preserves prisoners', () => {
    const s = makeStack([
      { owner: 'black', kind: 'man' },
      { owner: 'white', kind: 'man' },
    ]);
    const next = replaceCommanderKind(s, 'king');
    expect(next.pieces).toEqual([
      { owner: 'black', kind: 'man' },
      { owner: 'white', kind: 'king' },
    ]);
  });
});

describe('StackState — ClassifiedPiece bridge', () => {
  it('toClassifiedPiece mirrors commander into {owner,kind} and serializes stack', () => {
    const s = makeStack([
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
    ]);
    const cp = toClassifiedPiece(s);
    expect(cp.owner).toBe('black');
    expect(cp.kind).toBe('king');
    expect(cp.stack).toEqual([
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
    ]);
  });

  it('fromClassifiedPiece round-trips via toClassifiedPiece', () => {
    const s = makeStack([
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
    ]);
    const cp = toClassifiedPiece(s);
    const back = fromClassifiedPiece(cp);
    expect(stacksEqual(s, back)).toBe(true);
  });

  it('fromClassifiedPiece treats bare pieces (no stack field) as singletons', () => {
    const back = fromClassifiedPiece({ owner: 'white', kind: 'man' });
    expect(back.pieces).toEqual([{ owner: 'white', kind: 'man' }]);
  });

  it('fromClassifiedPiece rejects bare piece with invalid owner', () => {
    expect(() => fromClassifiedPiece({ owner: 'red', kind: 'man' })).toThrow(/invalid owner/);
  });

  it('fromClassifiedPiece rejects bare piece with invalid kind', () => {
    expect(() => fromClassifiedPiece({ owner: 'white', kind: 'queen' })).toThrow(/invalid kind/);
  });

  it('fromClassifiedPiece rejects layered piece with invalid owner', () => {
    expect(() =>
      fromClassifiedPiece({
        owner: 'white',
        kind: 'man',
        stack: [{ owner: 'red', kind: 'man' }],
      }),
    ).toThrow(/invalid owner/);
  });

  it('fromClassifiedPiece rejects layered piece with invalid kind', () => {
    expect(() =>
      fromClassifiedPiece({
        owner: 'white',
        kind: 'man',
        stack: [{ owner: 'white', kind: 'queen' }],
      }),
    ).toThrow(/invalid kind/);
  });
});

describe('StackState — equality', () => {
  it('reference equality short-circuits to true', () => {
    const s = singletonStack('white');
    expect(stacksEqual(s, s)).toBe(true);
  });

  it('detects height differences', () => {
    const a = singletonStack('white');
    const b = makeStack([
      { owner: 'white', kind: 'man' },
      { owner: 'white', kind: 'man' },
    ]);
    expect(stacksEqual(a, b)).toBe(false);
  });

  it('detects layer-by-layer differences', () => {
    const a: StackingPiece[] = [
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
    ];
    const b: StackingPiece[] = [
      { owner: 'white', kind: 'man' },
      { owner: 'white', kind: 'king' },
    ];
    expect(stacksEqual(makeStack(a), makeStack(b))).toBe(false);
  });

  it('treats structurally identical towers as equal', () => {
    const a = makeStack([
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
    ]);
    const b = makeStack([
      { owner: 'white', kind: 'man' },
      { owner: 'black', kind: 'king' },
    ]);
    expect(stacksEqual(a, b)).toBe(true);
  });
});
