import { describe, it, expect, beforeAll } from 'vitest';
import { createClassifiedNotationBridge } from './classifiedBridge';
import { loadClassifiedTier } from '../../engine/classified/tierLoader';
import { _clearClassifiedRegistry } from '../../engine/classified/registry';
import { _clearTierLoaderCache } from '../../engine/classified/tierLoader';
import { createDraughtsConfig, TIER_1_DRAUGHTS_GAME_IDS } from '../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsGameId } from '../../engine/classified/draughts/DraughtsConfig';
import { createDraughtsRuleSet } from '../../engine/classified/draughts/ParameterizedDraughtsRules';
import { configToNotation } from '../../engine/classified/draughts/configToNotation';
import type { ClassifiedGameState } from '../../engine/classified/state';
import type { BoardState } from '../../engine/types';
import type { ClassifiedMove, NotationAdapter as Phase4Adapter } from '../../engine/classified/ClassifiedRuleSet';

describe('classifiedBridge', () => {
  beforeAll(async () => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
    await loadClassifiedTier(1);
  });

  it.each([...TIER_1_DRAUGHTS_GAME_IDS])(
    '%s: moveToString returns non-empty PDN for first legal move',
    (gameId: DraughtsGameId) => {
      const config = createDraughtsConfig(gameId);
      const ruleSet = createDraughtsRuleSet(config);
      const phase4 = configToNotation(config) as Phase4Adapter<ClassifiedGameState, ClassifiedMove>;
      const bridge = createClassifiedNotationBridge(phase4);

      const state = ruleSet.startingPosition();
      const moves = ruleSet.getLegalMoves(state);
      expect(moves.length).toBeGreaterThan(0);

      // Convert first DraughtsMove to a Phase 1-style Move for the bridge.
      const firstMove = moves[0];
      if (!firstMove) return;
      const from = Number(firstMove.from);
      const to = Number(firstMove.to);
      const phase1Move = {
        from: from as unknown as import('../../engine/types').Square,
        path: [to as unknown as import('../../engine/types').Square],
        captured: [] as unknown as import('../../engine/types').Square[],
      };

      const notation = bridge.moveToString(
        phase1Move,
        state as unknown as BoardState,
      );
      expect(notation.length).toBeGreaterThan(0);
    },
  );

  it('stringToMove round-trips for Russian Draughts opening moves', () => {
    const config = createDraughtsConfig('russian-draughts');
    const ruleSet = createDraughtsRuleSet(config);
    const phase4 = configToNotation(config) as Phase4Adapter<ClassifiedGameState, ClassifiedMove>;
    const bridge = createClassifiedNotationBridge(phase4);

    const state = ruleSet.startingPosition();
    const moves = ruleSet.getLegalMoves(state);
    const firstMove = moves[0];
    if (!firstMove) return;

    const from = Number(firstMove.from);
    const to = Number(firstMove.to);
    const phase1Move = {
      from: from as unknown as import('../../engine/types').Square,
      path: [to as unknown as import('../../engine/types').Square],
      captured: [] as unknown as import('../../engine/types').Square[],
    };

    const notation = bridge.moveToString(
      phase1Move,
      state as unknown as BoardState,
    );
    const parsed = bridge.stringToMove(notation, state as unknown as BoardState);

    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(Number(parsed.from)).toBe(from);
      expect(Number(parsed.path[parsed.path.length - 1])).toBe(to);
    }
  });

  it('throws for non-ClassifiedGameState board', () => {
    const config = createDraughtsConfig('russian-draughts');
    const phase4 = configToNotation(config) as Phase4Adapter<ClassifiedGameState, ClassifiedMove>;
    const bridge = createClassifiedNotationBridge(phase4);

    const fakeBoardState = new Array(32).fill(null) as unknown as BoardState;
    const fakeMove = {
      from: 1 as unknown as import('../../engine/types').Square,
      path: [5 as unknown as import('../../engine/types').Square],
      captured: [] as unknown as import('../../engine/types').Square[],
    };

    expect(() => bridge.moveToString(fakeMove, fakeBoardState)).toThrow(
      'non-ClassifiedGameState',
    );
  });

  it('formatMoveNumber follows PDN convention', () => {
    const config = createDraughtsConfig('russian-draughts');
    const phase4 = configToNotation(config) as Phase4Adapter<ClassifiedGameState, ClassifiedMove>;
    const bridge = createClassifiedNotationBridge(phase4);

    // White's first move: ply 0
    expect(bridge.formatMoveNumber(0, '9-14')).toBe('1. 9-14');
    // Black's first move: ply 1
    expect(bridge.formatMoveNumber(1, '22-17')).toBe('1... 22-17');
    // White's second move: ply 2
    expect(bridge.formatMoveNumber(2, '11-15')).toBe('2. 11-15');
  });

  it('stringToMove returns null for invalid notation', () => {
    const config = createDraughtsConfig('russian-draughts');
    const ruleSet = createDraughtsRuleSet(config);
    const phase4 = configToNotation(config) as Phase4Adapter<ClassifiedGameState, ClassifiedMove>;
    const bridge = createClassifiedNotationBridge(phase4);

    const state = ruleSet.startingPosition();
    const parsed = bridge.stringToMove('invalid', state as unknown as BoardState);
    expect(parsed).toBeNull();
  });
});
