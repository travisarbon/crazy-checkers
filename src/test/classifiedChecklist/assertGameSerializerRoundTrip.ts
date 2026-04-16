/**
 * Task 27.7 — mechanical verifier for Classified §13 Review Checklist row C-05
 * (save/resume round-trip byte-identical).
 *
 * Thin wrapper over the Task 27.6 round-trip harness; resolves the serializer
 * by gameId and delegates to `assertByteIdenticalRoundTrip`. Exists so
 * reviewer-facing checklist rows read naturally: "serializer for <gameId>
 * round-trips byte-identically on <sampleState>".
 */

import type { ClassifiedGameId } from '../../engine/classified/ClassifiedRuleSet';
import { getSerializer, hasSerializer } from '../../persistence/serializers';
import { assertByteIdenticalRoundTrip } from '../../persistence/serializers/__tests__/roundTrip';
import { ChecklistAssertionError } from './ChecklistAssertionError';

export function assertGameSerializerRoundTrip(
  gameId: ClassifiedGameId,
  sampleState: unknown,
): void {
  if (!hasSerializer(gameId)) {
    throw new ChecklistAssertionError({
      gameId,
      failures: [`C-05/E: no serializer registered for gameId "${gameId}"`],
    });
  }
  const serializer = getSerializer(gameId) as unknown as Parameters<
    typeof assertByteIdenticalRoundTrip<unknown>
  >[0];
  assertByteIdenticalRoundTrip(serializer, sampleState);
}
