/**
 * ClassifiedGameScreen — Task 27.8 MVP entry point for Classified games.
 *
 * Thin, geometry-agnostic wrapper that resolves the registered
 * ClassifiedRuleSet + BoardRenderer from the registries and drives
 * move dispatch via ruleSet.getLegalMoves / applyMove / checkGameOver.
 * Per Task 27.8 §4.1 this intentionally does NOT touch GameScreen.tsx.
 */

import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import type { NodeId } from '../engine/boardGeometry';
import type { PlayerSetup, GameResult } from '../engine/types';
import { PieceColor, PlayerType, GameResultType } from '../engine/types';
import type {
  ClassifiedGameId,
  ClassifiedMove,
} from '../engine/classified/ClassifiedRuleSet';
import {
  getClassifiedGame,
  type ClassifiedRegistryEntry,
} from '../engine/classified/registry';
import type { ClassifiedGameState } from '../engine/classified/state';
import { THEMES } from '../themes/theme';
import type { Theme } from '../themes/theme';
import { BoardChrome } from './board/BoardChrome';
import { getBoardRenderer } from './board/BoardRendererRegistry';
import { EMPTY_SELECTION } from './board/types';
import type { InteractionKind, SelectionState } from './board/types';

// `./board/index` registers every default BoardRenderer as an import
// side-effect. ClassifiedGameScreen resolves renderers by geometry, so
// trigger the side-effect eagerly here.
import './board/index';
import styles from './ClassifiedGameScreen.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ClassifiedGameScreenProps {
  readonly gameId: ClassifiedGameId;
  readonly players: PlayerSetup;
  readonly flipped?: boolean;
  readonly themeId: string;
  readonly onNewGame: () => void;
  readonly onMainMenu: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Owner = 'white' | 'black';

function otherTurn(turn: Owner): Owner {
  return turn === 'white' ? 'black' : 'white';
}

function activePlayerType(players: PlayerSetup, turn: Owner): PlayerType {
  return turn === 'white' ? players.white : players.black;
}

function isCpu(pt: PlayerType): boolean {
  return pt === PlayerType.CpuEasy || pt === PlayerType.CpuHard;
}

function resolveTheme(themeId: string): Theme {
  const theme = THEMES[themeId];
  if (theme) return theme;
  const fallback = Object.values(THEMES)[0];
  if (!fallback) {
    throw new Error('ClassifiedGameScreen: no themes registered.');
  }
  return fallback;
}

function formatResult(result: GameResult, humanColor: PieceColor | null): {
  readonly title: string;
  readonly reason: string;
} {
  const reasonLabel = (() => {
    switch (result.reason) {
      case 'NO_PIECES_LEFT':
        return 'No pieces remaining.';
      case 'NO_LEGAL_MOVES':
        return 'No legal moves available.';
      case 'REPETITION':
        return 'Threefold repetition.';
      case 'FORTY_MOVE_RULE':
        return '40-move rule.';
      case 'RESIGNATION':
        return 'Resignation.';
      case 'TIME':
        return 'Flag fell.';
      default:
        return '';
    }
  })();

  if (result.type === GameResultType.Draw) {
    return { title: 'Draw', reason: reasonLabel };
  }
  const winningColor =
    result.type === GameResultType.WhiteWin ? PieceColor.White : PieceColor.Black;
  if (humanColor !== null) {
    return {
      title: winningColor === humanColor ? 'You win' : 'You lose',
      reason: reasonLabel,
    };
  }
  return {
    title: winningColor === PieceColor.White ? 'White wins' : 'Black wins',
    reason: reasonLabel,
  };
}

function humanColorOf(players: PlayerSetup): PieceColor | null {
  const whiteIsHuman = players.white === PlayerType.Human;
  const blackIsHuman = players.black === PlayerType.Human;
  if (whiteIsHuman && !blackIsHuman) return PieceColor.White;
  if (!whiteIsHuman && blackIsHuman) return PieceColor.Black;
  return null;
}

