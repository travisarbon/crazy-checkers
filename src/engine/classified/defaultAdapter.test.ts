import { beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, registerClassifiedGame } from './registry';
import { createDefaultClassifiedAdapter } from './defaultAdapter';
import { asClassifiedGameId } from './ClassifiedRuleSet';
import type { ClassifiedRegistrationSpec } from './registrationSpec';
import { asAudioPackId } from './pieceVocabulary';
import { testCheckersCloneRuleSet } from './tier0/testCheckersClone';
import { testShogiCloneRuleSet } from './tier0/testShogiClone';

// Silence unused-import for the re-exported type alias.
void ({} as ClassifiedRegistrationSpec);

beforeEach(() => {
  _clearClassifiedRegistry();
});

describe('createDefaultClassifiedAdapter — T7-08 palette split', () => {
  it('getOnBoardPalette reflects the vocabulary onBoard list', () => {
    const entry = registerClassifiedGame({
      gameId: asClassifiedGameId('russian-draughts'),
      classifiedNumber: 1,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Russian Draughts',
      ruleSet: { ...testCheckersCloneRuleSet, gameId: asClassifiedGameId('russian-draughts') },
      boardGeometry: testCheckersCloneRuleSet.boardGeometry,
      pieceVocabularyId: testCheckersCloneRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED01',
      narrativeFlavor: { wave: 'Wave 1', family: 'Draughts', connection: '' },
    });
    const adapter = createDefaultClassifiedAdapter(entry);
    expect(adapter.getOnBoardPalette?.()).toHaveLength(4);
    expect(adapter.getHandPalette?.()).toHaveLength(0);
  });

  it('getHandPalette returns the in-hand pieces for a hand-bearing game', () => {
    const entry = registerClassifiedGame(
      {
        gameId: testShogiCloneRuleSet.gameId,
        classifiedNumber: -1,
        wave: 1,
        tier: 1,
        family: 'Test',
        displayName: 'Test Shogi',
        ruleSet: testShogiCloneRuleSet,
        boardGeometry: testShogiCloneRuleSet.boardGeometry,
        pieceVocabularyId: testShogiCloneRuleSet.pieceVocabulary.id,
        audioPackId: asAudioPackId('default-draughts'),
        codeUnlockKey: 'TESTTIERSHOGI',
        narrativeFlavor: { wave: 'Test', family: 'Test', connection: '' },
      },
      { allowTierZero: true },
    );
    const adapter = createDefaultClassifiedAdapter(entry);
    expect(adapter.getHandPalette?.()).toHaveLength(2);
    expect(adapter.getHandPalette?.().map((p) => p.pieceId)).toEqual([
      'rook-in-hand',
      'pawn-in-hand',
    ]);
  });
});

describe('createDefaultClassifiedAdapter — Phase 3 contract', () => {
  function mkAdapter() {
    const entry = registerClassifiedGame({
      gameId: asClassifiedGameId('russian-draughts'),
      classifiedNumber: 1,
      wave: 1,
      tier: 1,
      family: 'Draughts',
      displayName: 'Russian Draughts',
      ruleSet: { ...testCheckersCloneRuleSet, gameId: asClassifiedGameId('russian-draughts') },
      boardGeometry: testCheckersCloneRuleSet.boardGeometry,
      pieceVocabularyId: testCheckersCloneRuleSet.pieceVocabulary.id,
      audioPackId: asAudioPackId('default-draughts'),
      codeUnlockKey: 'CLASSIFIED01',
      narrativeFlavor: { wave: 'Wave 1', family: 'Draughts', connection: '' },
    });
    return createDefaultClassifiedAdapter(entry);
  }

  it('modeId matches classified-<gameId>', () => {
    expect(mkAdapter().modeId).toBe('classified-russian-draughts');
  });

  it('getAIConfig returns a search config', () => {
    const cfg = mkAdapter().getAIConfig('easy');
    expect(typeof cfg.maxDepth).toBe('number');
  });

  it('getBoardGeometry synthesises a Phase 3 geometry descriptor', () => {
    const g = mkAdapter().getBoardGeometry();
    expect(g.rows).toBe(8);
    expect(g.cols).toBe(8);
    expect(g.darkSquaresOnly).toBe(true);
  });

  it('validatePosition returns an OK result', () => {
    expect(mkAdapter().validatePosition([])).toEqual({
      isLegal: true,
      warnings: [],
      errors: [],
    });
  });

  it('supportsEvaluation is false by default', () => {
    expect(mkAdapter().supportsEvaluation()).toBe(false);
  });

  it('getEvaluationRange is [-1, 1]', () => {
    expect(mkAdapter().getEvaluationRange()).toEqual([-1, 1]);
  });

  it('getEvaluationProvider is available but reports unavailable', () => {
    const p = mkAdapter().getEvaluationProvider();
    expect(p.isAvailable).toBe(false);
    expect(p.providerType).toBe('classified-default');
  });

  it('getBoard throws a descriptive error (Task 27.6 / per-tier override)', () => {
    expect(() => mkAdapter().getBoard('anything')).toThrow(/getBoard/);
  });

  it('getStartingPosition throws a descriptive error', () => {
    expect(() => mkAdapter().getStartingPosition()).toThrow(/getStartingPosition/);
  });
});
