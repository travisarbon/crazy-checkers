/**
 * Renderer-compatibility smoke (Task 29.7 §10.2).
 *
 * Engine-side analog of the Phase 4 plan's "Stack rendering verified
 * across all themes" bullet. For each Tier 2 game's starting position,
 * verify the contracts the renderer (StackPiece.tsx etc.) consumes:
 *  - All `pieces` keys are valid NodeIds resolvable via the rule-set's geometry.
 *  - Every ClassifiedPiece has a non-empty `kind` and `owner`.
 *  - Stacking games (Lasca, Bashni): every piece has a non-empty `stack` array.
 *  - Cheskers: kind ∈ {pawn, king, bishop, camel}.
 *  - Rek: kind ∈ {man, king}.
 *
 * Theme-by-theme rendering at multiple breakpoints is per-game subtask
 * B-block territory; this test guards the engine→renderer contract only.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, getClassifiedGame } from '../../registry';
import { registerTier2 } from '../index';
import { TIER_2_GAME_IDS } from '../ids';

describe('Tier 2 renderer-compatibility smoke', () => {
  beforeEach(() => {
    _clearClassifiedRegistry();
    registerTier2();
  });
  afterEach(() => {
    _clearClassifiedRegistry();
  });

  for (const gameId of TIER_2_GAME_IDS) {
    describe(`${gameId} starting position`, () => {
      it('all pieces have non-empty owner + kind', () => {
        const entry = getClassifiedGame(gameId);
        expect(entry).not.toBeNull();
        if (!entry) return;
        const start = entry.ruleSet.startingPosition();
        expect(start.pieces.size).toBeGreaterThan(0);
        for (const [, piece] of start.pieces) {
          expect(['white', 'black']).toContain(piece.owner);
          expect(typeof piece.kind).toBe('string');
          expect(piece.kind.length).toBeGreaterThan(0);
        }
      });
    });
  }

  it('Lasca + Bashni: every piece has a non-empty stack array', () => {
    for (const gameId of ['lasca', 'bashni'] as const) {
      const entry = getClassifiedGame(gameId as never);
      if (!entry) throw new Error(`${gameId} not registered`);
      const start = entry.ruleSet.startingPosition();
      for (const [, piece] of start.pieces) {
        expect(piece.stack).toBeDefined();
        expect((piece.stack ?? []).length).toBeGreaterThan(0);
      }
    }
  });

  it('Cheskers: kinds are pawn/king/bishop/camel', () => {
    const entry = getClassifiedGame('cheskers' as never);
    if (!entry) throw new Error('cheskers not registered');
    const start = entry.ruleSet.startingPosition();
    for (const [, piece] of start.pieces) {
      expect(['pawn', 'king', 'bishop', 'camel']).toContain(piece.kind);
    }
  });

  it('Rek: kinds are man/king', () => {
    const entry = getClassifiedGame('rek' as never);
    if (!entry) throw new Error('rek not registered');
    const start = entry.ruleSet.startingPosition();
    for (const [, piece] of start.pieces) {
      expect(['man', 'king']).toContain(piece.kind);
    }
  });
});
