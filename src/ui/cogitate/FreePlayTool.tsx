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
  PieceType,
  PlayerSetup,
  Square,
} from '../../engine/types';
import {
  CrazyEvent,
  GameMode,
  GameStatus,
  PieceColor as PieceColors,
  PlayerType,
} from '../../engine/types';
import type { MarchingOrdersGrid } from './usePositionEditor';
import { extSquareToGrid } from '../../engine/events/marchingOrders';
import { getBoardSquare, squareToGrid } from '../../engine/board';
import { computeZobristHash } from '../../engine/zobrist';
import { makeMove } from '../../engine/game';
import { EVENT_METADATA_FACTORIES } from '../../engine/events';
import { getAdapter } from '../../cogitate/CogitateGameAdapter';
import type { CogitateGameAdapter } from '../../cogitate/CogitateGameAdapter';
import '../../cogitate/adapters/registerAll';
import { CHOICE_MODE_DATA } from '../../persistence/choiceModeData';
import { choiceDisplayNameToId } from '../../cogitate/adapters/choiceAdapter';
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
import ActiveEventsIndicator from '../ActiveEventsIndicator';
import EventAnnouncement from '../EventAnnouncement';
import { useAnimationQueue, buildAnimationSequence, type AnimationStep } from '../useAnimationQueue';
import { useEventAnimations } from '../useEventAnimations';
import { useEventOverlays } from '../useEventOverlays';
import { getEffectiveBoard } from '../../engine/game';
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

function eventKey(e: ActiveEvent): string {
  return `${e.type}:${String(e.triggeredAtPly)}`;
}

function getNewlyTriggeredFreePlayEvents(
  prev: readonly ActiveEvent[],
  next: readonly ActiveEvent[],
): readonly ActiveEvent[] {
  const prevKeys = new Set(prev.map(eventKey));
  return next.filter((e) => !prevKeys.has(eventKey(e)));
}

function getNewlyExpiredFreePlayEvents(
  prev: readonly ActiveEvent[],
  next: readonly ActiveEvent[],
): readonly ActiveEvent[] {
  const nextKeys = new Set(next.map(eventKey));
  return prev.filter((e) => !nextKeys.has(eventKey(e)));
}

function formatFreePlayResult(type: string): string {
  if (type === 'WHITE_WIN') return 'White wins';
  if (type === 'BLACK_WIN') return 'Black wins';
  if (type === 'DRAW') return 'Draw';
  return type;
}

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

/**
 * Project a 64-element Marching Orders grid down to a 32-slot dark-square
 * BoardState for engine consumption. Light-square pieces live only in MO
 * metadata once play begins.
 */
function projectMarchingOrdersGridToBoard(grid: MarchingOrdersGrid): BoardState {
  const board: (null | { color: PieceColor; type: PieceType })[] = new Array<
    null | { color: PieceColor; type: PieceType }
  >(32).fill(null);
  for (let sq = 1; sq <= 32; sq++) {
    const { row, col } = squareToGrid(sq as Square);
    const piece = grid[row * 8 + col];
    if (piece) {
      board[sq - 1] = { color: piece.color, type: piece.type };
    }
  }
  return board as BoardState;
}

/**
 * Ensure Marching Orders has the metadata it needs (64-element grid)
 * before the decorator runs. When the editor has placed pieces on light
 * squares, splice those into the grid so the game starts with the full
 * edited position instead of only the dark-square projection.
 */
function ensureMarchingOrdersMetadata(
  activeEvents: readonly ActiveEvent[],
  editorGrid: MarchingOrdersGrid | null,
): readonly ActiveEvent[] {
  if (activeEvents.every((e) => e.type !== CrazyEvent.MarchingOrders)) {
    return activeEvents;
  }
  return activeEvents.map((e) => {
    if (e.type !== CrazyEvent.MarchingOrders) return e;
    // Prefer the editor's 64-grid (which already includes light pieces).
    // Fall back to empty grid — the MO decorator will sync from the 32-
    // square board on its first move.
    const grid =
      editorGrid ??
      (new Array(64).fill(null) as MarchingOrdersGrid);
    return {
      ...e,
      metadata: {
        orthogonalGrid: grid,
        applied: false,
      } as unknown as Readonly<Record<string, unknown>>,
    };
  });
}

