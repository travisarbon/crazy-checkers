/**
 * Tier 1 default-adapter / rule-set smoke test (Task 28.3 §7.7).
 *
 * For each of the ten Tier 1 games:
 *  - the default Cogitate adapter is registered;
 *  - the rule set yields a non-empty legal-move list from the starting
 *    position;
 *  - a deterministic random self-play (seeded by an LCG) terminates within
 *    the move limit, exercising getLegalMoves / applyMove / checkGameOver
 *    end-to-end.
 *
 * The intent matches Task 28.3 plan §7.7: surface any rule-set inconsistency
 * (infinite loop, illegal move, crash) that the per-game registration would
 * otherwise hide. The plan references a `playSelfGame` helper that is not
 * authored — we inline a minimal seeded picker here instead, which is
 * explicitly within the spirit of "Task 28.3 does not add new helpers".
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearClassifiedRegistry,
  type ClassifiedRegistryEntry,
} from '../../registry';
import { _clearTierLoaderCache, loadClassifiedTier } from '../../tierLoader';
import { getAdapter } from '../../../../cogitate/CogitateGameAdapter';
import { GameResultType } from '../../../types';
import { TIER_1_GAME_IDS } from '../ids';
import { russianDraughtsRuleSet } from '../russian';
import { brazilianDraughtsRuleSet } from '../brazilian';
import { italianDraughtsRuleSet } from '../italian';
import { internationalCheckersRuleSet } from '../international';
import { fryskRuleSet } from '../frysk';
import { frisianDraughtsRuleSet } from '../frisian';
import { malaysianCheckersRuleSet } from '../malaysian';
import { canadianDraughtsRuleSet } from '../canadian';
import { armenianDraughtsRuleSet } from '../armenian';
import { turkishDraughtsRuleSet } from '../turkish';

const TIER_1_RULESETS_BY_GAME_ID: Readonly<
  Record<string, typeof russianDraughtsRuleSet>
> = {
  'russian-draughts': russianDraughtsRuleSet,
  'brazilian-draughts': brazilianDraughtsRuleSet,
  'italian-draughts': italianDraughtsRuleSet,
  'international-checkers': internationalCheckersRuleSet,
  frysk: fryskRuleSet,
  'frisian-draughts': frisianDraughtsRuleSet,
  'malaysian-checkers': malaysianCheckersRuleSet,
  'canadian-draughts': canadianDraughtsRuleSet,
  'armenian-draughts': armenianDraughtsRuleSet,
  'turkish-draughts': turkishDraughtsRuleSet,
};

function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

interface SmokeOutcome {
  readonly kind: 'win' | 'loss' | 'draw' | 'move-limit';
  readonly plies: number;
}

function playSeededRandomGame(
  ruleSet: typeof russianDraughtsRuleSet,
  options: { seed: number; moveLimit: number },
): SmokeOutcome {
  const rng = makeLcg(options.seed);
  let state = ruleSet.startingPosition();
  for (let ply = 0; ply < options.moveLimit; ply += 1) {
    const result = ruleSet.checkGameOver(state);
    if (result !== null) {
      const kind: SmokeOutcome['kind'] =
        result.type === GameResultType.Draw
          ? 'draw'
          : result.type === GameResultType.WhiteWin
            ? 'win'
            : 'loss';
      return { kind, plies: ply };
    }
    const moves = ruleSet.getLegalMoves(state);
    if (moves.length === 0) {
      return { kind: 'loss', plies: ply };
    }
    const move = moves[Math.floor(rng() * moves.length)];
    if (!move) return { kind: 'loss', plies: ply };
    state = ruleSet.applyMove(state, move);
  }
  return { kind: 'move-limit', plies: options.moveLimit };
}

beforeEach(async () => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
  await loadClassifiedTier(1);
});

describe('Tier 1 default-adapter smoke', () => {
  it.each(TIER_1_GAME_IDS.map(String))(
    '%s: default adapter registered and rule set produces legal moves',
    (gameId) => {
      const ruleSet = TIER_1_RULESETS_BY_GAME_ID[gameId];
      if (!ruleSet) throw new Error(`missing rule set for ${gameId}`);
      const adapter = getAdapter(`classified-${gameId}`);
      expect(adapter).not.toBeNull();
      const moves = ruleSet.getLegalMoves(ruleSet.startingPosition());
      expect(moves.length).toBeGreaterThan(0);
    },
  );

  it.each(TIER_1_GAME_IDS.map(String))(
    '%s: seeded random self-play terminates within move limit',
    (gameId) => {
      const ruleSet = TIER_1_RULESETS_BY_GAME_ID[gameId];
      if (!ruleSet) throw new Error(`missing rule set for ${gameId}`);
      const outcome = playSeededRandomGame(ruleSet, {
        seed: 0xc0ffee,
        moveLimit: 600,
      });
      // Random play should hit a terminal state via no-piece, no-moves,
      // repetition, or 40-move-no-capture well before the move limit.
      expect(outcome.kind).not.toBe('move-limit');
    },
  );
});

void (null as unknown as ClassifiedRegistryEntry);
