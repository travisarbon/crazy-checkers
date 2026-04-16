/**
 * Capture-priority filter (Task 28.2 §6.1).
 *
 * `filterByCapturePriority` iterates `config.capturePriorityRules` in order;
 * each rule is a cumulative narrowing filter over the candidate move set.
 * Every rule is a pure predicate over `(move, state, config)` — no gameId
 * comparisons appear here.
 *
 * Ordering semantics: rules later in the list only break ties among the
 * survivors of earlier rules. `'kings-weight-1-5'` is the one exception —
 * its presence modifies the *weight function* used by any preceding
 * `'most-pieces'` rule (Frisian / Frysk!). When present alone, it behaves
 * as a total-weight tiebreaker, retaining moves with the maximum weighted
 * piece count.
 */

import type { ClassifiedGameState, ClassifiedPiece } from '../state';
import type { DraughtsConfig, CapturePriorityRule } from './DraughtsConfig';
import type { DraughtsMove } from './moveGen';
import { captureWeight } from './moveGen';

export function filterByCapturePriority(
  candidates: readonly DraughtsMove[],
  state: ClassifiedGameState,
  config: DraughtsConfig,
): readonly DraughtsMove[] {
  if (candidates.length <= 1) return candidates;
  const rules = config.capturePriorityRules;
  if (rules.length === 0) return candidates;

  let survivors = candidates;
  for (const rule of rules) {
    survivors = applyRule(rule, survivors, state, config);
    if (survivors.length <= 1) return survivors;
  }
  return survivors;
}

function applyRule(
  rule: CapturePriorityRule,
  candidates: readonly DraughtsMove[],
  state: ClassifiedGameState,
  config: DraughtsConfig,
): readonly DraughtsMove[] {
  switch (rule) {
    case 'most-pieces':
      return retainMaxBy(candidates, (m) =>
        captureWeight(m, state, config, config.capturePriorityRules.includes('kings-weight-1-5')),
      );
    case 'most-kings-captured':
      return retainMaxBy(candidates, (m) => countCapturedKings(m, state, config));
    case 'capturing-with-king':
      return preferKingStart(candidates);
    case 'first-king-earliest':
      return retainMinBy(candidates, (m) => firstKingCaptureIndex(m, state, config));
    case 'kings-weight-1-5':
      return retainMaxBy(candidates, (m) => captureWeight(m, state, config, true));
  }
}

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

function retainMaxBy<T>(
  xs: readonly T[],
  score: (x: T) => number,
): readonly T[] {
  let max = -Infinity;
  for (const x of xs) {
    const s = score(x);
    if (s > max) max = s;
  }
  return xs.filter((x) => score(x) === max);
}

function retainMinBy<T>(
  xs: readonly T[],
  score: (x: T) => number,
): readonly T[] {
  let min = Infinity;
  for (const x of xs) {
    const s = score(x);
    if (s < min) min = s;
  }
  return xs.filter((x) => score(x) === min);
}

function preferKingStart(
  candidates: readonly DraughtsMove[],
): readonly DraughtsMove[] {
  const kingStarts = candidates.filter((m) => m.piece === 'king');
  return kingStarts.length > 0 ? kingStarts : candidates;
}

function findCapturedPiece(
  state: ClassifiedGameState,
  config: DraughtsConfig,
  label: string,
): ClassifiedPiece | undefined {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) return undefined;
  return state.pieces.get(node);
}

function countCapturedKings(
  move: DraughtsMove,
  state: ClassifiedGameState,
  config: DraughtsConfig,
): number {
  let n = 0;
  for (const label of move.capture) {
    const piece = findCapturedPiece(state, config, label);
    if (piece?.kind === 'king') n += 1;
  }
  return n;
}

function firstKingCaptureIndex(
  move: DraughtsMove,
  state: ClassifiedGameState,
  config: DraughtsConfig,
): number {
  for (let i = 0; i < move.capture.length; i += 1) {
    const label = move.capture[i];
    if (!label) continue;
    const piece = findCapturedPiece(state, config, label);
    if (piece?.kind === 'king') return i;
  }
  return Number.POSITIVE_INFINITY;
}
