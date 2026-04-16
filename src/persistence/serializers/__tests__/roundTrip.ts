/**
 * Task 27.6 — reusable round-trip harness for per-game serializer tests.
 *
 * Every Task 36.2 per-tier serializer test uses `assertByteIdenticalRoundTrip`
 * as its core assertion: `serialize → JSON.stringify → JSON.parse → deserialize
 * → serialize → JSON.stringify` must produce byte-identical output to the
 * first stringify. Any Map/Set iteration-order drift or NaN sneak-through
 * trips the assertion.
 */

import { expect } from 'vitest';
import type { GameStateSerializer } from '../types';

export function assertByteIdenticalRoundTrip<S>(
  serializer: GameStateSerializer<S>,
  state: S,
): void {
  const first = JSON.stringify(serializer.toJSON(state));
  const rehydrated = serializer.fromJSON(JSON.parse(first) as never);
  const second = JSON.stringify(serializer.toJSON(rehydrated));
  expect(second).toBe(first);
}

/**
 * Performs the byte-identical round-trip, then returns the rehydrated value
 * so the caller can deep-equal against the original.
 */
export function roundTrip<S>(
  serializer: GameStateSerializer<S>,
  state: S,
): { readonly first: string; readonly rehydrated: S; readonly second: string } {
  const first = JSON.stringify(serializer.toJSON(state));
  const rehydrated = serializer.fromJSON(JSON.parse(first) as never);
  const second = JSON.stringify(serializer.toJSON(rehydrated));
  return { first, rehydrated, second };
}
