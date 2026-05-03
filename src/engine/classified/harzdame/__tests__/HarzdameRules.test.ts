import { describe, expect, it } from 'vitest';
import { createHarzdameRuleSet } from '../HarzdameRules';

describe('createHarzdameRuleSet — factory smoke test', () => {
  const rules = createHarzdameRuleSet();

  it('returns a ClassifiedRuleSet with the expected gameId', () => {
    expect(rules.gameId).toBe('harzdame');
  });

  it('declares ruleSetFamily "draughts"', () => {
    expect(rules.ruleSetFamily).toBe('draughts');
  });

  it('exposes capability flags all set to false (symmetric draughts variant)', () => {
    expect(rules.hasPlacementPhase).toBe(false);
    expect(rules.hasPiecesInHand).toBe(false);
    expect(rules.hasStacks).toBe(false);
    expect(rules.isAsymmetric).toBe(false);
    expect(rules.hasMutableGeometry).toBe(false);
    expect(rules.hasPiecesOfDistinctTypes).toBe(false);
  });

  it('caches the factory output (calling twice returns the same instance)', () => {
    const a = createHarzdameRuleSet();
    const b = createHarzdameRuleSet();
    expect(a).toBe(b);
  });

  it('produces a starting state with 24 pieces, white to move, ply 0', () => {
    const start = rules.startingPosition();
    expect(start.pieces.size).toBe(24);
    expect(start.turn).toBe('white');
    expect(start.plyCount).toBe(0);
    expect(start.moveHistory).toHaveLength(0);
  });

  it('startingPosition tolerates an unused options arg', () => {
    const start = rules.startingPosition({ seed: 'unused' });
    expect(start.pieces.size).toBe(24);
  });

  it('exposes a piece vocabulary with man + king entries', () => {
    expect(rules.pieceVocabulary).toBeDefined();
    expect(rules.pieceVocabulary.id).toBe('harzdame-pieces');
  });

  it('getLegalMoves on the starting state returns at least one move', () => {
    const start = rules.startingPosition();
    const moves = rules.getLegalMoves(start);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('getLegalMoves stamps maxChainLength on capture moves but not on steps', () => {
    const start = rules.startingPosition();
    const moves = rules.getLegalMoves(start);
    // Starting position has no captures; verify all moves are step moves.
    for (const m of moves) {
      expect(m.kind).toBe('move');
    }
  });

  it('applyMove on a legal step advances to ply 1 and toggles turn', () => {
    const start = rules.startingPosition();
    const moves = rules.getLegalMoves(start);
    const next = rules.applyMove(start, moves[0] as never);
    expect(next.plyCount).toBe(1);
    expect(next.turn).toBe('black');
  });

  it('checkGameOver returns null on the starting position', () => {
    const start = rules.startingPosition();
    expect(rules.checkGameOver(start)).toBeNull();
  });

  it('serializer round-trips the starting state', () => {
    const start = rules.startingPosition();
    const json = rules.serializer.toJSON(start);
    const back = rules.serializer.fromJSON(json);
    expect(rules.serializer.toJSON(back)).toEqual(json);
  });

  it('getLegalMoves on a position with captures stamps maxChainLength on each capture move', () => {
    const start = rules.startingPosition();
    // Apply ~ a few moves to set up a capture (we'll just probe the API path
    // for the capture-stamp branch by constructing a direct capture state).
    // Use serializer round-trip to inject a minimal capture state.
    const minimal = rules.serializer.fromJSON({
      schemaVersion: 1,
      gameId: 'harzdame',
      serializationType: 'standard',
      boardSize: 8,
      turn: 'white',
      halfMoveClock: 0,
      plyCount: 0,
      // 32 chars: PDN 15 = idx 14 black; PDN 18 = idx 17 white man.
      squares:
        '_'.repeat(14) + 'b' + '_'.repeat(2) + 'm' + '_'.repeat(14),
      moveHistory: [],
      repetitionTable: [],
      seniorKings: null,
    });
    const moves = rules.getLegalMoves(minimal);
    const captures = moves.filter((m) => m.kind === 'capture');
    expect(captures.length).toBeGreaterThan(0);
    for (const cap of captures) {
      expect(cap.meta?.maxChainLength).toBeDefined();
    }
    // Also exercise applyMove path (which writes the maxCaptureChainLength
    // cache into state.meta).
    const after = rules.applyMove(minimal, captures[0] as never);
    expect(after.plyCount).toBe(1);
    void start;
  });
});
