/**
 * FreePlayTool — the Free Play Cogitate tool (Task 21.5).
 *
 * Two-phase tool:
 *   editing: GameModeSelector + CogitateBoard (editor mode) + PositionEditor
 *            + EventEditor (Crazy/Chaos) + DiagramToolbar + GameSetupSection.
 *   playing: CogitateBoard (interactive) + EvaluationBar + MoveTimeline +
 *            DiagramToolbar, with a "Back to Editor" button.
 *
 * Diagrams persist across the phase transition. Games are saved to IndexedDB
 * with `mode: 'freeplay-[modeId]'`.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ActiveEvent,
  BoardState,
  GameState,
  PieceColor,
  PlayerSetup,
  Square,
} from '../../engine/types';
import {
  GameMode,
  GameStatus,
  PieceColor as PieceColors,
  PlayerType,
} from '../../engine/types';
import { getBoardSquare } from '../../engine/board';
import { computeZobristHash } from '../../engine/zobrist';
import { makeMove } from '../../engine/game';
import { getAdapter } from '../../cogitate/CogitateGameAdapter';
import type { CogitateGameAdapter } from '../../cogitate/CogitateGameAdapter';
import '../../cogitate/adapters/registerAll';
import { recordGame } from '../../persistence/gameHistory';
import { serializeBoard } from '../../persistence/serialization';
import type { SerializedActiveEvent } from '../../persistence/serialization';
import { requestAIMove } from '../../ai/workerClient';
import { requestEvaluation } from '../../ai/workerClient';
import { moveToString } from '../../utils/notation';
import type { NormalizedEvaluation } from '../../cogitate/types';
import CogitateBoard from '../CogitateBoard';
import EvaluationBar from '../EvaluationBar';
import GameHistoryBrowser from '../GameHistoryBrowser';
import MoveTimeline from '../MoveTimeline';
import type { Difficulty } from '../../ai/difficulty';
import { deserializeBoardState } from '../../persistence/serialization';
import GameModeSelector from './GameModeSelector';
import PositionEditor from './PositionEditor';
import EventEditor from './EventEditor';
import DiagramToolbar from './DiagramToolbar';
import { usePositionEditor } from './usePositionEditor';
import { useDiagramState } from './useDiagramState';
import { exportBoardAsPNG } from '../../cogitate/DiagramExport';
import styles from './FreePlayTool.module.css';

export interface FreePlayToolProps {
  readonly onBack: () => void;
}

type FreePlayPhase = 'editing' | 'playing';

interface PlayingSetup {
  readonly players: PlayerSetup;
  readonly flipped: boolean;
  readonly difficulty: Difficulty;
}

const DEFAULT_MODE_ID = 'classic';

function serializeActiveEvents(events: readonly ActiveEvent[]): SerializedActiveEvent[] {
  return events.map((e) => ({
    type: e.type,
    remainingPlies: e.remainingPlies,
    triggeredBy: e.triggeredBy,
    triggeredAtPly: e.triggeredAtPly,
    ...(e.metadata !== undefined ? { metadata: { ...e.metadata } } : {}),
  }));
}

function modeIdToEngineMode(modeId: string): GameMode {
  if (modeId === 'crazy') return GameMode.Crazy;
  if (modeId === 'chaos') return GameMode.Chaos;
  if (modeId.startsWith('choice')) return GameMode.Choice;
  return GameMode.Classic;
}

function buildInitialState(
  adapter: CogitateGameAdapter,
  board: BoardState,
  sideToMove: PieceColor,
  players: PlayerSetup,
  activeEvents: readonly ActiveEvent[],
): GameState {
  const ruleSet = adapter.getRuleSet(activeEvents);
  const initialHash = computeZobristHash(board, sideToMove);
  return {
    board,
    activeColor: sideToMove,
    status: GameStatus.InProgress,
    result: null,
    ruleSet,
    players,
    moveHistory: [],
    positionHashes: [initialHash],
    halfMoveClock: 0,
    plyCount: 0,
    mode: modeIdToEngineMode(adapter.modeId),
    activeEvents,
  };
}

export default function FreePlayTool({ onBack }: FreePlayToolProps) {
  const [phase, setPhase] = useState<FreePlayPhase>('editing');
  const [selectedModeId, setSelectedModeId] = useState(DEFAULT_MODE_ID);
  const [sideToMove, setSideToMove] = useState<PieceColor>(PieceColors.White);
  const [activeEvents, setActiveEvents] = useState<readonly ActiveEvent[]>([]);
  const [showLoadPosition, setShowLoadPosition] = useState(false);
  const [evaluation, setEvaluation] = useState<NormalizedEvaluation | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [playingState, setPlayingState] = useState<GameState | null>(null);
  const [playingSetup, setPlayingSetup] = useState<PlayingSetup | null>(null);
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);

  const adapter = useMemo<CogitateGameAdapter>(() => {
    const a = getAdapter(selectedModeId);
    if (!a) {
      const fallback = getAdapter(DEFAULT_MODE_ID);
      if (!fallback) {
        throw new Error('FreePlayTool: no Classic adapter registered');
      }
      return fallback;
    }
    return a;
  }, [selectedModeId]);

  const editor = usePositionEditor({ adapter });
  const diagram = useDiagramState();
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Mode change: reset editor state to the new adapter's starting position.
  // State-setter-during-render pattern — avoids the cascading-effect anti-pattern.
  const [trackedModeId, setTrackedModeId] = useState(selectedModeId);
  if (trackedModeId !== selectedModeId) {
    setTrackedModeId(selectedModeId);
    editor.standardSetup();
    if (activeEvents.length > 0) setActiveEvents([]);
    diagram.clearAll();
  }

  // Live evaluation of the editor board.
  useEffect(() => {
    if (phase !== 'editing') return;
    const state = { cancelled: false };
    void (async () => {
      try {
        const evalResult = await requestEvaluation(
          editor.board,
          sideToMove,
          selectedModeId,
          serializeActiveEvents(activeEvents),
        );
        if (!state.cancelled) setEvaluation(evalResult);
      } catch (err) {
        if (!state.cancelled) setEvaluation(null);
        console.warn('[FreePlay] evaluation failed', err);
      }
    })();
    return () => { state.cancelled = true; };
  }, [phase, editor.board, sideToMove, selectedModeId, activeEvents]);

  const handleStartGame = useCallback(
    (players: PlayerSetup, flipped: boolean, difficulty: Difficulty) => {
      const gs = buildInitialState(
        adapter,
        editor.board,
        sideToMove,
        players,
        activeEvents,
      );
      setPlayingState(gs);
      setPlayingSetup({ players, flipped, difficulty });
      setGameStartedAt(Date.now());
      setPhase('playing');
    },
    [adapter, editor.board, sideToMove, activeEvents],
  );

  const handleBackToEditor = useCallback(() => {
    if (
      playingState &&
      playingState.status === GameStatus.InProgress &&
      playingState.moveHistory.length > 0
    ) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Return to editor? The current game will not be saved.')
        : true;
      if (!ok) return;
    }
    setPhase('editing');
    setPlayingState(null);
    setPlayingSetup(null);
  }, [playingState]);

  const handleLoadSelectedGame = useCallback(
    (gameId: string, boardStateStr: string) => {
      void gameId;
      try {
        const loadedBoard = deserializeBoardState(boardStateStr);
        editor.loadBoard(loadedBoard);
      } catch (err) {
        console.warn('[FreePlay] Failed to load position', err);
      }
      setShowLoadPosition(false);
    },
    [editor],
  );

  const handleExportPNG = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    setIsExporting(true);
    void exportBoardAsPNG(svg)
      .catch((err: unknown) => { console.warn('[FreePlay] export failed', err); })
      .finally(() => { setIsExporting(false); });
  }, []);

  const showEventEditor =
    selectedModeId === 'crazy' || selectedModeId === 'chaos';

  if (phase === 'playing' && playingState && playingSetup) {
    return (
      <FreePlayGameView
        initialState={playingState}
        setup={playingSetup}
        adapter={adapter}
        diagramOverlays={diagram.overlays}
        activeTool={diagram.activeTool}
        activeColor={diagram.activeColor}
        onToolChange={diagram.setActiveTool}
        onColorChange={diagram.setActiveColor}
        onClearDiagram={diagram.clearAll}
        hasDiagramOverlays={diagram.hasOverlays}
        onExportPNG={handleExportPNG}
        isExporting={isExporting}
        onToggleHighlight={diagram.toggleHighlight}
        onBackToEditor={handleBackToEditor}
        gameStartedAt={gameStartedAt ?? 0}
        svgRef={svgRef}
      />
    );
  }

  return (
    <div className={styles.root} data-testid="free-play-tool" data-phase="editing">
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          data-testid="freeplay-back-to-home"
        >
          &larr; Back
        </button>
        <h2 className={styles.title}>Free Play</h2>
        <GameModeSelector
          selectedModeId={selectedModeId}
          onModeSelect={setSelectedModeId}
        />
      </header>

      <div className={styles.layout}>
        <div className={styles.boardPanel}>
          <div className={styles.boardArea}>
            <EvaluationBar
              score={evaluation}
              orientation="vertical"
              state={evaluation ? 'evaluated' : 'loading'}
              className={styles.evalBarVertical}
            />
            <CogitateBoard
              board={editor.board}
              editorMode
              onEditorSquareClick={editor.handleSquareClick}
              overlays={diagram.overlays}
              svgRef={svgRef}
            />
          </div>
          <EvaluationBar
            score={evaluation}
            orientation="horizontal"
            state={evaluation ? 'evaluated' : 'loading'}
            className={styles.evalBarHorizontal}
          />
        </div>

        <aside className={styles.sidePanel}>
          <PositionEditor
            piecePalette={editor.piecePalette}
            selectedPiece={editor.selectedPiece}
            onPieceSelect={editor.selectPiece}
            sideToMove={sideToMove}
            onSideToMoveChange={setSideToMove}
            validation={editor.validation}
            onClearBoard={editor.clearBoard}
            onStandardSetup={editor.standardSetup}
            onLoadPosition={() => { setShowLoadPosition(true); }}
          />
          {showEventEditor && (
            <EventEditor
              activeEvents={activeEvents}
              onEventsChange={setActiveEvents}
              modeId={selectedModeId}
            />
          )}
          <hr className={styles.sectionDivider} />
          <InlineGameSetup onStartGame={handleStartGame} />
        </aside>
      </div>

      <DiagramToolbar
        activeTool={diagram.activeTool}
        onToolChange={diagram.setActiveTool}
        activeColor={diagram.activeColor}
        onColorChange={diagram.setActiveColor}
        hasOverlays={diagram.hasOverlays}
        onClearAll={diagram.clearAll}
        onExportPNG={handleExportPNG}
        isExporting={isExporting}
      />

      {showLoadPosition && (
        <div
          className={styles.loadModal}
          role="dialog"
          aria-modal="true"
          data-testid="freeplay-load-modal"
        >
          <div className={styles.loadModalContent}>
            <header className={styles.header}>
              <h3 className={styles.title}>Load position</h3>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => { setShowLoadPosition(false); }}
                data-testid="freeplay-load-close"
              >
                Close
              </button>
            </header>
            <GameHistoryBrowser
              onSelectGame={(game) => {
                const board = game.boardStates[game.boardStates.length - 1];
                if (board) handleLoadSelectedGame(game.id, board);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline game-setup (simpler than full GameSetupSection for Free Play)
// ---------------------------------------------------------------------------

interface InlineGameSetupProps {
  readonly onStartGame: (
    players: PlayerSetup,
    flipped: boolean,
    difficulty: Difficulty,
  ) => void;
}

function InlineGameSetup({ onStartGame }: InlineGameSetupProps) {
  const [opponent, setOpponent] = useState<'human' | 'cpu'>('cpu');
  const [color, setColor] = useState<'white' | 'black'>('white');
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');

  const handleStart = () => {
    let players: PlayerSetup;
    let flipped: boolean;
    if (opponent === 'human') {
      players = { white: PlayerType.Human, black: PlayerType.Human };
      flipped = color === 'black';
    } else {
      const cpu = difficulty === 'easy' ? PlayerType.CpuEasy : PlayerType.CpuHard;
      if (color === 'white') {
        players = { white: PlayerType.Human, black: cpu };
        flipped = false;
      } else {
        players = { white: cpu, black: PlayerType.Human };
        flipped = true;
      }
    }
    onStartGame(players, flipped, difficulty);
  };

  return (
    <div data-testid="freeplay-inline-setup">
      <h3>Play From Position</h3>
      <fieldset>
        <legend>Opponent</legend>
        <label>
          <input
            type="radio"
            name="fp-opponent"
            value="cpu"
            checked={opponent === 'cpu'}
            onChange={() => { setOpponent('cpu'); }}
          />
          vs. CPU
        </label>
        <label>
          <input
            type="radio"
            name="fp-opponent"
            value="human"
            checked={opponent === 'human'}
            onChange={() => { setOpponent('human'); }}
          />
          Pass & Play
        </label>
      </fieldset>
      <fieldset>
        <legend>Your color</legend>
        <label>
          <input
            type="radio"
            name="fp-color"
            value="white"
            checked={color === 'white'}
            onChange={() => { setColor('white'); }}
          />
          White
        </label>
        <label>
          <input
            type="radio"
            name="fp-color"
            value="black"
            checked={color === 'black'}
            onChange={() => { setColor('black'); }}
          />
          Black
        </label>
      </fieldset>
      {opponent === 'cpu' && (
        <fieldset>
          <legend>Difficulty</legend>
          <label>
            <input
              type="radio"
              name="fp-diff"
              value="easy"
              checked={difficulty === 'easy'}
              onChange={() => { setDifficulty('easy'); }}
            />
            Easy
          </label>
          <label>
            <input
              type="radio"
              name="fp-diff"
              value="hard"
              checked={difficulty === 'hard'}
              onChange={() => { setDifficulty('hard'); }}
            />
            Hard
          </label>
        </fieldset>
      )}
      <button
        type="button"
        className={styles.startButton}
        onClick={handleStart}
        data-testid="freeplay-start-game"
      >
        Start Game
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FreePlayGameView — Playing phase
// ---------------------------------------------------------------------------

interface FreePlayGameViewProps {
  readonly initialState: GameState;
  readonly setup: PlayingSetup;
  readonly adapter: CogitateGameAdapter;
  readonly diagramOverlays: ReturnType<typeof useDiagramState>['overlays'];
  readonly activeTool: ReturnType<typeof useDiagramState>['activeTool'];
  readonly activeColor: ReturnType<typeof useDiagramState>['activeColor'];
  readonly onToolChange: ReturnType<typeof useDiagramState>['setActiveTool'];
  readonly onColorChange: ReturnType<typeof useDiagramState>['setActiveColor'];
  readonly onClearDiagram: () => void;
  readonly hasDiagramOverlays: boolean;
  readonly onExportPNG: () => void;
  readonly isExporting: boolean;
  readonly onToggleHighlight: (sq: Square) => void;
  readonly onBackToEditor: () => void;
  readonly gameStartedAt: number;
  readonly svgRef: React.RefObject<SVGSVGElement | null>;
}

function FreePlayGameView({
  initialState,
  setup,
  adapter,
  diagramOverlays,
  activeTool,
  activeColor,
  onToolChange,
  onColorChange,
  onClearDiagram,
  hasDiagramOverlays,
  onExportPNG,
  isExporting,
  onToggleHighlight,
  onBackToEditor,
  gameStartedAt,
  svgRef,
}: FreePlayGameViewProps) {
  const [gameState, setGameState] = useState(initialState);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [evaluation, setEvaluation] = useState<NormalizedEvaluation | null>(null);

  const legalMoves = useMemo(
    () => gameState.ruleSet.getLegalMoves(gameState.board, gameState.activeColor),
    [gameState],
  );

  const selectablePieces = useMemo<Set<number>>(() => {
    const set = new Set<number>();
    for (const m of legalMoves) set.add(m.from as number);
    return set;
  }, [legalMoves]);

  const legalDestinations = useMemo<Set<number>>(() => {
    const set = new Set<number>();
    if (selectedSquare === null) return set;
    for (const m of legalMoves) {
      if ((m.from as number) === (selectedSquare as number) && m.path.length > 0) {
        set.add(m.path[0] as number);
      }
    }
    return set;
  }, [legalMoves, selectedSquare]);

  // Determine if current player is AI.
  const isAITurn = useMemo(() => {
    const active = gameState.activeColor === PieceColors.White
      ? gameState.players.white
      : gameState.players.black;
    return active === PlayerType.CpuEasy || active === PlayerType.CpuHard;
  }, [gameState]);

  // AI move loop.
  useEffect(() => {
    if (gameState.status !== GameStatus.InProgress || !isAITurn) return;
    const state = { cancelled: false };
    void (async () => {
      try {
        const move = await requestAIMove(gameState, setup.difficulty);
        if (state.cancelled) return;
        setGameState((prev) => {
          if (prev.status !== GameStatus.InProgress) return prev;
          try {
            return makeMove(prev, move);
          } catch {
            return prev;
          }
        });
      } catch (err) {
        console.warn('[FreePlay] AI move failed', err);
      }
    })();
    return () => { state.cancelled = true; };
  }, [gameState, isAITurn, setup.difficulty]);

  // Live evaluation.
  useEffect(() => {
    const state = { cancelled: false };
    void (async () => {
      try {
        const evalResult = await requestEvaluation(
          gameState.board,
          gameState.activeColor,
          adapter.modeId,
          serializeActiveEvents(gameState.activeEvents),
        );
        if (!state.cancelled) setEvaluation(evalResult);
      } catch {
        if (!state.cancelled) setEvaluation(null);
      }
    })();
    return () => { state.cancelled = true; };
  }, [gameState.board, gameState.activeColor, gameState.activeEvents, adapter.modeId]);

  // Save record on game over. Uses a ref gate to avoid setState-in-effect.
  const savedRecordRef = useRef(false);
  useEffect(() => {
    if (savedRecordRef.current) return;
    if (gameState.status !== GameStatus.GameOver) return;
    savedRecordRef.current = true;
    void (async () => {
      try {
        await recordGame(
          gameState,
          `freeplay-${adapter.modeId}`,
          gameStartedAt,
          gameState.positionHashes.map(() => serializeBoard(gameState.board)),
        );
      } catch (err) {
        console.warn('[FreePlay] failed to record game', err);
      }
    })();
  }, [gameState, adapter.modeId, gameStartedAt]);

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (activeTool === 'highlight') {
        onToggleHighlight(sq);
        return;
      }
      if (gameState.status !== GameStatus.InProgress) return;
      if (isAITurn) return;

      const sqNum = sq as number;
      if (selectedSquare !== null && legalDestinations.has(sqNum)) {
        const matching = legalMoves.filter(
          (m) =>
            (m.from as number) === (selectedSquare as number) &&
            (m.path[0] as number) === sqNum,
        );
        if (matching.length === 0) return;
        const best = matching.reduce((acc, m) =>
          m.captured.length > acc.captured.length ? m : acc,
        );
        setSelectedSquare(null);
        try {
          setGameState((prev) => makeMove(prev, best));
        } catch (err) {
          console.warn('[FreePlay] move failed', err);
        }
        return;
      }

      const piece = getBoardSquare(gameState.board, sq);
      if (
        piece !== null &&
        piece.color === gameState.activeColor &&
        selectablePieces.has(sqNum)
      ) {
        setSelectedSquare(sq);
        return;
      }
      setSelectedSquare(null);
    },
    [
      activeTool,
      onToggleHighlight,
      gameState,
      isAITurn,
      selectedSquare,
      legalDestinations,
      legalMoves,
      selectablePieces,
    ],
  );

  const movesAsNotation = useMemo(
    () => gameState.moveHistory.map((m) => moveToString(m)),
    [gameState.moveHistory],
  );

  return (
    <div className={styles.root} data-testid="free-play-tool" data-phase="playing">
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBackToEditor}
          data-testid="freeplay-back-to-editor"
        >
          &larr; Back to Editor
        </button>
        <h2 className={styles.title}>
          Free Play — {adapter.modeId}
        </h2>
      </header>

      <div className={styles.layout}>
        <div className={styles.boardPanel}>
          <div className={styles.boardArea}>
            <EvaluationBar
              score={evaluation}
              orientation="vertical"
              state={evaluation ? 'evaluated' : 'loading'}
              className={styles.evalBarVertical}
            />
            <CogitateBoard
              board={gameState.board}
              interactive={gameState.status === GameStatus.InProgress && !isAITurn}
              onSquareClick={handleSquareClick}
              selectedSquare={selectedSquare}
              legalMoveSquares={legalDestinations}
              flipped={setup.flipped}
              overlays={diagramOverlays}
              svgRef={svgRef}
            />
          </div>
          <EvaluationBar
            score={evaluation}
            orientation="horizontal"
            state={evaluation ? 'evaluated' : 'loading'}
            className={styles.evalBarHorizontal}
          />
        </div>

        <aside className={styles.sidePanel}>
          <MoveTimeline
            moves={movesAsNotation}
            currentPly={movesAsNotation.length}
            onPlySelect={() => { /* Not navigable during live play */ }}
          />
          {gameState.status === GameStatus.GameOver && gameState.result && (
            <div className={styles.gameOverBanner} data-testid="freeplay-game-over">
              Game Over — {gameState.result.type} ({gameState.result.reason})
            </div>
          )}
        </aside>
      </div>

      <DiagramToolbar
        activeTool={activeTool}
        onToolChange={onToolChange}
        activeColor={activeColor}
        onColorChange={onColorChange}
        hasOverlays={hasDiagramOverlays}
        onClearAll={onClearDiagram}
        onExportPNG={onExportPNG}
        isExporting={isExporting}
      />
    </div>
  );
}
