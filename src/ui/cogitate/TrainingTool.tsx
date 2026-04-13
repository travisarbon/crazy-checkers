/**
 * TrainingTool — Cogitate Training tool (Task 21.4).
 *
 * Three-phase tool: source selection → training session (playing/feedback) →
 * summary. Loads training positions that the Analysis tool extracted from
 * completed games, lets the player attempt each position interactively, and
 * compares the result against the engine's recommendation.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Move, PieceColor, Square } from '../../engine/types';
import { getBoardSquare } from '../../engine/board';
import { getAdapter } from '../../cogitate/CogitateGameAdapter';
import '../../cogitate/adapters/registerAll';
import {
  loadTrainingPositions,
  type TrainingPosition,
} from '../../cogitate/trainingEngine';
import { getAllGameRecords } from '../../persistence/gameHistory';
import type { GameRecord } from '../../persistence/gameHistory';
import type { NormalizedEvaluation } from '../../cogitate/types';
import CogitateBoard from '../CogitateBoard';
import EvaluationBar from '../EvaluationBar';
import GameHistoryBrowser from '../GameHistoryBrowser';
import { useEventOverlays } from '../useEventOverlays';
import ActiveEventsIndicator from './ActiveEventsIndicator';
import TrainingProgressBar from './TrainingProgressBar';
import TrainingFeedback from './TrainingFeedback';
import { useTrainingSession } from './useTrainingSession';
import CogitateToolHeader from './CogitateToolHeader';
import styles from './TrainingTool.module.css';

export interface TrainingToolProps {
  readonly onBack: () => void;
  readonly initialGameId?: string;
}

type ToolPhase = 'select' | 'training';

async function loadTrainingEligibleGames(): Promise<GameRecord[]> {
  const all = await getAllGameRecords();
  return all.filter(
    (g) => g.trainingPositions !== undefined && g.trainingPositions.length > 0,
  );
}

export default function TrainingTool({
  onBack,
  initialGameId,
}: TrainingToolProps) {
  const [toolPhase, setToolPhase] = useState<ToolPhase>('select');
  const [positions, setPositions] = useState<TrainingPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPositionsFor = useCallback(async (gameId?: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const loaded = await loadTrainingPositions(
        {
          ...(gameId ? { gameId } : {}),
        },
        getAdapter,
      );
      if (loaded.length === 0) {
        setLoadError('No training positions found for this selection.');
        setPositions([]);
        return;
      }
      setPositions(loaded);
      setToolPhase('training');
    } catch (err) {
      console.warn('[Training] Failed to load positions:', err);
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load training positions.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialGameId) {
      void loadPositionsFor(initialGameId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGameId]);

  const handleBackToSelect = useCallback(() => {
    setToolPhase('select');
    setPositions([]);
  }, []);

  if (toolPhase === 'select') {
    return (
      <div className={styles.root} data-testid="training-tool" data-phase="select">
        <CogitateToolHeader
          title="Training — choose a source"
          onBack={onBack}
          backLabel="Back"
          backTestId="training-back-to-home"
          onHome={onBack}
          homeTestId="training-select-home-shortcut"
          headerClassName={styles.selectHeader}
          backButtonClassName={styles.backButton}
          titleClassName={styles.title}
          homeLinkClassName={styles.homeLink}
        />

        <div className={styles.actionBar}>
          <button
            type="button"
            className={[styles.actionButton, styles.actionPrimary].filter(Boolean).join(' ')}
            onClick={() => {
              void loadPositionsFor();
            }}
            disabled={isLoading}
            data-testid="training-train-all"
          >
            {isLoading ? 'Loading…' : 'Train All'}
          </button>
        </div>

        {loadError && (
          <p className={styles.error} role="alert" data-testid="training-selection-error">
            {loadError}
          </p>
        )}

        <div className={styles.selectBody}>
          <GameHistoryBrowser
            onSelectGame={(game) => {
              void loadPositionsFor(game.id);
            }}
            selectedGameId={null}
            loadGames={loadTrainingEligibleGames}
          />
        </div>
      </div>
    );
  }

  return (
    <TrainingSession
      positions={positions}
      onBackToSelect={handleBackToSelect}
      onBackToHome={onBack}
    />
  );
}

// ---------------------------------------------------------------------------
// TrainingSession (active training view)
// ---------------------------------------------------------------------------

interface TrainingSessionProps {
  readonly positions: readonly TrainingPosition[];
  readonly onBackToSelect: () => void;
  readonly onBackToHome: () => void;
}

function TrainingSession({
  positions,
  onBackToSelect,
  onBackToHome,
}: TrainingSessionProps) {
  const session = useTrainingSession({
    positions,
    getAdapter,
  });

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset selection when the position or phase changes (state-setter-during-render
  // pattern to avoid a follow-up setState effect).
  const selectionKey = `${String(session.currentIndex)}:${session.phase}`;
  const [trackedSelectionKey, setTrackedSelectionKey] = useState(selectionKey);
  if (trackedSelectionKey !== selectionKey) {
    setTrackedSelectionKey(selectionKey);
    if (selectedSquare !== null) setSelectedSquare(null);
  }

  const currentPosition = session.currentPosition;

  const legalMoves = useMemo<Move[]>(() => {
    if (!currentPosition) return [];
    return currentPosition.ruleSet.getLegalMoves(
      currentPosition.board,
      currentPosition.activeColor,
    );
  }, [currentPosition]);

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

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (!currentPosition) return;
      if (session.phase !== 'playing' || session.isEvaluating) return;

      const sqNum = sq as number;
      if (selectedSquare !== null && legalDestinations.has(sqNum)) {
        // Find all moves starting at source with first hop to sq; prefer the
        // longest capture sequence for branching multi-jumps.
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
        void session.submitMove(best);
        return;
      }

      // Select a piece belonging to the active color with legal moves.
      const piece = getBoardSquare(currentPosition.board, sq);
      if (
        piece !== null &&
        piece.color === currentPosition.activeColor &&
        selectablePieces.has(sqNum)
      ) {
        setSelectedSquare(sq);
        return;
      }

      setSelectedSquare(null);
    },
    [
      currentPosition,
      legalDestinations,
      legalMoves,
      selectablePieces,
      selectedSquare,
      session,
    ],
  );

  const eventOverlayState = useEventOverlays(
    currentPosition?.activeEvents ?? [],
    currentPosition?.board ?? (new Array(32).fill(null) as never),
    selectedSquare,
    currentPosition?.activeColor,
  );

  const evalForBar = useMemo<NormalizedEvaluation | null>(() => {
    if (!currentPosition) return null;
    const analysis = currentPosition.analysisResult;
    const whiteOriented: PieceColor = currentPosition.activeColor;
    const score =
      whiteOriented === 'WHITE' ? analysis.evaluation : -analysis.evaluation;
    return {
      score,
      rawScore: analysis.rawScore,
      isTerminal: false,
      confidence: 1,
    };
  }, [currentPosition]);

  // Keyboard shortcut: Enter / ArrowRight advances during feedback.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement
      ) {
        return;
      }
      if (session.phase === 'feedback' && (e.key === 'Enter' || e.key === 'ArrowRight')) {
        session.nextPosition();
        e.preventDefault();
      }
    }
    node.addEventListener('keydown', handleKeyDown);
    return () => { node.removeEventListener('keydown', handleKeyDown); };
  }, [session]);

  const announcement = useMemo(() => {
    if (session.phase === 'feedback' && session.attemptResult) {
      const r = session.attemptResult;
      if (r.isCorrect) {
        return `Correct! You found the best move ${r.bestMoveNotation}.`;
      }
      if (r.isAcceptable) {
        return `Good enough. Your move ${r.playerMoveNotation} was close. The best move was ${r.bestMoveNotation}.`;
      }
      return `Not quite. The best move was ${r.bestMoveNotation}. Your move ${r.playerMoveNotation} lost ${r.evalDifference.toFixed(2)} evaluation.`;
    }
    if (currentPosition) {
      const color = currentPosition.activeColor === 'WHITE' ? 'White' : 'Black';
      return `Position ${String(session.currentIndex + 1)} of ${String(positions.length)}. ${color} to move. ${String(legalMoves.length)} legal moves available.`;
    }
    return '';
  }, [currentPosition, legalMoves.length, positions.length, session.attemptResult, session.currentIndex, session.phase]);

  if (session.isSessionComplete) {
    const { stats } = session;
    const attempted = stats.completedPositions;
    const incorrectCount = Math.max(0, attempted - stats.acceptableCount);
    return (
      <div
        className={styles.root}
        data-testid="training-tool"
        data-phase="summary"
      >
        <CogitateToolHeader
          title="Training Session Complete"
          onBack={onBackToSelect}
          backLabel="Sources"
          backTestId="training-back-from-summary"
          headerClassName={styles.trainingHeader}
          backButtonClassName={styles.backButton}
          titleClassName={styles.title}
        />
        <div className={styles.summary} data-testid="training-summary">
          <div className={styles.summaryStat}>
            <span>Positions attempted</span>
            <strong>{String(attempted)} / {String(stats.totalPositions)}</strong>
          </div>
          <div className={styles.summaryStat}>
            <span>Correct (best move)</span>
            <strong data-testid="training-summary-correct">
              {String(stats.correctCount)} ({String(attempted > 0 ? Math.round((stats.correctCount / attempted) * 100) : 0)}%)
            </strong>
          </div>
          <div className={styles.summaryStat}>
            <span>Acceptable</span>
            <strong>
              {String(Math.max(0, stats.acceptableCount - stats.correctCount))}
            </strong>
          </div>
          <div className={styles.summaryStat}>
            <span>Incorrect</span>
            <strong>{String(incorrectCount)}</strong>
          </div>
          <div className={styles.summaryStat}>
            <span>Best streak</span>
            <strong>{String(stats.bestStreak)}</strong>
          </div>
          <div className={styles.summaryActions}>
            <button
              type="button"
              className={[styles.actionButton, styles.actionPrimary].filter(Boolean).join(' ')}
              onClick={() => { session.restartSession(); }}
              data-testid="training-train-again"
            >
              Train Again
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={onBackToHome}
              data-testid="training-back-to-cogitate"
            >
              Back to Cogitate
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentPosition) {
    return (
      <div className={styles.root} data-testid="training-tool" data-phase="training">
        <p className={styles.loading}>Loading position…</p>
      </div>
    );
  }

  const modeId = currentPosition.modeId;
  const showEvents = currentPosition.serializedEvents.length > 0;

  return (
    <div
      className={styles.root}
      data-testid="training-tool"
      data-phase="training"
      ref={containerRef}
      tabIndex={-1}
    >
      <CogitateToolHeader
        title="Training"
        onBack={onBackToSelect}
        backLabel="Sources"
        backTestId="training-back-to-select"
        onHome={onBackToHome}
        homeTestId="training-back-to-cogitate-home"
        headerClassName={styles.trainingHeader}
        backButtonClassName={styles.backButton}
        titleClassName={styles.title}
        homeLinkClassName={styles.homeLink}
      />

      <div className={styles.layout}>
        <div className={styles.boardPanel}>
          <div className={styles.boardArea}>
            <EvaluationBar
              score={evalForBar}
              orientation="vertical"
              state={evalForBar ? 'evaluated' : 'unavailable'}
              className={styles.evalBarVertical}
            />
            <CogitateBoard
              board={currentPosition.board}
              interactive={session.phase === 'playing' && !session.isEvaluating}
              onSquareClick={handleSquareClick}
              selectedSquare={selectedSquare}
              legalMoveSquares={legalDestinations}
              eventOverlayState={eventOverlayState}
            />
          </div>
          <EvaluationBar
            score={evalForBar}
            orientation="horizontal"
            state={evalForBar ? 'evaluated' : 'unavailable'}
            className={styles.evalBarHorizontal}
          />
          {showEvents && (
            <ActiveEventsIndicator
              events={currentPosition.serializedEvents}
              gameMode={modeId}
            />
          )}
        </div>

        <aside className={styles.sidePanel}>
          <TrainingProgressBar
            stats={session.stats}
            results={session.attemptResults}
            skippedIndexes={session.skippedIndexes}
            currentIndex={session.currentIndex}
          />

          {session.phase === 'playing' ? (
            <div
              className={styles.contextPanel}
              data-testid="training-context-panel"
            >
              <span className={styles.contextLabel}>Game:</span>
              <span>{currentPosition.gameLabel}</span>
              <span>
                Move {String(currentPosition.moveNumber)} · {currentPosition.activeColor === 'WHITE' ? 'White' : 'Black'} to move
              </span>
              <span>
                Original play: {currentPosition.originalMoveQuality ?? '—'} (eval drop {currentPosition.originalEvalDrop.toFixed(2)})
              </span>
              {session.isEvaluating && (
                <span className={styles.evaluating} data-testid="training-evaluating">
                  Evaluating your move…
                </span>
              )}
              {session.evaluationError && (
                <span className={styles.error} data-testid="training-evaluation-error">
                  {session.evaluationError}
                </span>
              )}
            </div>
          ) : (
            session.attemptResult && (
              <TrainingFeedback
                result={session.attemptResult}
                position={currentPosition}
                positionIndex={session.currentIndex}
              />
            )
          )}
        </aside>
      </div>

      <div className={styles.actionBar} role="toolbar" aria-label="Training controls">
        {session.phase === 'playing' ? (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => {
              session.skipCurrent();
            }}
            data-testid="training-skip"
            disabled={session.isEvaluating}
          >
            Skip
          </button>
        ) : (
          <button
            type="button"
            className={[styles.actionButton, styles.actionPrimary].filter(Boolean).join(' ')}
            onClick={() => {
              session.nextPosition();
            }}
            data-testid="training-next"
          >
            {session.hasNext ? 'Next ▶' : 'Finish'}
          </button>
        )}
      </div>

      <div
        className={styles.liveRegion}
        role="status"
        aria-live="assertive"
        data-testid="training-live-region"
      >
        {announcement}
      </div>
    </div>
  );
}

