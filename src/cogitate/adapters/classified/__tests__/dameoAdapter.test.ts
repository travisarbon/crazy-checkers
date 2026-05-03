/**
 * dameoAdapter tests (Phase 4 Task 29.G.1-C §9.6).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, getClassifiedGame } from '../../../../engine/classified/registry';
import { _clearTierLoaderCache, loadClassifiedTier } from '../../../../engine/classified/tierLoader';
import { DAMEO_ID } from '../../../../engine/classified/tier2/ids';
import { createDameoAdapter, validateDameoPosition } from '../dameoAdapter';
import { asNodeId } from '../../../../engine/boardGeometry';
import type { ClassifiedPiece } from '../../../../engine/classified/state';
import type { BoardState } from '../../../../engine/types';

describe('createDameoAdapter — factory + Cogitate contract', () => {
  beforeEach(async () => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
    await loadClassifiedTier(2);
  });
  afterEach(() => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
  });

  it('produces a CogitateGameAdapter for the Dameo registry entry', () => {
    const entry = getClassifiedGame(DAMEO_ID);
    expect(entry).not.toBeNull();
    if (!entry) return;
    const adapter = createDameoAdapter(entry);
    expect(adapter.modeId).toBe('classified-dameo');
  });

  it('returns a synthesized board geometry (8×8 full)', () => {
    const entry = getClassifiedGame(DAMEO_ID);
    if (!entry) throw new Error('not registered');
    const adapter = createDameoAdapter(entry);
    const geom = adapter.getBoardGeometry();
    expect(geom.rows).toBe(8);
    expect(geom.cols).toBe(8);
    expect(geom.darkSquaresOnly).toBe(false);
  });

  it('returns the rule-set\'s starting position via getBoard / getStartingPosition', () => {
    const entry = getClassifiedGame(DAMEO_ID);
    if (!entry) throw new Error('not registered');
    const adapter = createDameoAdapter(entry);
    expect(adapter.getBoard('starting')).toBeDefined();
    expect(adapter.getStartingPosition()).toBeDefined();
  });

  it('returns a notation adapter (from Task 29.8)', () => {
    const entry = getClassifiedGame(DAMEO_ID);
    if (!entry) throw new Error('not registered');
    const adapter = createDameoAdapter(entry);
    expect(adapter.getNotationAdapter()).toBeDefined();
  });

  it('returns a stub evaluation provider (per per-game subtask C-block follow-up)', () => {
    const entry = getClassifiedGame(DAMEO_ID);
    if (!entry) throw new Error('not registered');
    const adapter = createDameoAdapter(entry);
    expect(adapter.supportsEvaluation()).toBe(false);
    const provider = adapter.getEvaluationProvider();
    expect(provider.isAvailable).toBe(false);
    expect(provider.providerType).toBe('classified-dameo-stub');
  });

  it('serializeBoard round-trips the starting position', () => {
    const entry = getClassifiedGame(DAMEO_ID);
    if (!entry) throw new Error('not registered');
    const adapter = createDameoAdapter(entry);
    const start = adapter.getStartingPosition();
    const text = adapter.serializeBoard(start);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('getRuleSet throws (Classified games do not satisfy Phase 1 RuleSet)', () => {
    const entry = getClassifiedGame(DAMEO_ID);
    if (!entry) throw new Error('not registered');
    const adapter = createDameoAdapter(entry);
    expect(() => adapter.getRuleSet()).toThrow();
  });

  it('getAIConfig returns easy / hard depths from dameoDifficultyPresets', () => {
    const entry = getClassifiedGame(DAMEO_ID);
    if (!entry) throw new Error('not registered');
    const adapter = createDameoAdapter(entry);
    const easy = adapter.getAIConfig('easy');
    const hard = adapter.getAIConfig('hard');
    expect(easy.maxDepth).toBe(3);
    expect(hard.maxDepth).toBe(7);
    expect(hard.maxDepth).toBeGreaterThan(easy.maxDepth);
  });

  it('exposes onBoard piece vocabulary (man + king)', () => {
    const entry = getClassifiedGame(DAMEO_ID);
    if (!entry) throw new Error('not registered');
    const adapter = createDameoAdapter(entry);
    const palette = adapter.getOnBoardPalette?.();
    expect(palette).toBeDefined();
    expect(palette?.length).toBeGreaterThan(0);
  });
});

describe('validateDameoPosition', () => {
  function buildBoard(
    pieces: ReadonlyArray<readonly [number, ClassifiedPiece]>,
    turn: 'white' | 'black' = 'white',
  ): BoardState {
    const map = new Map();
    for (const [idx, p] of pieces) map.set(asNodeId(idx), p);
    return { pieces: map, turn } as unknown as BoardState;
  }

  it('accepts the starting trapezoid (≤18 per side)', async () => {
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
    await loadClassifiedTier(2);
    const entry = getClassifiedGame(DAMEO_ID);
    if (!entry) throw new Error('not registered');
    const start = entry.ruleSet.startingPosition() as unknown as BoardState;
    const r = validateDameoPosition(start);
    expect(r.isLegal).toBe(true);
    expect(r.errors).toHaveLength(0);
    _clearClassifiedRegistry();
    _clearTierLoaderCache();
  });

  it('rejects a board that is not a ClassifiedGameState', () => {
    const r = validateDameoPosition('not a state' as unknown as BoardState);
    expect(r.isLegal).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects 19 white pieces (over the 18-per-side cap)', () => {
    const pieces: Array<readonly [number, ClassifiedPiece]> = [];
    for (let i = 0; i < 19; i += 1) pieces.push([i, { owner: 'white', kind: 'man' }]);
    const r = validateDameoPosition(buildBoard(pieces));
    expect(r.isLegal).toBe(false);
    expect(r.errors.some((e) => e.includes('Too many White'))).toBe(true);
  });

  it('rejects an off-board NodeId', () => {
    const r = validateDameoPosition(buildBoard([[100, { owner: 'white', kind: 'man' }]]));
    expect(r.isLegal).toBe(false);
    expect(r.errors.some((e) => e.includes('off-board'))).toBe(true);
  });

  it('rejects an invalid piece kind', () => {
    const r = validateDameoPosition(
      buildBoard([[10, { owner: 'white', kind: 'queen' as 'man' }]]),
    );
    expect(r.isLegal).toBe(false);
    expect(r.errors.some((e) => e.includes('invalid kind'))).toBe(true);
  });

  it('rejects an invalid owner', () => {
    const r = validateDameoPosition(
      buildBoard([[10, { owner: 'gray' as 'white', kind: 'man' }]]),
    );
    expect(r.isLegal).toBe(false);
    expect(r.errors.some((e) => e.includes('invalid owner'))).toBe(true);
  });

  it('rejects an invalid turn', () => {
    const r = validateDameoPosition(
      buildBoard([[10, { owner: 'white', kind: 'man' }]], 'gray' as 'white'),
    );
    expect(r.isLegal).toBe(false);
    expect(r.errors.some((e) => e.includes('Invalid turn'))).toBe(true);
  });

  it('rejects an empty board', () => {
    const r = validateDameoPosition(buildBoard([]));
    expect(r.isLegal).toBe(false);
    expect(r.errors.some((e) => e.includes('No pieces'))).toBe(true);
  });
});
