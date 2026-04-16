/**
 * Task 27.6 — legacy adapter for Task 27.4-era serializers.
 *
 * Task 27.4 shipped `GameStateSerializer<S>` with no `gameId` field. Task 27.6
 * extends the interface with an identity-guard `gameId`. This adapter stamps
 * the provided `gameId` onto a legacy serializer without mutating it, so the
 * Tier 0 fixtures and any other Task 27.4-era registrant continue to work.
 */

import type { ClassifiedGameId } from '../../engine/classified/ClassifiedRuleSet';
import type { GameStateSerializer, RegisteredSerializer } from './types';

export function createSerializerFromLegacyShape<S>(
  gameId: ClassifiedGameId,
  legacy: GameStateSerializer<S>,
): RegisteredSerializer<S> {
  return {
    gameId,
    version: legacy.version,
    toJSON: legacy.toJSON,
    fromJSON: legacy.fromJSON,
    ...(legacy.migrate ? { migrate: legacy.migrate } : {}),
  };
}
