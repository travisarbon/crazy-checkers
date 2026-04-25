/**
 * Reproduces the kinging-freezes-the-board bug for Tier 1 PDN-variant games.
 *
 * Debugging-only test: heavy use of non-null assertions on parseNotation
 * results is intentional (the labels are constants known to parse).
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/require-await */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ClassifiedGameScreen from './ClassifiedGameScreen';
import { _clearClassifiedRegistry } from '../engine/classified/registry';
import {
  _clearTierLoaderCache,
  loadClassifiedTier,
} from '../engine/classified/tierLoader';
import { RUSSIAN_DRAUGHTS_ID } from '../engine/classified/tier1/ids';
import { russianDraughtsRuleSet } from '../engine/classified/tier1/russian';
import { PlayerType } from '../engine/types';
import type { ClassifiedGameState, ClassifiedPiece } from '../engine/classified/state';

beforeAll(async () => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
  await loadClassifiedTier(1);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Russian Draughts kinging — clicks should still work', () => {
  it('a freshly-promoted king has legal moves and clicks select it', () => {
    // Construct a state where a single white king has just been promoted at
    // a1 (the white back row from white's perspective is row 7; for black men
    // promoting to king, the back row would be row 0 — let's pick a state
    // similar to what happens after the FIRST game move that kings).
    //
    // We choose: white king at a1 (the rightmost-white-back-row dark square
    // of the white side) and a single black king elsewhere so legal moves
    // are non-empty.
    const labeler = russianDraughtsRuleSet.boardGeometry.coordinateLabels;

    const a1 = labeler.parseNotation('a1');
    const h8 = labeler.parseNotation('h8');
    const e5 = labeler.parseNotation('e5');
    expect(a1).not.toBeNull();
    expect(h8).not.toBeNull();
    expect(e5).not.toBeNull();

    const initialPieces = new Map<number, ClassifiedPiece>();
    initialPieces.set(a1! as unknown as number, { owner: 'white', kind: 'king' });
    initialPieces.set(h8! as unknown as number, { owner: 'black', kind: 'king' });
    initialPieces.set(e5! as unknown as number, { owner: 'black', kind: 'man' });

    const fakeState: ClassifiedGameState = {
      pieces: initialPieces as unknown as ReadonlyMap<
        ReturnType<typeof labeler.parseNotation> & object,
        ClassifiedPiece
      >,
      turn: 'white',
      plyCount: 0,
      moveHistory: [],
      meta: {
        kingMoveStreak: [],
        movesSinceCapture: 0,
        positionHistoryHash: [],
      },
    };

    const moves = russianDraughtsRuleSet.getLegalMoves(fakeState);
    expect(moves.length).toBeGreaterThan(0);
    const fromKingA1 = moves.filter(
      (m) => m.from === labeler.notationOf(a1!),
    );
    expect(fromKingA1.length).toBeGreaterThan(0);

    const original = russianDraughtsRuleSet.startingPosition;
    (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
      (): ClassifiedGameState => fakeState;

    try {
      render(
        <ClassifiedGameScreen
          gameId={RUSSIAN_DRAUGHTS_ID}
          players={{ white: PlayerType.Human, black: PlayerType.Human }}
          themeId="crazy"
          onNewGame={vi.fn()}
          onMainMenu={vi.fn()}
        />,
      );

      const ariaLabel = labeler.ariaOf(a1!);
      const hitTarget = screen.getByLabelText(ariaLabel);
      act(() => {
        fireEvent.click(hitTarget);
      });

      // After the click the renderer should draw <circle> markers for every
      // legal target — the SquareBoardRenderer renders those for
      // selection.legalTargets entries.
      const svg = screen.getByTestId('square-board-renderer');
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    } finally {
      (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
        original;
    }
  });

  it('end-to-end: play a real kinging sequence and verify clicks still work', () => {
    // White moves toward rank 8 (= row 0). Place a white man at a7 (row 1)
    // so a single nw/ne move kings it.
    const labeler = russianDraughtsRuleSet.boardGeometry.coordinateLabels;
    const a7 = labeler.parseNotation('a7')!;
    const h2 = labeler.parseNotation('h2')!;
    const initialPieces = new Map<number, ClassifiedPiece>();
    initialPieces.set(a7 as unknown as number, { owner: 'white', kind: 'man' });
    initialPieces.set(h2 as unknown as number, { owner: 'black', kind: 'king' });

    const initial: ClassifiedGameState = {
      pieces: initialPieces as unknown as ReadonlyMap<
        ReturnType<typeof labeler.parseNotation> & object,
        ClassifiedPiece
      >,
      turn: 'white',
      plyCount: 0,
      moveHistory: [],
      meta: {
        kingMoveStreak: [],
        movesSinceCapture: 0,
        positionHistoryHash: [],
      },
    };

    // Find a forward simple move for the white man toward promotion.
    const moves = russianDraughtsRuleSet.getLegalMoves(initial);
    expect(moves.length).toBeGreaterThan(0);
    // Prefer a move that ends on the back row (rank 8 = row 0) to king now.
    const promoting = moves.find((m) => m.promotion === 'king') ?? moves[0]!;

    const next = russianDraughtsRuleSet.applyMove(initial, promoting);

    // After the move, it is black's turn; rotate to make it white's turn
    // (or just look at white's pieces). The mover-now-king should have
    // legal moves on the very next white turn.
    expect(next.turn).toBe('black');

    // Inspect the post-move pieces — the white piece should now be a king.
    let foundKing = false;
    for (const p of next.pieces.values()) {
      if (p.owner === 'white' && p.kind === 'king') {
        foundKing = true;
        break;
      }
    }
    expect(foundKing).toBe(true);

    // Black plays its king.
    const blackMoves = russianDraughtsRuleSet.getLegalMoves(next);
    expect(blackMoves.length).toBeGreaterThan(0);
    const afterBlack = russianDraughtsRuleSet.applyMove(next, blackMoves[0]!);
    expect(afterBlack.turn).toBe('white');

    // White's freshly-promoted king must now have legal moves.
    const whiteMovesAfter = russianDraughtsRuleSet.getLegalMoves(afterBlack);
    expect(whiteMovesAfter.length).toBeGreaterThan(0);

    // checkGameOver must not return non-null on a state where both sides have
    // pieces and white has legal moves — otherwise ClassifiedGameScreen would
    // set `result` and freeze the board.
    expect(russianDraughtsRuleSet.checkGameOver(afterBlack)).toBeNull();
  });

  it('mid-capture promotion produces a clickable king from the actual game start', async () => {
    // Use the real starting position, then construct a contrived state by
    // hand that mimics an end-of-capture promotion and verify checkGameOver
    // remains null.
    const labeler = russianDraughtsRuleSet.boardGeometry.coordinateLabels;
    // White king newly promoted at b8, plus a black piece + a white piece
    // so neither side is wiped out.
    const b8 = labeler.parseNotation('b8')!;
    const e5 = labeler.parseNotation('e5')!;
    const h2 = labeler.parseNotation('h2')!;
    const pieces = new Map<number, ClassifiedPiece>();
    pieces.set(b8 as unknown as number, { owner: 'white', kind: 'king' });
    pieces.set(e5 as unknown as number, { owner: 'white', kind: 'man' });
    pieces.set(h2 as unknown as number, { owner: 'black', kind: 'king' });

    const state: ClassifiedGameState = {
      pieces: pieces as unknown as ReadonlyMap<
        ReturnType<typeof labeler.parseNotation> & object,
        ClassifiedPiece
      >,
      turn: 'black',
      plyCount: 1,
      moveHistory: [],
      meta: {
        kingMoveStreak: [],
        movesSinceCapture: 1,
        positionHistoryHash: ['x'],
      },
    };

    expect(russianDraughtsRuleSet.checkGameOver(state)).toBeNull();
    const moves = russianDraughtsRuleSet.getLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('end-to-end: real click sequence ending in a kinging move keeps the board responsive', () => {
    // Start with a contrived state: one white man at a7 (one step from
    // promotion) plus a couple of harmless black pieces. Render the screen,
    // click the man, click the kinging destination — the king should remain
    // selectable on white's next turn.
    const labeler = russianDraughtsRuleSet.boardGeometry.coordinateLabels;
    const a7 = labeler.parseNotation('a7')!;
    const h2 = labeler.parseNotation('h2')!;
    const f6 = labeler.parseNotation('f6')!;
    const pieces = new Map<number, ClassifiedPiece>();
    pieces.set(a7 as unknown as number, { owner: 'white', kind: 'man' });
    pieces.set(h2 as unknown as number, { owner: 'black', kind: 'king' });
    pieces.set(f6 as unknown as number, { owner: 'black', kind: 'man' });
    const fakeStart: ClassifiedGameState = {
      pieces: pieces as unknown as ReadonlyMap<
        ReturnType<typeof labeler.parseNotation> & object,
        ClassifiedPiece
      >,
      turn: 'white',
      plyCount: 0,
      moveHistory: [],
      meta: {
        kingMoveStreak: [],
        movesSinceCapture: 0,
        positionHistoryHash: [],
      },
    };

    const original = russianDraughtsRuleSet.startingPosition;
    (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
      (): ClassifiedGameState => fakeStart;

    try {
      render(
        <ClassifiedGameScreen
          gameId={RUSSIAN_DRAUGHTS_ID}
          // Both sides human so no auto CPU response interferes with the test.
          players={{ white: PlayerType.Human, black: PlayerType.Human }}
          themeId="crazy"
          onNewGame={vi.fn()}
          onMainMenu={vi.fn()}
        />,
      );

      // Click white's man at a7.
      const a7HitTarget = screen.getByLabelText(labeler.ariaOf(a7));
      act(() => {
        fireEvent.click(a7HitTarget);
      });

      // Find a kinging destination from the move list.
      const moves = russianDraughtsRuleSet.getLegalMoves(fakeStart);
      const kingingMove = moves.find(
        (m) => m.from === labeler.notationOf(a7) && m.promotion === 'king',
      );
      expect(kingingMove).toBeDefined();
      const kingingTo = kingingMove!.to;
      expect(typeof kingingTo).toBe('string');
      const toNode = labeler.parseNotation(kingingTo!)!;

      // Click the destination → applies the move + promotion.
      const destHitTarget = screen.getByLabelText(labeler.ariaOf(toNode));
      act(() => {
        fireEvent.click(destHitTarget);
      });

      // The terminal banner must NOT have appeared — the game is still going.
      expect(screen.queryByTestId('classified-terminal')).not.toBeInTheDocument();

      // Black is to move now. We don't care about the black move; just verify
      // that the turn indicator says it's black's turn (so applyMove ran).
      expect(screen.getByTestId('classified-turn')).toHaveTextContent(
        'Black to move',
      );
    } finally {
      (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
        original;
    }
  });

  it('end-to-end with CPU opponent: kinging followed by CPU move keeps the board responsive', async () => {
    vi.useFakeTimers();

    const labeler = russianDraughtsRuleSet.boardGeometry.coordinateLabels;
    const a7 = labeler.parseNotation('a7')!;
    const h2 = labeler.parseNotation('h2')!;
    const f6 = labeler.parseNotation('f6')!;
    const pieces = new Map<number, ClassifiedPiece>();
    pieces.set(a7 as unknown as number, { owner: 'white', kind: 'man' });
    pieces.set(h2 as unknown as number, { owner: 'black', kind: 'king' });
    pieces.set(f6 as unknown as number, { owner: 'black', kind: 'man' });
    const fakeStart: ClassifiedGameState = {
      pieces: pieces as unknown as ReadonlyMap<
        ReturnType<typeof labeler.parseNotation> & object,
        ClassifiedPiece
      >,
      turn: 'white',
      plyCount: 0,
      moveHistory: [],
      meta: {
        kingMoveStreak: [],
        movesSinceCapture: 0,
        positionHistoryHash: [],
      },
    };

    const original = russianDraughtsRuleSet.startingPosition;
    (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
      (): ClassifiedGameState => fakeStart;

    try {
      render(
        <ClassifiedGameScreen
          gameId={RUSSIAN_DRAUGHTS_ID}
          // Black is CPU so the random-move dispatcher fires after kinging.
          players={{ white: PlayerType.Human, black: PlayerType.CpuEasy }}
          themeId="crazy"
          onNewGame={vi.fn()}
          onMainMenu={vi.fn()}
        />,
      );

      // Click white's man.
      const a7HitTarget = screen.getByLabelText(labeler.ariaOf(a7));
      act(() => {
        fireEvent.click(a7HitTarget);
      });

      // Click a kinging destination.
      const moves = russianDraughtsRuleSet.getLegalMoves(fakeStart);
      const kingingMove = moves.find(
        (m) => m.from === labeler.notationOf(a7) && m.promotion === 'king',
      );
      expect(kingingMove).toBeDefined();
      const toNode = labeler.parseNotation(kingingMove!.to as string)!;
      const destHitTarget = screen.getByLabelText(labeler.ariaOf(toNode));
      act(() => {
        fireEvent.click(destHitTarget);
      });

      // Advance the CPU's setTimeout (250 ms) so the random-move dispatcher
      // fires, then flush React state updates.
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // The terminal banner must NOT appear — game continues.
      expect(screen.queryByTestId('classified-terminal')).not.toBeInTheDocument();

      // It should be white's turn again now.
      expect(screen.getByTestId('classified-turn')).toHaveTextContent(
        'White to move',
      );

      // Find the white king's current location after the CPU's move.
      // We do not know the exact node (CPU is random), so probe the
      // ClassifiedRegistryEntry's pieces via getClassifiedGame is not viable
      // here — instead query the rendered board for any white king-marked
      // piece. The PieceLayer uses a `data-testid="classified-piece"` we can
      // match. (If absent, fail with a descriptive message.)
      const whitePieces = document.querySelectorAll(
        '[data-testid="piece"][data-owner="white"]',
      );
      expect(whitePieces.length).toBeGreaterThan(0);

      // Now try to click the white king and verify legal-move highlights appear.
      const whitePiece = whitePieces[0] as Element;
      const nodeAttr = whitePiece
        .closest('g')
        ?.getAttribute('data-piece-id');
      expect(nodeAttr).toBe('king-white'); // Verify it really is a king.

      // Find the cell hit-target for the king. The king's NodeId is whatever
      // applyMove placed it at — for a single nw/ne kinging move from a7,
      // it's b8. We sweep the rendered hit-targets and click the one with a
      // king on it.
      // Use the data-node attribute on InteractionLayer rectangles.
      const hitRects = document.querySelectorAll('rect[data-node]');
      let kingClicked = false;
      for (const rect of Array.from(hitRects)) {
        const dataNode = rect.getAttribute('data-node');
        if (!dataNode) continue;
        // Read state via the rendered Piece's location: piece <g> has
        // transform="translate(x, y)" matching cell (col*cell+cell/2, ...)
        // — this is too brittle. Instead use ariaLabel matching b8.
        const aria = rect.getAttribute('aria-label');
        if (aria?.includes('b8')) {
          act(() => {
            fireEvent.click(rect);
          });
          kingClicked = true;
          break;
        }
      }
      expect(kingClicked).toBe(true);

      // After clicking the king, legal-target circles should appear.
      const svg = screen.getByTestId('square-board-renderer');
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    } finally {
      (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
        original;
      vi.useRealTimers();
    }
  });

  it('full starting position with one extra king is fully clickable', () => {
    // Take the actual full Russian Draughts starting position and tack on a
    // pre-promoted king on a vacant dark square — closer to a real mid-game.
    const labeler = russianDraughtsRuleSet.boardGeometry.coordinateLabels;
    const start = russianDraughtsRuleSet.startingPosition();
    const e5 = labeler.parseNotation('e5')!; // empty in starting layout
    const newPieces = new Map<number, ClassifiedPiece>();
    for (const [n, p] of start.pieces) {
      newPieces.set(n as unknown as number, p);
    }
    newPieces.set(e5 as unknown as number, { owner: 'white', kind: 'king' });

    const state: ClassifiedGameState = {
      pieces: newPieces as unknown as ReadonlyMap<
        ReturnType<typeof labeler.parseNotation> & object,
        ClassifiedPiece
      >,
      turn: 'white',
      plyCount: 0,
      moveHistory: [],
      meta: {
        kingMoveStreak: [],
        movesSinceCapture: 0,
        positionHistoryHash: [],
      },
    };

    const original = russianDraughtsRuleSet.startingPosition;
    (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
      () => state;

    try {
      render(
        <ClassifiedGameScreen
          gameId={RUSSIAN_DRAUGHTS_ID}
          players={{ white: PlayerType.Human, black: PlayerType.Human }}
          themeId="crazy"
          onNewGame={vi.fn()}
          onMainMenu={vi.fn()}
        />,
      );

      // Click the king's cell and verify legal-target circles appear.
      const e5Aria = labeler.ariaOf(e5);
      const e5HitTarget = screen.getByLabelText(e5Aria);
      act(() => {
        fireEvent.click(e5HitTarget);
      });

      const svg = screen.getByTestId('square-board-renderer');
      // Direct circle children are the legal-target highlights — Pieces are
      // inside <g data-testid="piece-layer">, so the immediate <circle>
      // children of the SVG come from the legalTargets render only.
      const directCircles = svg.querySelectorAll(':scope > circle');
      expect(directCircles.length).toBeGreaterThan(0);
    } finally {
      (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
        original;
    }
  });

  // Skipped: random-play strategy doesn't reliably reach a kinged state in
  // 200 iterations under Russian Draughts' captureObligatory rules — the
  // game ends with one side wiped before kinging. Kept as a parked harness
  // for future smarter-play replay.
  it.skip('after a real game-start kinging move, clicks on the new king highlight legal targets', () => {
    // Advance the rule engine through a deterministic sequence of moves
    // until a king appears, then mount the screen at that state.
    let state = russianDraughtsRuleSet.startingPosition();
    const labeler = russianDraughtsRuleSet.boardGeometry.coordinateLabels;

    // Play a known fast-kinging line: c3-d4, b6-a5, d4-c5, a5xb6 wait ...
    // Just play random forward moves until a king appears.
    function pickPromotingMove(): {
      readonly move: ReturnType<typeof russianDraughtsRuleSet.getLegalMoves>[number];
    } | null {
      const moves = russianDraughtsRuleSet.getLegalMoves(state);
      if (moves.length === 0) return null;
      const promo = moves.find((m) => m.promotion === 'king');
      if (promo) return { move: promo };
      // Otherwise prefer captures (they end games fast), else first legal.
      const capture = moves.find((m) => m.kind === 'jump');
      if (capture) return { move: capture };
      return { move: moves[0]! };
    }

    let safety = 200;
    let kinged = false;
    while (safety-- > 0) {
      const pick = pickPromotingMove();
      if (!pick) break;
      const before = state.pieces.size;
      state = russianDraughtsRuleSet.applyMove(state, pick.move);
      const after = state.pieces.size;
      // Detect king.
      for (const p of state.pieces.values()) {
        if (p.kind === 'king') {
          kinged = true;
          break;
        }
      }
      if (kinged) break;
      void before;
      void after;
    }
    expect(kinged).toBe(true);

    // It might be black's turn after the kinging move. Make sure we
    // surface a state where the kinging side is to move (so they can
    // click their own king).
    if (state.turn === 'black') {
      const moves = russianDraughtsRuleSet.getLegalMoves(state);
      if (moves.length > 0) {
        state = russianDraughtsRuleSet.applyMove(state, moves[0]!);
      }
    }
    expect(russianDraughtsRuleSet.checkGameOver(state)).toBeNull();

    const finalState = state;

    const original = russianDraughtsRuleSet.startingPosition;
    (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
      () => finalState;

    try {
      render(
        <ClassifiedGameScreen
          gameId={RUSSIAN_DRAUGHTS_ID}
          players={{ white: PlayerType.Human, black: PlayerType.Human }}
          themeId="crazy"
          onNewGame={vi.fn()}
          onMainMenu={vi.fn()}
        />,
      );

      // Find the king's location.
      let kingNode: number | null = null;
      const turnAfter = finalState.turn ?? 'white';
      for (const [nodeId, p] of finalState.pieces) {
        if (p.kind === 'king' && p.owner === turnAfter) {
          kingNode = nodeId as unknown as number;
          break;
        }
      }
      expect(kingNode).not.toBeNull();

      // Click the king's hit-rect.
      const ariaLabel = labeler.ariaOf(kingNode! as unknown as ReturnType<typeof labeler.parseNotation> & object);
      const hitTarget = screen.getByLabelText(ariaLabel);
      act(() => {
        fireEvent.click(hitTarget);
      });

      // Selection should produce legal-target circles in SquareBoardRenderer.
      // (We compare counts before and after the click.)
      const svg = screen.getByTestId('square-board-renderer');
      const directCircles = svg.querySelectorAll(
        ':scope > circle',
      );
      // legalTargets are rendered as direct <circle> children of the SVG.
      expect(directCircles.length).toBeGreaterThan(0);
    } finally {
      (russianDraughtsRuleSet as { startingPosition: typeof original }).startingPosition =
        original;
    }
  });
});
