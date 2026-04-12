import { describe, it, expect } from 'vitest';
import { CHOICE_MODE_DATA } from '../../persistence/choiceModeData';
import { CrazyEvent, PieceColor } from '../../engine/types';
import { createInitialBoard } from '../../engine/board';
import {
  buildAllChoiceAdapters,
  choiceDisplayNameToId,
  createChoiceAdapter,
} from './choiceAdapter';

describe('ChoiceAdapter', () => {
  it('generates one adapter per CHOICE_MODE_DATA entry (40 total)', () => {
    const adapters = buildAllChoiceAdapters();
    expect(adapters.length).toBe(CHOICE_MODE_DATA.length);
    expect(adapters.length).toBe(40);
  });

  it('produces IDs that mirror the GameModeRegistry kebab convention', () => {
    expect(choiceDisplayNameToId('Revolution')).toBe('choice-revolution');
    expect(choiceDisplayNameToId('Hop, Skip, Jump')).toBe('choice-hop-skip-jump');
    expect(choiceDisplayNameToId('Non-Aggression Pact')).toBe('choice-non-aggression-pact');
  });

  it('returns a rule set that always includes the permanent event', () => {
    const adapter = createChoiceAdapter('choice-revolution', CrazyEvent.KingForADay);
    const ruleSet = adapter.getRuleSet();
    const moves = ruleSet.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('handles null permanent event (Extra Crazy)', () => {
    const adapter = createChoiceAdapter('choice-extra-crazy', null);
    const ruleSet = adapter.getRuleSet();
    const moves = ruleSet.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBe(7);
  });

  it('exposes the MinimaxEvaluationProvider', () => {
    const adapter = createChoiceAdapter('choice-revolution', CrazyEvent.KingForADay);
    expect(adapter.getEvaluationProvider().providerType).toBe('minimax');
  });
});
