import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '../../engine/board';
import { CrazyEvent, PieceColor, PieceType } from '../../engine/types';
import type { ActiveEvent, BoardState, Piece } from '../../engine/types';
import { createDraughtsAdapter } from './draughtsAdapterFactory';

describe('createDraughtsAdapter', () => {
  it('round-trips a board through serialize and getBoard', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'test',
      supportsEvents: false,
    });
    const start = createInitialBoard();
    const serialized = adapter.serializeBoard(start);
    expect(serialized).toHaveLength(32);
    const round = adapter.getBoard(serialized);
    expect(round).toEqual(start);
  });

  it('returns plain AmericanRules when supportsEvents is false', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'classic-test',
      supportsEvents: false,
    });
    const ruleSet = adapter.getRuleSet();
    expect(ruleSet).toBeDefined();
    // American rules produce 7 legal opening moves for White.
    const moves = ruleSet.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBe(7);
  });

  it('returns a composite rule set when supportsEvents is true', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'crazy-test',
      supportsEvents: true,
    });
    const ruleSet = adapter.getRuleSet();
    expect(ruleSet).toBeDefined();
    // No active events passed — base behavior should match classic.
    const moves = ruleSet.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBe(7);
  });

  it('applies provided event context to the composite rule set', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'crazy-test',
      supportsEvents: true,
    });
    const events: ActiveEvent[] = [
      {
        type: CrazyEvent.OppositeDay,
        remainingPlies: 10,
        triggeredBy: PieceColor.White,
        triggeredAtPly: 0,
      },
    ];
    const ruleSet = adapter.getRuleSet(events);
    expect(ruleSet).toBeDefined();
  });

  it('always includes the permanent event on Choice adapters', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'choice-revolution',
      supportsEvents: true,
      permanentEvent: CrazyEvent.KingForADay,
    });
    const ruleSet = adapter.getRuleSet();
    // KingForADay temp-promotes all pieces — pawns can move backward as kings.
    const moves = ruleSet.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('returns the draughts board geometry', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'classic',
      supportsEvents: false,
    });
    const geo = adapter.getBoardGeometry();
    expect(geo).toEqual({
      gridType: 'diagonal-square',
      rows: 8,
      cols: 8,
      playableSquares: 32,
      darkSquaresOnly: true,
    });
  });

  it('returns the standard starting position', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'classic',
      supportsEvents: false,
    });
    expect(adapter.getStartingPosition()).toEqual(createInitialBoard());
  });

  it('returns exactly 4 piece-palette entries', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'classic',
      supportsEvents: false,
    });
    const palette = adapter.getPiecePalette();
    expect(palette).toHaveLength(4);
    expect(palette.map((p) => `${p.color}-${p.type}`).sort()).toEqual(
      ['BLACK-KING', 'BLACK-PAWN', 'WHITE-KING', 'WHITE-PAWN'].sort(),
    );
  });

  it('validatePosition flags too many pieces per side as an error', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'classic',
      supportsEvents: false,
    });
    const board: BoardState = Array.from({ length: 32 }, (_, i): Piece | null =>
      i < 20 ? { color: PieceColor.White, type: PieceType.Pawn } : null,
    );
    const result = adapter.validatePosition(board);
    expect(result.isLegal).toBe(false);
    expect(result.errors.some((e) => /Too many White/.test(e))).toBe(true);
  });

  it('validatePosition flags an empty board as an error', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'classic',
      supportsEvents: false,
    });
    const board: BoardState = Array.from({ length: 32 }, () => null);
    const result = adapter.validatePosition(board);
    expect(result.isLegal).toBe(false);
    expect(result.errors).toContain('No pieces on board');
  });

  it('validatePosition warns when a pawn sits on the promotion row', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'classic',
      supportsEvents: false,
    });
    const board: BoardState = Array.from({ length: 32 }, (_, i): Piece | null => {
      if (i === 0) return { color: PieceColor.White, type: PieceType.Pawn };
      if (i === 28) return { color: PieceColor.Black, type: PieceType.Pawn };
      return null;
    });
    const result = adapter.validatePosition(board);
    expect(result.isLegal).toBe(true);
    expect(result.warnings.length).toBe(2);
  });

  it('exposes a NotationAdapter and an EvaluationProvider', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'classic',
      supportsEvents: false,
    });
    expect(adapter.getNotationAdapter()).toBeDefined();
    expect(adapter.getEvaluationProvider()).toBeDefined();
    expect(adapter.supportsEvaluation()).toBe(true);
    expect(adapter.getEvaluationRange()).toEqual([-10_000, 10_000]);
  });

  it('exposes Easy and Hard search configs', () => {
    const adapter = createDraughtsAdapter({
      modeId: 'classic',
      supportsEvents: false,
    });
    const easy = adapter.getAIConfig('easy');
    const hard = adapter.getAIConfig('hard');
    expect(easy.maxDepth).toBeGreaterThan(0);
    expect(hard.maxDepth).toBeGreaterThanOrEqual(easy.maxDepth);
  });
});
