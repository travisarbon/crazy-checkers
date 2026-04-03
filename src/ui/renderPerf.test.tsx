/**
 * Board re-render performance profiling.
 *
 * Uses React's <Profiler> API to measure render durations and asserts
 * each re-render completes within a single 60fps frame (<16ms).
 *
 * Excluded from the default `npm run test` suite via vitest.config.ts.
 * Run on-demand with: `npm run test:perf`
 *
 * Task 7.1 — Phase 2 Performance Baselines.
 */

import { Profiler } from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { BoardState, SquareState } from '../engine/types';
import { PieceColor, PieceType } from '../engine/types';
import { createInitialBoard, setBoardSquare } from '../engine/board';
import { square } from '../engine/types';
import Board from './Board';

const RENDER_THRESHOLD_MS = 16;

interface RenderTiming {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
}

/**
 * Captures render timings via React's Profiler API.
 */
function createProfiler() {
  const timings: RenderTiming[] = [];

  function onRender(
    id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
  ) {
    timings.push({ id, phase, actualDuration });
  }

  return { timings, onRender };
}

/**
 * Simulates a move by moving a piece from one square to another.
 */
function applySimpleMove(board: BoardState, from: number, to: number): BoardState {
  const piece = board[from - 1];
  if (!piece) return board;
  let newBoard = setBoardSquare(board, square(from), null);
  newBoard = setBoardSquare(newBoard, square(to), piece);
  return newBoard;
}

/**
 * Simulates a capture by moving a piece and removing the captured piece.
 */
function applyCapture(board: BoardState, from: number, to: number, captured: number): BoardState {
  const piece = board[from - 1];
  if (!piece) return board;
  let newBoard = setBoardSquare(board, square(from), null);
  newBoard = setBoardSquare(newBoard, square(captured), null);
  newBoard = setBoardSquare(newBoard, square(to), piece);
  return newBoard;
}

