/**
 * Round-trip serialization tests and in-process getAIMove tests with events.
 * Task 10.2 — Event-Aware AI Worker
 */

import { describe, it, expect } from 'vitest';
import { deserializeGameState, getAIMove } from './worker';
import type { SerializableGameState } from './worker';
import { CrazyEvent, GameMode, PieceColor, PlayerType } from '../engine/types';
import { createNewGame } from '../engine/game';
import { createAmericanRules } from '../engine/rules';

const rules = createAmericanRules();

/** Minimal SerializableGameState for testing. */
function makeSerializable(
  mode: string,
  activeEvents: SerializableGameState['activeEvents'] = [],
): SerializableGameState {
  const state = createNewGame(rules, { white: PlayerType.CpuHard, black: PlayerType.CpuHard });
  return {
    board: state.board,
    activeColor: state.activeColor,
    status: state.status,
    result: state.result,
    players: state.players,
    moveHistory: [],
    positionHashes: [0n],
    halfMoveClock: 0,
    plyCount: 0,
    ruleSetId: 'american',
    mode,
    activeEvents,
  };
}

function makeSerializableEvent(type: CrazyEvent, triggeredBy: PieceColor): SerializableGameState['activeEvents'][number] {
  return { type, remainingPlies: 2, triggeredBy, triggeredAtPly: 0 };
}

// ---------------------------------------------------------------------------
// Serialization round-trips
// ---------------------------------------------------------------------------

describe('deserializeGameState — round-trip serialization', () => {
  it('Classic mode: reconstructs state with American rules and empty activeEvents', () => {
    const data = makeSerializable(GameMode.Classic);
    const state = deserializeGameState(data);

    expect(state.mode).toBe(GameMode.Classic);
    expect(state.activeEvents).toHaveLength(0);
    expect(state.ruleSet).toBeDefined();
    expect(typeof state.ruleSet.getLegalMoves).toBe('function');
  });

  it('Crazy mode: reconstructs CompositeRuleSet with correct activeEvents', () => {
    const data = makeSerializable(GameMode.Crazy, [
      makeSerializableEvent(CrazyEvent.OppositeDay, PieceColor.White),
    ]);
    const state = deserializeGameState(data);

    expect(state.mode).toBe(GameMode.Crazy);
    expect(state.activeEvents).toHaveLength(1);
    const oppositeEvent = state.activeEvents[0];
    expect(oppositeEvent?.type).toBe(CrazyEvent.OppositeDay);
    expect(oppositeEvent?.triggeredBy).toBe(PieceColor.White);
  });

  it('Crazy mode: activeEvents are passed through with all fields', () => {
    const data = makeSerializable(GameMode.Crazy, [
      { type: CrazyEvent.LiveGrenade, remainingPlies: -1, triggeredBy: PieceColor.Black, triggeredAtPly: 5 },
    ]);
    const state = deserializeGameState(data);

    const event = state.activeEvents[0];
    expect(event?.type).toBe(CrazyEvent.LiveGrenade);
    expect(event?.remainingPlies).toBe(-1);
    expect(event?.triggeredBy).toBe(PieceColor.Black);
    expect(event?.triggeredAtPly).toBe(5);
  });

  it('throws on unknown ruleSetId', () => {
    const data = makeSerializable(GameMode.Classic);
    const badData = { ...data, ruleSetId: 'unknown-rules' };
    expect(() => deserializeGameState(badData)).toThrow('Unknown ruleSetId');
  });
});

// ---------------------------------------------------------------------------
// getAIMove with events
// ---------------------------------------------------------------------------

describe('getAIMove — event-aware', () => {
  const ALL_PHASE2_EVENTS: CrazyEvent[] = [
    CrazyEvent.KingForADay,
    CrazyEvent.LiveGrenade,
    CrazyEvent.HotPotato,
    CrazyEvent.NoTouching,
    CrazyEvent.ChecksMix,
    CrazyEvent.OppositeDay,
    CrazyEvent.UpInTheAir,
  ];

  for (const eventType of ALL_PHASE2_EVENTS) {
    it(`${eventType}: returns a legal move`, () => {
      const data = makeSerializable(GameMode.Crazy, [
        makeSerializableEvent(eventType, PieceColor.Black),
      ]);
      const state = deserializeGameState(data);
      const move = getAIMove(data, 'easy');

      const legalMoves = state.ruleSet.getLegalMoves(state.board, state.activeColor);
      const isLegal = legalMoves.some(
        (m) =>
          (m.from as number) === (move.from as number) &&
          m.path.length === move.path.length &&
          m.path.every((p, i) => (p as number) === (move.path[i] as number)),
      );
      expect(isLegal).toBe(true);
    });
  }

  it('Up in the Air: completes within 3000 ms at hard difficulty', () => {
    const data = makeSerializable(GameMode.Crazy, [
      makeSerializableEvent(CrazyEvent.UpInTheAir, PieceColor.White),
    ]);

    const start = performance.now();
    const move = getAIMove(data, 'hard');
    const elapsed = performance.now() - start;

    expect(move).toBeDefined();
    expect(elapsed).toBeLessThan(3000);
  });

  it('Classic mode: returns a legal move with no active events', () => {
    const data = makeSerializable(GameMode.Classic);
    const state = deserializeGameState(data);
    const move = getAIMove(data, 'easy');

    const legalMoves = state.ruleSet.getLegalMoves(state.board, state.activeColor);
    const isLegal = legalMoves.some(
      (m) => (m.from as number) === (move.from as number),
    );
    expect(isLegal).toBe(true);
  });
});