/** Build a lookup from Choice mode ids to their permanent CrazyEvent. */
const CHOICE_MODE_PERMANENT_EVENT: ReadonlyMap<string, CrazyEvent | null> =
  new Map(
    CHOICE_MODE_DATA.map((def) => [
      choiceDisplayNameToId(def.displayName),
      def.event,
    ]),
  );

/**
 * Return the permanent CrazyEvent baked into `modeId`, or null for modes
 * without a baked-in event (classic, crazy, chaos, extra-crazy-style
 * Choice modes). FreePlay needs this so the permanent event is actually
 * present in state.activeEvents — not just hidden inside the adapter's
 * internal composite ruleset — which is required for the event decorator
 * to see its own metadata.
 */
function getPermanentEventForMode(modeId: string): CrazyEvent | null {
  if (modeId.startsWith('choice-')) {
    return CHOICE_MODE_PERMANENT_EVENT.get(modeId) ?? null;
  }
  return null;
}

/**
 * Compose the initial ActiveEvent[] for a Free Play game. Includes the
 * Choice mode's permanent event (with properly-initialized metadata) when
 * one exists, then the user-authored activeEvents (event-editor toggles).
 */
function composeInitialActiveEvents(
  modeId: string,
  board: BoardState,
  userActiveEvents: readonly ActiveEvent[],
): readonly ActiveEvent[] {
  const permanentEventType = getPermanentEventForMode(modeId);
  if (permanentEventType === null) return userActiveEvents;

  const metadataFactory = EVENT_METADATA_FACTORIES.get(permanentEventType);
  const metadata = metadataFactory
    ? metadataFactory(board, PieceColors.White)
    : undefined;

  const permanent: ActiveEvent = {
    type: permanentEventType,
    remainingPlies: -1,
    triggeredBy: PieceColors.White,
    triggeredAtPly: 0,
    permanent: true,
    ...(metadata !== undefined ? { metadata } : {}),
  };

  // Drop any duplicate from userActiveEvents so the permanent one wins.
  const filteredUser = userActiveEvents.filter(
    (e) => e.type !== permanentEventType,
  );
  return [permanent, ...filteredUser];
}