describe('Board re-render performance', () => {
  it('should mount the initial board in <16ms', () => {
    const { timings, onRender } = createProfiler();
    const board = createInitialBoard();

    render(
      <Profiler id="Board-mount" onRender={onRender}>
        <Board board={board} />
      </Profiler>,
    );

    expect(timings.length).toBeGreaterThanOrEqual(1);
    const mountTiming = timings[0] as RenderTiming;
    console.log(`Initial mount: ${mountTiming.actualDuration.toFixed(2)}ms`);
    expect(mountTiming.actualDuration).toBeLessThan(RENDER_THRESHOLD_MS);
  });

  it('should re-render after a simple move in <16ms', () => {
    const { timings, onRender } = createProfiler();
    const board = createInitialBoard();

    const { rerender } = render(
      <Profiler id="Board-move" onRender={onRender}>
        <Board board={board} />
      </Profiler>,
    );

    // White pawn moves from 21 to 17
    const newBoard = applySimpleMove(board, 21, 17);

    // Clear mount timing
    timings.length = 0;

    rerender(
      <Profiler id="Board-move" onRender={onRender}>
        <Board board={newBoard} />
      </Profiler>,
    );

    expect(timings.length).toBeGreaterThanOrEqual(1);
    const updateTiming = timings[0] as RenderTiming;
    console.log(`Post-move re-render: ${updateTiming.actualDuration.toFixed(2)}ms`);
    expect(updateTiming.actualDuration).toBeLessThan(RENDER_THRESHOLD_MS);
  });

  it('should re-render after a capture in <16ms', () => {
    const { timings, onRender } = createProfiler();

    // Set up a board with a capture opportunity
    const WP = { color: PieceColor.White, type: PieceType.Pawn } as const;
    const BP = { color: PieceColor.Black, type: PieceType.Pawn } as const;
    let board = createInitialBoard();
    // Move white pawn to 17, black pawn to 14 to create capture
    board = setBoardSquare(board, square(21), null);
    board = setBoardSquare(board, square(17), WP);
    board = setBoardSquare(board, square(12), null);
    board = setBoardSquare(board, square(14), BP);

    const { rerender } = render(
      <Profiler id="Board-capture" onRender={onRender}>
        <Board board={board} />
      </Profiler>,
    );

    // Capture: 17 jumps over 14 to 10
    const newBoard = applyCapture(board, 17, 10, 14);

    timings.length = 0;

    rerender(
      <Profiler id="Board-capture" onRender={onRender}>
        <Board board={newBoard} />
      </Profiler>,
    );

    expect(timings.length).toBeGreaterThanOrEqual(1);
    const updateTiming = timings[0] as RenderTiming;
    console.log(`Post-capture re-render: ${updateTiming.actualDuration.toFixed(2)}ms`);
    expect(updateTiming.actualDuration).toBeLessThan(RENDER_THRESHOLD_MS);
  });

  it('should re-render after a multi-jump (double capture) in <16ms', () => {
    const { timings, onRender } = createProfiler();

    // Build a board where a double-jump just happened (2 pieces removed, 1 piece moved far)
    const WP = { color: PieceColor.White, type: PieceType.Pawn } as const;
    const BP = { color: PieceColor.Black, type: PieceType.Pawn } as const;
    const board: SquareState[] = new Array<SquareState>(32).fill(null);
    // White pawn at 22, black pawns at 18 and 11 for a double-jump path: 22→15→6
    board[22 - 1] = WP;
    board[18 - 1] = BP;
    board[11 - 1] = BP;
    // Add some other pieces for context
    board[1 - 1] = BP;
    board[2 - 1] = BP;
    board[29 - 1] = WP;
    board[30 - 1] = WP;

    const boardBefore: BoardState = board;

    const { rerender } = render(
      <Profiler id="Board-multijump" onRender={onRender}>
        <Board board={boardBefore} />
      </Profiler>,
    );

    // After double jump: piece at 22 moves to 6, captures at 18 and 11 removed
    const boardAfter: SquareState[] = [...board];
    boardAfter[22 - 1] = null;
    boardAfter[18 - 1] = null;
    boardAfter[11 - 1] = null;
    boardAfter[6 - 1] = WP;

    timings.length = 0;

    rerender(
      <Profiler id="Board-multijump" onRender={onRender}>
        <Board board={boardAfter as BoardState} />
      </Profiler>,
    );

    expect(timings.length).toBeGreaterThanOrEqual(1);
    const updateTiming = timings[0] as RenderTiming;
    console.log(`Post-multi-jump re-render: ${updateTiming.actualDuration.toFixed(2)}ms`);
    expect(updateTiming.actualDuration).toBeLessThan(RENDER_THRESHOLD_MS);
  });

  it('should complete 10 successive re-renders each in <16ms', () => {
    const { timings, onRender } = createProfiler();
    let board = createInitialBoard();

    const { rerender } = render(
      <Profiler id="Board-successive" onRender={onRender}>
        <Board board={board} />
      </Profiler>,
    );

    // Simulate 10 successive moves (alternating simple moves)
    const moveSequence: Array<[number, number]> = [
      [21, 17], // W
      [12, 16], // B (simulated)
      [23, 19], // W
      [9, 14], // B
      [22, 18], // W
      [10, 15], // B
      [24, 20], // W
      [11, 16], // B (note: reuse is fine, just testing render speed)
      [25, 22], // W
      [8, 12], // B
    ];

    timings.length = 0;

    for (const [from, to] of moveSequence) {
      board = applySimpleMove(board, from, to);

      rerender(
        <Profiler id="Board-successive" onRender={onRender}>
          <Board board={board} />
        </Profiler>,
      );
    }

    console.log('\nSuccessive re-render timings:');
    for (let i = 0; i < timings.length; i++) {
      const t = timings[i] as RenderTiming;
      console.log(`  Move ${String(i + 1)}: ${t.actualDuration.toFixed(2)}ms`);
    }

    for (const timing of timings) {
      expect(
        timing.actualDuration,
        `Re-render took ${timing.actualDuration.toFixed(2)}ms (max: ${String(RENDER_THRESHOLD_MS)}ms)`,
      ).toBeLessThan(RENDER_THRESHOLD_MS);
    }
  });
});