function chooseFallbackMove(moves: readonly ClassifiedMove[]): ClassifiedMove | null {
  if (moves.length === 0) return null;
  const idx = Math.floor(Math.random() * moves.length);
  return moves[idx] ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClassifiedGameScreen({
  gameId,
  players,
  themeId,
  onNewGame,
  onMainMenu,
}: ClassifiedGameScreenProps) {
  const entry: ClassifiedRegistryEntry | null = useMemo(
    () => getClassifiedGame(gameId),
    [gameId],
  );

  const rendererComponent = useMemo(() => {
    if (!entry) return null;
    try {
      return getBoardRenderer(entry.boardGeometry);
    } catch (err) {
      console.warn('[ClassifiedGameScreen] missing board renderer:', err);
      return null;
    }
  }, [entry]);

  const theme = useMemo(() => resolveTheme(themeId), [themeId]);

  // Lazy init: App.tsx remounts this component via `key` when gameId changes,
  // so we never need to reset state in an effect.
  const [state, setState] = useState<ClassifiedGameState | null>(() =>
    entry ? entry.ruleSet.startingPosition() : null,
  );
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  const currentTurn: Owner = (state?.turn as Owner | undefined) ?? 'white';
  const humanColor = humanColorOf(players);

  // Compute legal moves for the active player on the current state
  const legalMoves: readonly ClassifiedMove[] = useMemo(() => {
    if (!entry || state === null || result !== null) return [];
    try {
      return entry.ruleSet.getLegalMoves(state);
    } catch (err) {
      console.warn('[ClassifiedGameScreen] getLegalMoves threw:', err);
      return [];
    }
  }, [entry, state, result]);

  // Selection targets — if a node is selected, show the to-nodes of its moves.
  // Move labels use `notationOf` (PDN number on dark-board variants, algebraic
  // on full boards), matching what ruleSet.getLegalMoves stamps on each move.
  const selection: SelectionState = useMemo(() => {
    if (!entry || state === null || selectedNode === null) return EMPTY_SELECTION;
    const labeler = entry.boardGeometry.coordinateLabels;
    const fromLabel = labeler.notationOf(selectedNode);
    const targets = new Set<NodeId>();
    for (const m of legalMoves) {
      if (m.from !== fromLabel) continue;
      const toLabel = typeof m.to === 'string' ? m.to : null;
      if (toLabel === null) continue;
      const toNode = labeler.parseNotation(toLabel);
      if (toNode !== null) targets.add(toNode);
    }
    return {
      selected: selectedNode,
      legalTargets: targets,
      lastMove: null,
    };
  }, [entry, state, selectedNode, legalMoves]);

  // Apply a single move
  const applyMove = useCallback(
    (move: ClassifiedMove) => {
      if (!entry || state === null) return;
      try {
        const next = entry.ruleSet.applyMove(state, move);
        const nextResult = entry.ruleSet.checkGameOver(next);
        setState(next);
        setSelectedNode(null);
        if (nextResult !== null) setResult(nextResult);
      } catch (err) {
        console.warn('[ClassifiedGameScreen] applyMove threw:', err);
      }
    },
    [entry, state],
  );

  // Detect stalemate-style terminal states that `checkGameOver` does not
  // report but for which the active player has no legal moves. Computed
  // from render-time values — no setState inside useEffect required.
  const derivedStalemateResult: GameResult | null = useMemo(() => {
    if (!entry || state === null || result !== null) return null;
    if (legalMoves.length > 0) return null;
    const over = entry.ruleSet.checkGameOver(state);
    if (over !== null) return over;
    const opponent = otherTurn(currentTurn);
    return {
      type:
        opponent === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin,
      reason: 'NO_LEGAL_MOVES',
    };
  }, [entry, state, result, legalMoves, currentTurn]);

  const effectiveResult: GameResult | null = result ?? derivedStalemateResult;

  // CPU move dispatcher — runs when it's a CPU's turn and game is in progress
  useEffect(() => {
    if (!entry || state === null || effectiveResult !== null) return;
    const activeType = activePlayerType(players, currentTurn);
    if (!isCpu(activeType)) return;
    if (legalMoves.length === 0) return; // terminal state rendered by effectiveResult

    // Schedule the move a tick later so the UI renders the human move first.
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const move = chooseFallbackMove(legalMoves);
      if (move) applyMove(move);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [entry, state, effectiveResult, legalMoves, players, currentTurn, applyMove]);

  // Handle clicks / taps on board nodes
  const handleNodeInteract = useCallback(
    (node: NodeId, kind: InteractionKind) => {
      if (!entry || state === null || result !== null) return;
      if (kind !== 'click' && kind !== 'keyboard-activate') return;
      const activeType = activePlayerType(players, currentTurn);
      if (isCpu(activeType)) return; // Ignore clicks while CPU is to move

      const labeler = entry.boardGeometry.coordinateLabels;

      // If we already have a selection, try to apply a move to this node
      if (selectedNode !== null) {
        const fromLabel = labeler.notationOf(selectedNode);
        const toLabel = labeler.notationOf(node);
        const match = legalMoves.find(
          (m) => m.from === fromLabel && m.to === toLabel,
        );
        if (match) {
          applyMove(match);
          return;
        }
      }

      // Otherwise, treat this click as a piece selection. Only allow selecting
      // pieces of the active color that have legal moves.
      const piece = state.pieces.get(node);
      if (!piece) {
        setSelectedNode(null);
        return;
      }
      if (piece.owner !== currentTurn) {
        setSelectedNode(null);
        return;
      }
      const fromLabel = labeler.notationOf(node);
      const hasMoves = legalMoves.some((m) => m.from === fromLabel);
      setSelectedNode(hasMoves ? node : null);
    },
    [entry, state, result, selectedNode, legalMoves, players, currentTurn, applyMove],
  );

  // ---------------------------------------------------------------
  // Render branches
  // ---------------------------------------------------------------
  if (!entry) {
    return (
      <div className={styles.shell} data-testid="classified-game-screen">
        <header className={styles.header}>
          <button
            className={styles.backButton}
            onClick={onMainMenu}
            aria-label="Return to gallery"
          >
            &larr; Back
          </button>
          <h1 className={styles.title}>Classified Game</h1>
        </header>
        <div className={styles.errorState}>
          <h2>Game not registered</h2>
          <p>
            &quot;{String(gameId)}&quot; could not be resolved from the Classified
            registry.
          </p>
        </div>
      </div>
    );
  }

  if (rendererComponent === null || state === null) {
    return (
      <div className={styles.shell} data-testid="classified-game-screen">
        <header className={styles.header}>
          <button
            className={styles.backButton}
            onClick={onMainMenu}
            aria-label="Return to gallery"
          >
            &larr; Back
          </button>
          <h1 className={styles.title}>{entry.displayName}</h1>
        </header>
        <div className={styles.errorState}>
          <h2>Board renderer unavailable</h2>
          <p>
            No renderer is registered for board geometry &quot;
            {entry.boardGeometry.serializedKey}&quot;.
          </p>
        </div>
      </div>
    );
  }

  const activeType = activePlayerType(players, currentTurn);
  const activeLabel = (() => {
    if (effectiveResult !== null) return 'Game over';
    if (isCpu(activeType)) return `CPU thinking (${currentTurn === 'white' ? 'White' : 'Black'})`;
    return `${currentTurn === 'white' ? 'White' : 'Black'} to move`;
  })();

  const humanColorPieceColor: PieceColor | null = humanColor;
  const boardSize = 480;

  return (
    <div className={styles.shell} data-testid="classified-game-screen">
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={onMainMenu}
          aria-label="Return to gallery"
        >
          &larr; Menu
        </button>
        <h1 className={styles.title}>{entry.displayName}</h1>
        <span className={styles.turnIndicator} aria-live="polite" data-testid="classified-turn">
          {activeLabel}
        </span>
      </header>

      <div className={styles.boardArea}>
        <BoardChrome
          geometry={entry.boardGeometry}
          ariaLabel={entry.displayName}
        >
          {createElement(rendererComponent, {
            geometry: entry.boardGeometry,
            state,
            selection,
            onNodeInteract: handleNodeInteract,
            theme,
            mode: 'interactive',
            size: boardSize,
            ariaLabel: entry.displayName,
          })}
        </BoardChrome>
      </div>

      {effectiveResult !== null && (() => {
        const formatted = formatResult(effectiveResult, humanColorPieceColor);
        return (
          <div className={styles.terminalBanner} data-testid="classified-terminal">
            <p className={styles.terminalTitle}>{formatted.title}</p>
            {formatted.reason ? (
              <p className={styles.terminalReason}>{formatted.reason}</p>
            ) : null}
            <div className={styles.terminalActions}>
              <button
                className={styles.secondaryButton}
                onClick={onNewGame}
                data-testid="classified-new-game"
              >
                New Game
              </button>
              <button
                className={styles.primaryButton}
                onClick={onMainMenu}
                data-testid="classified-return-gallery"
              >
                Return to Gallery
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