function buildInitialState(
  adapter: CogitateGameAdapter,
  board: BoardState,
  sideToMove: PieceColor,
  players: PlayerSetup,
  activeEvents: readonly ActiveEvent[],
): GameState {
  const ruleSet = adapter.getRuleSet(activeEvents);
  // The adapter's ruleSet may already hold a permanent event internally;
  // make sure it sees the exact same ActiveEvent array (with live
  // metadata) that the game state also exposes, otherwise makeMove's
  // subsequent setActiveEvents calls will clobber the permanent event.
  const compositeWithSetActive = ruleSet as unknown as {
    setActiveEvents?: (events: readonly ActiveEvent[]) => void;
  };
  if (typeof compositeWithSetActive.setActiveEvents === 'function') {
    compositeWithSetActive.setActiveEvents(activeEvents);
  }
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
  const [arrowFrom, setArrowFrom] = useState<Square | null>(null);

  const marchingOrdersActive = useMemo(
    () => activeEvents.some((e) => e.type === CrazyEvent.MarchingOrders),
    [activeEvents],
  );

  const handleBoardClick = useCallback(
    (sq: Square) => {
      if (diagram.activeTool === 'highlight') {
        diagram.toggleHighlight(sq);
        return;
      }
      if (diagram.activeTool === 'annotation') {
        const existing =
          typeof window !== 'undefined'
            ? window.prompt('Annotation text (leave blank to remove):', '')
            : null;
        if (existing === null) return;
        diagram.setAnnotation(sq, existing);
        return;
      }
      if (diagram.activeTool === 'arrow') {
        if (arrowFrom === null) {
          setArrowFrom(sq);
        } else if ((arrowFrom as number) === (sq as number)) {
          setArrowFrom(null);
        } else {
          diagram.addArrow(arrowFrom, sq);
          setArrowFrom(null);
        }
        return;
      }
      editor.handleSquareClick(sq);
    },
    [arrowFrom, diagram, editor],
  );

  // Reset pending arrow state when tool changes.
  const [trackedTool, setTrackedTool] = useState(diagram.activeTool);
  if (trackedTool !== diagram.activeTool) {
    setTrackedTool(diagram.activeTool);
    if (arrowFrom !== null) setArrowFrom(null);
  }

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
      // Compose: Choice mode's permanent event (if any) + user-authored
      // event toggles. Without this, Choice modes silently degrade to
      // Extra Crazy because the permanent event is only attached to the
      // ruleSet internally, never to state.activeEvents — so the very
      // first makeMove overwrites the ruleSet's currentActiveEvents and
      // the permanent event vanishes.
      const composedEvents = composeInitialActiveEvents(
        selectedModeId,
        editor.board,
        activeEvents,
      );
      const moActive = composedEvents.some(
        (e) => e.type === CrazyEvent.MarchingOrders,
      );
      const seededEvents = moActive
        ? ensureMarchingOrdersMetadata(
            composedEvents,
            editor.getMarchingOrdersGrid(),
          )
        : composedEvents;
      // When Marching Orders is active, the 64-grid itself is the source
      // of truth; its dark-square projection becomes the game's BoardState.
      const projectedBoard = moActive
        ? projectMarchingOrdersGridToBoard(editor.getMarchingOrdersGrid())
        : editor.board;
      const gs = buildInitialState(
        adapter,
        projectedBoard,
        sideToMove,
        players,
        seededEvents,
      );
      setPlayingState(gs);
      setPlayingSetup({ players, flipped, difficulty });
      setGameStartedAt(Date.now());
      setPhase('playing');
    },
    [adapter, editor, sideToMove, activeEvents, selectedModeId],
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
        onAddArrow={diagram.addArrow}
        onSetAnnotation={diagram.setAnnotation}
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
              onEditorSquareClick={handleBoardClick}
              overlays={diagram.overlays}
              svgRef={svgRef}
              pendingArrowFrom={arrowFrom}
              editorMarchingOrdersGrid={
                marchingOrdersActive ? editor.getMarchingOrdersGrid() : undefined
              }
            />
          </div>
          <EvaluationBar
            score={evaluation}
            orientation="horizontal"
            state={evaluation ? 'evaluated' : 'loading'}
            className={styles.evalBarHorizontal}
          />
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
      <fieldset className={styles.setupFieldset}>
        <legend className={styles.setupLegend}>Opponent</legend>
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
      <fieldset className={styles.setupFieldset}>
        <legend className={styles.setupLegend}>Your color</legend>
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
        <fieldset className={styles.setupFieldset}>
          <legend className={styles.setupLegend}>Difficulty</legend>
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
  readonly onAddArrow: (from: Square, to: Square) => void;
  readonly onSetAnnotation: (sq: Square, text: string) => void;
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
  onAddArrow,
  onSetAnnotation,
  onBackToEditor,
  gameStartedAt,
  svgRef,
}: FreePlayGameViewProps) {
  const [arrowFrom, setArrowFrom] = useState<Square | null>(null);
  const [trackedToolLocal, setTrackedToolLocal] = useState(activeTool);
  if (trackedToolLocal !== activeTool) {
    setTrackedToolLocal(activeTool);
    if (arrowFrom !== null) setArrowFrom(null);
  }
  const [gameState, setGameState] = useState(initialState);
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [evaluation, setEvaluation] = useState<NormalizedEvaluation | null>(null);
  const [announcementEvents, setAnnouncementEvents] = useState<readonly ActiveEvent[]>([]);
  const pendingStateRef = useRef<GameState | null>(null);

  // Animation queue — commits pending state when the sequence completes.
  const animationQueue = useAnimationQueue({
    speedMultiplier: 1.0,
    flipped: setup.flipped,
    onComplete: () => {
      if (pendingStateRef.current) {
        setGameState(pendingStateRef.current);
        pendingStateRef.current = null;
      }
    },
  });
  const eventAnimations = useEventAnimations({ flipped: setup.flipped });

  // Persistent event overlay state (event badges/markers on the board).
  const eventOverlayState = useEventOverlays(
    gameState.activeEvents,
    animationQueue.animationBoard ?? gameState.board,
    animationQueue.isAnimating ? null : selectedSquare,
    gameState.activeColor,
  );

  const displayBoard = animationQueue.animationBoard ?? gameState.board;

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

  // Live Marching Orders 64-grid derived from the current game state's
  // activeEvents metadata. Used to look up pieces on light squares during
  // play (since the 32-slot BoardState doesn't store them).
  const marchingOrdersGridForPlay = useMemo(() => {
    const mo = gameState.activeEvents.find(
      (e) => e.type === CrazyEvent.MarchingOrders,
    );
    if (!mo || !mo.metadata) return null;
    const meta = mo.metadata as {
      orthogonalGrid?: readonly (
        | { color: PieceColor; type: PieceType }
        | null
      )[];
    };
    return meta.orthogonalGrid ?? null;
  }, [gameState.activeEvents]);

  // Determine if current player is AI.
  const isAITurn = useMemo(() => {
    const active = gameState.activeColor === PieceColors.White
      ? gameState.players.white
      : gameState.players.black;
    return active === PlayerType.CpuEasy || active === PlayerType.CpuHard;
  }, [gameState]);

  // Apply a move with full animation + event-announcement pipeline.
  const applyMove = useCallback(
    (prevState: GameState, nextState: GameState) => {
      setUndoStack((prev) => [...prev, prevState]);

      const triggered = getNewlyTriggeredFreePlayEvents(
        prevState.activeEvents,
        nextState.activeEvents,
      );
      const expired = getNewlyExpiredFreePlayEvents(
        prevState.activeEvents,
        nextState.activeEvents,
      );

      if (triggered.length > 0) {
        setAnnouncementEvents((prev) =>
          prev.length > 0 ? [...prev, ...triggered] : triggered,
        );
      }

      const move = nextState.moveHistory[nextState.moveHistory.length - 1];
      if (!move) {
        setGameState(nextState);
        return;
      }

      const boardBefore = getEffectiveBoard(prevState);
      let steps: AnimationStep[] = [];

      if (triggered.length > 0) {
        steps = steps.concat(
          eventAnimations.buildActivationSequence(triggered, boardBefore, nextState.board),
        );
      }
      steps = steps.concat(buildAnimationSequence(move, boardBefore, nextState.board));

      const midMoveEvents: ActiveEvent[] = [...expired];
      for (const event of nextState.activeEvents) {
        if (event.permanent !== true) continue;
        if (midMoveEvents.includes(event)) continue;
        midMoveEvents.push(event);
      }
      if (midMoveEvents.length > 0) {
        steps = steps.concat(
          eventAnimations.buildMidMoveEffects(move, midMoveEvents, boardBefore, nextState.board),
        );
      }
      if (expired.length > 0) {
        steps = steps.concat(
          eventAnimations.buildExpirationSequence(expired, nextState.board),
        );
      }

      if (steps.length > 0) {
        pendingStateRef.current = nextState;
        animationQueue.enqueue(steps, boardBefore, prevState.activeColor);
      } else {
        setGameState(nextState);
      }
    },
    [animationQueue, eventAnimations],
  );

  // AI move loop.
  useEffect(() => {
    if (gameState.status !== GameStatus.InProgress || !isAITurn) return;
    if (animationQueue.isAnimating) return;
    if (pendingStateRef.current !== null) return;
    const state = { cancelled: false };
    void (async () => {
      try {
        const move = await requestAIMove(gameState, setup.difficulty);
        if (state.cancelled) return;
        if (gameState.status !== GameStatus.InProgress) return;
        try {
          const next = makeMove(gameState, move);
          applyMove(gameState, next);
        } catch {
          // ignore invalid moves
        }
      } catch (err) {
        console.warn('[FreePlay] AI move failed', err);
      }
    })();
    return () => { state.cancelled = true; };
  }, [gameState, isAITurn, setup.difficulty, animationQueue.isAnimating, applyMove]);

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
      if (activeTool === 'annotation') {
        const text = typeof window !== 'undefined'
          ? window.prompt('Annotation text (leave blank to remove):', '')
          : null;
        if (text === null) return;
        onSetAnnotation(sq, text);
        return;
      }
      if (activeTool === 'arrow') {
        if (arrowFrom === null) {
          setArrowFrom(sq);
        } else if ((arrowFrom as number) === (sq as number)) {
          setArrowFrom(null);
        } else {
          onAddArrow(arrowFrom, sq);
          setArrowFrom(null);
        }
        return;
      }
      if (gameState.status !== GameStatus.InProgress) return;
      if (isAITurn) return;
      if (animationQueue.isAnimating) return;

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
          const next = makeMove(gameState, best);
          applyMove(gameState, next);
        } catch (err) {
          console.warn('[FreePlay] move failed', err);
        }
        return;
      }

      // Piece lookup must consult the Marching Orders 64-grid for light
      // squares (extSq 33-64) — those pieces don't live in the 32-slot
      // BoardState. Fall back to getBoardSquare for dark squares.
      const piece =
        sqNum > 32
          ? (() => {
              const { row, col } = extSquareToGrid(sqNum);
              return marchingOrdersGridForPlay?.[row * 8 + col] ?? null;
            })()
          : getBoardSquare(gameState.board, sq);
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
      onSetAnnotation,
      onAddArrow,
      arrowFrom,
      gameState,
      isAITurn,
      selectedSquare,
      legalDestinations,
      legalMoves,
      selectablePieces,
      marchingOrdersGridForPlay,
      animationQueue.isAnimating,
      applyMove,
    ],
  );

  // Undo handler: step back one ply (pass-and-play) or two plies (vs CPU).
  const handleUndo = useCallback(() => {
    if (animationQueue.isAnimating) return;
    if (undoStack.length === 0) return;
    setAnnouncementEvents([]);
    const isCpuGame =
      gameState.players.white !== PlayerType.Human ||
      gameState.players.black !== PlayerType.Human;
    const steps = isCpuGame && undoStack.length >= 2 ? 2 : 1;
    const target = undoStack[undoStack.length - steps];
    if (!target) return;
    setGameState(target);
    setUndoStack((prev) => prev.slice(0, -steps));
    setSelectedSquare(null);
    pendingStateRef.current = null;
  }, [animationQueue.isAnimating, undoStack, gameState.players]);

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
              board={displayBoard}
              interactive={activeTool !== null || (gameState.status === GameStatus.InProgress && !isAITurn && !animationQueue.isAnimating)}
              onSquareClick={handleSquareClick}
              selectedSquare={animationQueue.isAnimating ? null : selectedSquare}
              legalMoveSquares={animationQueue.isAnimating ? undefined : legalDestinations}
              flipped={setup.flipped}
              overlays={diagramOverlays}
              svgRef={svgRef}
              pendingArrowFrom={arrowFrom}
              animatingPieces={animationQueue.animatingPieces}
              fadingSquares={animationQueue.fadingSquares}
              isAnimating={animationQueue.isAnimating}
              flashingSquares={animationQueue.flashingSquares}
              explosionState={animationQueue.explosionState}
              overlayState={animationQueue.overlayState}
              eventOverlayState={eventOverlayState}
            />
          </div>
          <EvaluationBar
            score={evaluation}
            orientation="horizontal"
            state={evaluation ? 'evaluated' : 'loading'}
            className={styles.evalBarHorizontal}
          />
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

        <aside className={styles.sidePanel}>
          {(gameState.mode === GameMode.Crazy ||
            gameState.mode === GameMode.Chaos ||
            gameState.mode === GameMode.Choice) && (
            <ActiveEventsIndicator
              activeEvents={gameState.activeEvents}
              activeColor={gameState.activeColor}
            />
          )}
          <MoveTimeline
            moves={movesAsNotation}
            currentPly={movesAsNotation.length}
            onPlySelect={() => { /* Not navigable during live play */ }}
          />
          <div className={styles.freePlayActions}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleUndo}
              disabled={undoStack.length === 0 || animationQueue.isAnimating}
              data-testid="freeplay-undo"
              aria-label="Undo last move"
            >
              Undo
            </button>
          </div>
          {gameState.status === GameStatus.GameOver && gameState.result && (
            <div
              className={styles.gameOverCard}
              role="status"
              aria-live="polite"
              data-testid="freeplay-game-over"
            >
              <strong>Game Over</strong>
              <span>
                {formatFreePlayResult(gameState.result.type)}
                {` \u2014 ${gameState.result.reason.toLowerCase()}`}
              </span>
              <p className={styles.gameOverHint}>
                Use Undo to revisit earlier moves, or go back to the editor to try a new position.
              </p>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleUndo}
                disabled={undoStack.length === 0 || animationQueue.isAnimating}
              >
                Undo Last Move
              </button>
            </div>
          )}
        </aside>
      </div>

      {announcementEvents.length > 0 && (
        <EventAnnouncement
          events={announcementEvents}
          isAnimating={animationQueue.isAnimating}
          onDismiss={() => { setAnnouncementEvents([]); }}
        />
      )}
    </div>
  );
}
