/**
 * configToNotation — Tier 1 routing from `DraughtsConfig` to the correct
 * PDN-family `NotationAdapter` instance (Task 28.1).
 *
 * The switch is exhaustive on `DraughtsGameId`; an `assertNever` default
 * branch guards against a future gameId being added without a routing
 * update. No behaviour lives here — each arm returns the appropriate
 * adapter instance cached on first access.
 */

import type {
  ClassifiedMove,
  NotationAdapter,
} from '../ClassifiedRuleSet';
import type { ClassifiedGameState } from '../state';
import {
  createPdnNotationAdapter,
  createPdnFrisianAdapter,
  createPdnArmenianAdapter,
  createPdnTurkishAdapter,
} from '../../../cogitate/notation';
import type { DraughtsConfig } from './DraughtsConfig';

type DraughtsNotationAdapter = NotationAdapter<ClassifiedGameState, ClassifiedMove>;

/** Cache, keyed by `gameId`, so repeated routes share one adapter. */
const cache = new Map<string, DraughtsNotationAdapter>();

export function configToNotation(config: DraughtsConfig): DraughtsNotationAdapter {
  const cached = cache.get(config.gameId);
  if (cached) return cached;
  const adapter = build(config);
  cache.set(config.gameId, adapter);
  return adapter;
}

function build(config: DraughtsConfig): DraughtsNotationAdapter {
  const { boardGeometry, gameId } = config;
  switch (gameId) {
    case 'russian-draughts':
    case 'brazilian-draughts':
    case 'italian-draughts':
      return createPdnNotationAdapter({ adapterKey: 'pdn-8', boardGeometry });
    case 'international-checkers':
      return createPdnNotationAdapter({ adapterKey: 'pdn-10', boardGeometry });
    case 'frysk':
    case 'frisian-draughts':
      return createPdnFrisianAdapter(boardGeometry);
    case 'malaysian-checkers':
    case 'canadian-draughts':
      return createPdnNotationAdapter({ adapterKey: 'pdn-12', boardGeometry });
    case 'armenian-draughts':
      return createPdnArmenianAdapter(boardGeometry);
    case 'turkish-draughts':
      return createPdnTurkishAdapter(boardGeometry);
    default:
      return assertNever(gameId);
  }
}

function assertNever(value: never): never {
  throw new Error(`configToNotation: unreachable gameId ${String(value)}`);
}
