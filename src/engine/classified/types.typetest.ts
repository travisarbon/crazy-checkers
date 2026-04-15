/**
 * types.typetest.ts — compile-only type-level assertions for Task 27.4.
 *
 * Runs through `tsc --noEmit`. Uses `@ts-expect-error` to demand that
 * specific invalid shapes fail to compile. Vitest runs this file as a
 * no-op suite so the build graph is explicit.
 */

import { describe, it, expect } from 'vitest';
import type {
  ClassifiedRuleSet,
  ConsistentRuleSet,
  CapabilityFlags,
} from './ClassifiedRuleSet';
import type { ClassifiedGameState } from './state';
import { testCheckersCloneRuleSet } from './tier0/testCheckersClone';
import { testShogiCloneRuleSet } from './tier0/testShogiClone';

// ---------------------------------------------------------------------------
// Type assertion helpers
// ---------------------------------------------------------------------------

type AssertAssignable<A, B extends A> = B;

// ---------------------------------------------------------------------------
// A: ClassifiedRuleSet assignability
// ---------------------------------------------------------------------------

type _A1 = AssertAssignable<ClassifiedRuleSet, typeof testCheckersCloneRuleSet>;
type _A2 = AssertAssignable<ClassifiedRuleSet, typeof testShogiCloneRuleSet>;
void (0 as unknown as _A1);
void (0 as unknown as _A2);

// ---------------------------------------------------------------------------
// B: CapabilityFlags is a subset of ClassifiedRuleSet
// ---------------------------------------------------------------------------

type _B1 = AssertAssignable<CapabilityFlags, typeof testCheckersCloneRuleSet>;
void (0 as unknown as _B1);

// ---------------------------------------------------------------------------
// C: ConsistentRuleSet demands matching hook presence per flag
// ---------------------------------------------------------------------------

type HandfulRuleSet = ClassifiedRuleSet & { readonly hasPiecesInHand: true };
type _C1 = ConsistentRuleSet<HandfulRuleSet>['getLegalDrops']; // must resolve
void (0 as unknown as _C1);

// ---------------------------------------------------------------------------
// D: ClassifiedGameState minimal shape
// ---------------------------------------------------------------------------

const _d: ClassifiedGameState = { pieces: new Map() };
void _d;

// ---------------------------------------------------------------------------
// Negative assertions (compile-time)
// ---------------------------------------------------------------------------

// A ClassifiedRuleSet with undefined gameId is rejected (branded string).
const _missing: ClassifiedRuleSet = {
  ...testCheckersCloneRuleSet,
  // @ts-expect-error — gameId is a branded string, not undefined
  gameId: undefined,
};
void _missing;

// A ConsistentRuleSet<HandfulRuleSet> narrows `getLegalDrops` to be
// required — assigning `undefined` (as never) is rejected.
type _NeedsDrops = ConsistentRuleSet<HandfulRuleSet>;
const _needs: _NeedsDrops = {
  ...testShogiCloneRuleSet,
  hasPiecesInHand: true,
  // @ts-expect-error — getLegalDrops must be a function, not undefined
  getLegalDrops: undefined,
};
void _needs;

// ---------------------------------------------------------------------------
// Vitest placeholder so the file is included in the test graph
// ---------------------------------------------------------------------------

describe('types.typetest.ts', () => {
  it('compile-only assertions', () => {
    expect(true).toBe(true);
  });
});
