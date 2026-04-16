/**
 * Tier 1 rollback coverage (Task 28.3 §7.8).
 *
 * Confirms that injecting a downstream failure into a Tier-1-shaped spec
 * triggers the atomic rollback path in `registerClassifiedGame` so a
 * subsequent clean Tier 1 registration succeeds. Reproduces the Task 27.4
 * `downstream-registration-failed` behavior on Tier 1 ground truth.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearClassifiedRegistry,
  getClassifiedGame,
  registerClassifiedGame,
} from '../../registry';
import { _clearTierLoaderCache } from '../../tierLoader';
import { ClassifiedRegistrationError } from '../../registrationSpec';
import {
  asClassifiedGameId,
  type ClassifiedRuleSet,
  type GameStateSerializer,
} from '../../ClassifiedRuleSet';
import { asAudioPackId } from '../../pieceVocabulary';
import { russianDraughtsRuleSet, registerRussianDraughts } from '../russian';

beforeEach(() => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
});

describe('Tier 1 atomic rollback', () => {
  it('rolls back when the serializer registration fails', () => {
    const brokenSerializer = {
      version: 1,
      gameId: asClassifiedGameId('wrong-game-id'), // Serializer identity guard fires here.
      toJSON: () => ({}),
      fromJSON: () => russianDraughtsRuleSet.startingPosition(),
    } as unknown as GameStateSerializer;

    const brokenRuleSet: ClassifiedRuleSet = {
      ...russianDraughtsRuleSet,
      serializer: brokenSerializer,
    };

    const gameId = asClassifiedGameId('russian-draughts');

    expect(() =>
      registerClassifiedGame({
        gameId,
        classifiedNumber: 1,
        wave: 1,
        tier: 1,
        family: 'Draughts',
        displayName: 'Russian Draughts',
        ruleSet: brokenRuleSet,
        boardGeometry: brokenRuleSet.boardGeometry,
        pieceVocabularyId: brokenRuleSet.pieceVocabulary.id,
        audioPackId: asAudioPackId('default-draughts'),
        codeUnlockKey: 'CLASSIFIED01',
        narrativeFlavor: {
          wave: 'Wave 1',
          family: 'Draughts',
          connection: 'irrelevant — registration is expected to fail',
        },
      }),
    ).toThrow(ClassifiedRegistrationError);

    expect(getClassifiedGame(gameId)).toBeNull();

    // After rollback the slot is free — a clean registration succeeds.
    expect(() => registerRussianDraughts()).not.toThrow();
    expect(getClassifiedGame(gameId)).not.toBeNull();
  });
});
