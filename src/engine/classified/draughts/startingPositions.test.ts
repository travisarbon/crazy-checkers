/**
 * startingPositions — reference-image parity, symmetry, determinism, and
 * persistence round-trip (Task 28.1 §7.2, §7.4).
 */

import { describe, expect, it } from 'vitest';
import {
  TIER_1_DRAUGHTS_GAME_IDS,
  boardSizeOf,
  createDraughtsConfig,
  usesDarkSquaresOnly,
  type DraughtsConfig,
  type DraughtsGameId,
} from './DraughtsConfig';
import {
  generateStartingPosition,
  StartingPositionMismatchError,
} from './startingPositions';
import { STARTING_POSITION_SNAPSHOTS } from './startingPositions.snapshots';
import { createDefaultSerializer } from '../../../persistence/serializers/default';
import type { ClassifiedGameId } from '../ClassifiedRuleSet';
import { asClassifiedGameId } from '../ClassifiedRuleSet';

describe('generateStartingPosition — piece count parity (T-28.1-10)', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)(
    '%s emits 2 × piecesPerSide pieces with a 50/50 split',
    (id) => {
      const config = createDraughtsConfig(id);
      const state = generateStartingPosition(config);
      expect(state.pieces.size).toBe(2 * config.piecesPerSide);
      let white = 0;
      let black = 0;
      for (const piece of state.pieces.values()) {
        if (piece.owner === 'white') white += 1;
        else if (piece.owner === 'black') black += 1;
      }
      expect(white).toBe(config.piecesPerSide);
      expect(black).toBe(config.piecesPerSide);
    },
  );
});

describe('generateStartingPosition — snapshot parity (T-28.1-11)', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)('%s matches authoritative snapshot', (id) => {
    const config = createDraughtsConfig(id);
    const state = generateStartingPosition(config);
    const snapshot = STARTING_POSITION_SNAPSHOTS[id];
    const entries = [...state.pieces.entries()]
      .map(
        ([nodeId, piece]) => ({ nodeId: nodeId as unknown as number, owner: piece.owner }),
      )
      .sort((a, b) => a.nodeId - b.nodeId);
    expect(entries).toEqual(snapshot.map((e) => ({ nodeId: e.nodeId, owner: e.owner })));
  });
});

describe('generateStartingPosition — 180° symmetry (T-28.1-12)', () => {
  // Dark-squares-only boards do not preserve dark-squareness under a
  // row-only flip (parity changes), so the correct side-swap is a 180°
  // rotation: (r, c) → (size-1-r, size-1-c). This preserves the (r+c) parity
  // and also works uniformly for full-board variants.
  it.each(TIER_1_DRAUGHTS_GAME_IDS)('%s: 180° rotation of white → black', (id) => {
    const config = createDraughtsConfig(id);
    const state = generateStartingPosition(config);
    const size = boardSizeOf(config);
    for (const [nodeId, piece] of state.pieces) {
      if (piece.owner !== 'white') continue;
      const n = nodeId as unknown as number;
      const r = Math.floor(n / size);
      const c = n % size;
      const mirroredId = (size - 1 - r) * size + (size - 1 - c);
      const mirrorPiece = state.pieces.get(mirroredId as never);
      expect(
        mirrorPiece?.owner,
        `white piece at (${String(r)},${String(c)}) expected black mirror at (${String(
          size - 1 - r,
        )},${String(size - 1 - c)})`,
      ).toBe('black');
    }
  });
});

describe('generateStartingPosition — determinism (T-28.1-13)', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)('%s: 100 invocations produce equal states', (id) => {
    const config = createDraughtsConfig(id);
    const first = JSON.stringify([...generateStartingPosition(config).pieces.entries()]);
    for (let i = 0; i < 100; i += 1) {
      const state = generateStartingPosition(config);
      const serialized = JSON.stringify([...state.pieces.entries()]);
      expect(serialized).toBe(first);
    }
  });
});

describe('generateStartingPosition — turn/ply/history invariants (T-28.1-14)', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)('%s returns turn=white, plyCount=0, empty history', (id) => {
    const state = generateStartingPosition(createDraughtsConfig(id));
    expect(state.turn).toBe('white');
    expect(state.plyCount).toBe(0);
    expect(state.moveHistory?.length).toBe(0);
  });
});

describe('generateStartingPosition — honours dark-squares invariant', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)('%s: dark-only games never place on light squares', (id) => {
    const config = createDraughtsConfig(id);
    if (!usesDarkSquaresOnly(config)) return;
    const size = boardSizeOf(config);
    for (const [nodeId] of generateStartingPosition(config).pieces) {
      const n = nodeId as unknown as number;
      const r = Math.floor(n / size);
      const c = n % size;
      expect((r + c) % 2, `piece at node ${String(n)} on light square`).toBe(1);
    }
  });
});

describe('generateStartingPosition — mismatch error', () => {
  it('throws StartingPositionMismatchError when a corrupted layout/count is provided', () => {
    const base = createDraughtsConfig('russian-draughts');
    const broken: DraughtsConfig = { ...base, piecesPerSide: 1 };
    expect(() => generateStartingPosition(broken)).toThrow(StartingPositionMismatchError);
  });
});

describe('generateStartingPosition — persistence round-trip (T-28.1-30)', () => {
  it.each(TIER_1_DRAUGHTS_GAME_IDS)('%s: round-trips through default serializer', (id) => {
    const config = createDraughtsConfig(id);
    const gameId: ClassifiedGameId = asClassifiedGameId(id);
    const serializer = createDefaultSerializer({
      gameId,
      vocabularyPieceIds: ['man', 'king'],
    });
    const state = generateStartingPosition(config);
    const json = serializer.toJSON(state);
    const restored = serializer.fromJSON(json);
    expect(restored.pieces.size).toBe(state.pieces.size);
    const restoredEntries = [...restored.pieces.entries()].map(
      ([k, v]) => [k as unknown as number, v.owner, v.kind] as const,
    );
    const originalEntries = [...state.pieces.entries()].map(
      ([k, v]) => [k as unknown as number, v.owner, v.kind] as const,
    );
    restoredEntries.sort((a, b) => a[0] - b[0]);
    originalEntries.sort((a, b) => a[0] - b[0]);
    expect(restoredEntries).toEqual(originalEntries);
    expect(restored.turn).toBe(state.turn);
    expect(restored.plyCount).toBe(state.plyCount);
  });
});

describe('Piece count sanity checks per layout', () => {
  const table: Array<[DraughtsGameId, number]> = [
    ['russian-draughts', 24],
    ['brazilian-draughts', 24],
    ['italian-draughts', 24],
    ['international-checkers', 40],
    ['frysk', 10],
    ['frisian-draughts', 40],
    ['malaysian-checkers', 60],
    ['canadian-draughts', 60],
    ['armenian-draughts', 32],
    ['turkish-draughts', 32],
  ];
  it.each(table)('%s: %d total pieces', (id, total) => {
    expect(generateStartingPosition(createDraughtsConfig(id)).pieces.size).toBe(total);
  });
});
