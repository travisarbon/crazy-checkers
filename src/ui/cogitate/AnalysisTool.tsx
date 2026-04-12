/**
 * AnalysisTool — second Cogitate tool (Task 21.3).
 *
 * Reuses the Replay two-phase structure (select → analyze) plus a progressive
 * analysis pipeline, move-quality indicators, quality summary bar, and a
 * per-move detail panel.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { GameRecord } from '../../persistence/gameHistory';
import { getGameRecord } from '../../persistence/gameHistory';
import { resolveGameRecord } from '../../persistence/gameModeRegistry';
import {
  getAdapter,
  type CogitateGameAdapter,
} from '../../cogitate/CogitateGameAdapter';
import '../../cogitate/adapters/registerAll';
import {
  analyzeGame,
  loadCachedAnalysis,
  persistAnalysis,
  type AnalysisStatus,
  type AnalysisSummary,
} from '../../cogitate/analysisEngine';
import {
  ANALYSIS_SEARCH_CONFIG,
  DEEP_ANALYSIS_SEARCH_CONFIG,
  type AnalysisResult,
  type MoveQuality,
  type NormalizedEvaluation,
} from '../../cogitate/types';
import {
  cancelAnalysis as cancelWorkerAnalysis,
  requestAnalysis as defaultRequestAnalysis,
} from '../../ai/workerClient';
import { PieceColor } from '../../engine/types';
import { formatPlayerLabel } from '../../utils/formatting';
import CogitateBoard from '../CogitateBoard';
import EvaluationBar, { formatEvaluationScore } from '../EvaluationBar';
import MoveTimeline from '../MoveTimeline';
import GameHistoryBrowser from '../GameHistoryBrowser';
import { useEventOverlays } from '../useEventOverlays';
import ActiveEventsIndicator from './ActiveEventsIndicator';
import { useReplayNavigation } from './useReplayNavigation';
import AnalysisDetailPanel from './AnalysisDetailPanel';
import QualitySummaryBar from './QualitySummaryBar';
import styles from './AnalysisTool.module.css';

export interface AnalysisToolProps {
  readonly onBack: () => void;
  readonly initialGameId?: string;
}

type Phase =
  | { readonly kind: 'select' }
  | {
      readonly kind: 'analysis';
      readonly game: GameRecord;
      readonly adapter: CogitateGameAdapter;
    };

export default function AnalysisTool({ onBack, initialGameId }: AnalysisToolProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'select' });
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!initialGameId) return;
    cancelledRef.current = false;
    void (async () => {
      try {
        const record = await getGameRecord(initialGameId);
        if (cancelledRef.current || !record) return;
        const entry = resolveGameRecord(record);
        const adapter = getAdapter(entry.id);
        if (!adapter) {
          setSelectionError(`Analysis is not yet available for mode: ${entry.displayName}`);
          return;
        }
        setPhase({ kind: 'analysis', game: record, adapter });
      } catch (err) {
        console.warn('[Analysis] Failed to load initial game:', err);
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, [initialGameId]);

  const handleSelectGame = useCallback((game: GameRecord) => {
    const entry = resolveGameRecord(game);
    const adapter = getAdapter(entry.id);
    if (!adapter) {
      setSelectionError(`Analysis is not yet available for mode: ${entry.displayName}`);
      return;
    }
    setSelectionError(null);
    setPhase({ kind: 'analysis', game, adapter });
  }, []);

  const handleBackToSelect = useCallback(() => {
    setPhase({ kind: 'select' });
    setSelectionError(null);
  }, []);

  if (phase.kind === 'select') {
    return (
      <div className={styles.root} data-testid="analysis-tool">
        <header className={styles.selectHeader}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
            data-testid="analysis-back-to-home"
          >
            &larr; Back
          </button>
          <h2 className={styles.title}>Select a game to analyze</h2>
        </header>
        {selectionError && (
          <p className={styles.error} role="alert" data-testid="analysis-selection-error">
            {selectionError}
          </p>
        )}
        <div className={styles.selectBody}>
          <GameHistoryBrowser
            onSelectGame={handleSelectGame}
            selectedGameId={null}
          />
        </div>
      </div>
    );
  }

  return (
    <AnalysisView
      key={phase.game.id}
      game={phase.game}
      adapter={phase.adapter}
      onBackToSelect={handleBackToSelect}
      onBackToHome={onBack}
    />
  );
}

// ---------------------------------------------------------------------------
// AnalysisView
// ---------------------------------------------------------------------------

interface AnalysisViewProps {
  readonly game: GameRecord;
  readonly adapter: CogitateGameAdapter;
  readonly onBackToSelect: () => void;
  readonly onBackToHome: () => void;
}

type MobileTab = 'moves' | 'analysis';

function computePartialSummary(
  results: readonly (AnalysisResult | null)[],
): AnalysisSummary {
  let brilliantCount = 0;
  let goodCount = 0;
  let inaccuracyCount = 0;
  let mistakeCount = 0;
  let blunderCount = 0;
  let totalDrop = 0;
  let classifiedCount = 0;
  for (const r of results) {
    if (!r?.moveQuality) continue;
    classifiedCount += 1;
    totalDrop += r.evalDrop ?? 0;
    switch (r.moveQuality) {
      case 'brilliant': brilliantCount += 1; break;
      case 'good': goodCount += 1; break;
      case 'inaccuracy': inaccuracyCount += 1; break;
      case 'mistake': mistakeCount += 1; break;
      case 'blunder': blunderCount += 1; break;
    }
  }
  const penalty = inaccuracyCount * 5 + mistakeCount * 15 + blunderCount * 30;
  const bonus = brilliantCount * 5;
  const qualityScore = Math.max(0, Math.min(100, 100 - penalty + bonus));
  return {
    totalMoves: results.length,
    brilliantCount,
    goodCount,
    inaccuracyCount,
    mistakeCount,
    blunderCount,
    averageEvalDrop: classifiedCount === 0 ? 0 : totalDrop / classifiedCount,
    qualityScore,
  };
}

function AnalysisView({
  game,
  adapter,
  onBackToSelect,
  onBackToHome,
}: AnalysisViewProps) {
  const totalPlies = game.moves.length;
  const nav = useReplayNavigation({ game, adapter, totalPlies });

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [results, setResults] = useState<(AnalysisResult | null)[]>(() =>
    new Array<AnalysisResult | null>(totalPlies).fill(null),
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>('moves');
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const modeDisplayName = resolveGameRecord(game).displayName;

  // Load cached analysis on mount; otherwise start analysis.
  useEffect(() => {
    const cancelledRef = { current: false };
    const cached = loadCachedAnalysis(game);
    if (cached) {
      setResults([...cached.results]);
      setAnalysisStatus('complete');
      setAnalysisProgress(1);
      return () => {
        cancelledRef.current = true;
      };
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setAnalysisStatus('running');
    setAnalysisProgress(0);

    void (async () => {
      try {
        const analysis = await analyzeGame(
          game,
          adapter,
          ANALYSIS_SEARCH_CONFIG,
          (ply, result, progress) => {
            if (cancelledRef.current) return;
            setResults((prev) => {
              const next = [...prev];
              next[ply] = result;
              return next;
            });
            setAnalysisProgress(progress);
          },
          { signal: controller.signal },
        );
        if (cancelledRef.current) return;
        setAnalysisStatus(analysis.status);
        if (analysis.status === 'complete') {
          void persistAnalysis(game.id, analysis);
        }
      } catch (err) {
        console.warn('[Analysis] analyzeGame failed:', err);
        if (!cancelledRef.current) setAnalysisStatus('cancelled');
      }
    })();

    return () => {
      cancelledRef.current = true;
      controller.abort();
      cancelWorkerAnalysis();
      abortRef.current = null;
    };
  }, [game, adapter]);

  // Keyboard shortcuts.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      switch (e.key) {
        case 'ArrowLeft': nav.goBack(); e.preventDefault(); break;
        case 'ArrowRight': nav.goForward(); e.preventDefault(); break;
        case 'Home': nav.goToFirst(); e.preventDefault(); break;
        case 'End': nav.goToLast(); e.preventDefault(); break;
        case ' ': nav.toggleAutoPlay(); e.preventDefault(); break;
      }
    }
    node.addEventListener('keydown', handleKeyDown);
    return () => { node.removeEventListener('keydown', handleKeyDown); };
  }, [nav]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < 50) return;
      if (Math.abs(dy) > 30) return;
      if (dx > 0) nav.goBack();
      else nav.goForward();
    },
    [nav],
  );

  const overlayState = useEventOverlays(
    nav.currentDeserializedEvents,
    nav.currentBoard,
    null,
  );

  const qualities = useMemo<(MoveQuality | null)[]>(() => {
    return results.map((r) => r?.moveQuality ?? null);
  }, [results]);

  const summary = useMemo(() => computePartialSummary(results), [results]);

  // The "current move" analysis is the one that produced the current ply's
  // position — i.e., ply index `nav.currentPly - 1` (0 => starting position).
  const selectedPlyIndex = Math.max(0, nav.currentPly - 1);
  const selectedResult = nav.currentPly === 0 ? null : (results[selectedPlyIndex] ?? null);
  const playedMoveNotation = nav.currentPly === 0 ? '' : (game.moves[selectedPlyIndex] ?? '');

  // Eval bar: prefer analysis evaluation for the position (results[ply] is
  // the analysis of ply P → position AT ply P from ply P's side). Fall back to
  // hook-provided lazy eval.
  const analysisEval = useMemo<NormalizedEvaluation | null>(() => {
    const r = results[nav.currentPly];
    if (!r) return null;
    const sideToMoveIsWhite = nav.currentPly % 2 === 0;
    const whiteOrientedScore = sideToMoveIsWhite ? r.evaluation : -r.evaluation;
    return {
      score: whiteOrientedScore,
      rawScore: r.rawScore,
      isTerminal: false,
      confidence: 1,
    };
  }, [results, nav.currentPly]);

  // Normalize nav.currentEval to white-oriented for consistency.
  const hookEval = useMemo<NormalizedEvaluation | null>(() => {
    if (!nav.currentEval) return null;
    const sideToMoveIsWhite = nav.currentPly % 2 === 0;
    return sideToMoveIsWhite
      ? nav.currentEval
      : { ...nav.currentEval, score: -nav.currentEval.score };
  }, [nav.currentEval, nav.currentPly]);

  const displayedEval = analysisEval ?? hookEval;
  const evalState = displayedEval ? 'evaluated' : (nav.evalLoading ? 'loading' : 'unavailable');

  const currentNotation =
    nav.currentPly === 0
      ? 'Starting position'
      : `${String(Math.floor((nav.currentPly - 1) / 2) + 1)}. ${game.moves[nav.currentPly - 1] ?? ''}`;

  const showEvents = game.activeEventsPerPly !== undefined && adapter.modeId !== 'classic';

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    cancelWorkerAnalysis();
    setAnalysisStatus('cancelled');
  }, []);

  const handleDeepAnalyze = useCallback(() => {
    if (nav.currentPly === 0) return;
    const ply = selectedPlyIndex;
    const snapshot = game.boardStates[ply];
    if (snapshot === undefined) return;
    const board = adapter.getBoard(snapshot);
    const events = game.activeEventsPerPly?.[ply] ?? [];
    const color = ply % 2 === 0 ? PieceColor.White : PieceColor.Black;
    setDeepAnalyzing(true);
    void (async () => {
      try {
        const deep = await defaultRequestAnalysis(
          board,
          color,
          adapter.modeId,
          events,
          DEEP_ANALYSIS_SEARCH_CONFIG,
        );
        setResults((prev) => {
          const next = [...prev];
          const existing = prev[ply];
          next[ply] = {
            ...deep,
            evalDrop: existing?.evalDrop,
            moveQuality: existing?.moveQuality,
          };
          return next;
        });
      } catch (err) {
        console.warn('[Analysis] Deep analysis failed:', err);
      } finally {
        setDeepAnalyzing(false);
      }
    })();
  }, [adapter, game.activeEventsPerPly, game.boardStates, nav.currentPly, selectedPlyIndex]);

  const announcement = useMemo(() => {
    if (nav.currentPly === 0) return 'Starting position.';
    const r = results[selectedPlyIndex];
    const notation = game.moves[selectedPlyIndex] ?? '';
    if (!r) return `Move ${String(nav.currentPly)}: ${notation}. Analyzing.`;
    const quality = r.moveQuality ? `Classified as ${r.moveQuality}.` : '';
    const evalText = `Evaluation: ${formatEvaluationScore(r.evaluation)}.`;
    return `Move ${String(nav.currentPly)}: ${notation}. ${quality} ${evalText}`;
  }, [game.moves, nav.currentPly, results, selectedPlyIndex]);

  return (
    <div
      className={styles.root}
      data-testid="analysis-tool"
      data-phase="analysis"
      ref={containerRef}
      tabIndex={-1}
    >
      <header className={styles.replayHeader}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBackToSelect}
          data-testid="analysis-back-to-select"
        >
          &larr; Games
        </button>
        <h2 className={styles.title}>
          Analysis: {modeDisplayName} — {formatPlayerLabel(game.playerWhite)} vs {formatPlayerLabel(game.playerBlack)}
        </h2>
        <button
          type="button"
          className={styles.homeLink}
          onClick={onBackToHome}
          data-testid="analysis-back-to-cogitate-home"
        >
          Cogitate home
        </button>
      </header>

      <div className={styles.layout}>
        <div className={styles.boardPanel}>
          <div
            className={styles.boardArea}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <EvaluationBar
              score={displayedEval}
              orientation="vertical"
              state={evalState}
              className={styles.evalBarVertical}
            />
            <CogitateBoard
              board={nav.currentBoard}
              interactive={false}
              eventOverlayState={overlayState}
            />
          </div>
          <EvaluationBar
            score={displayedEval}
            orientation="horizontal"
            state={evalState}
            className={styles.evalBarHorizontal}
          />
          {showEvents && (
            <ActiveEventsIndicator
              events={nav.currentEvents}
              gameMode={adapter.modeId}
            />
          )}
        </div>

        <aside className={styles.sidePanel}>
          <div className={styles.summaryRow} data-testid="analysis-quality-summary">
            {analysisStatus === 'running' && (
              <div
                className={styles.progressBar}
                role="progressbar"
                aria-label="Analysis progress"
                aria-valuenow={Math.round(analysisProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                data-testid="analysis-progress-bar"
              >
                <div
                  className={styles.progressFill}
                  style={{ width: `${String(Math.round(analysisProgress * 100))}%` }}
                />
              </div>
            )}
            <QualitySummaryBar
              qualities={qualities}
              qualityScore={analysisStatus === 'complete' ? summary.qualityScore : undefined}
              selectedPly={selectedPlyIndex}
              onPlySelect={(ply) => { nav.goToPly(ply + 1); }}
            />
          </div>

          <p className={styles.statusText} data-testid="analysis-status-text">
            {analysisStatus === 'running' && (
              `Analyzing: ${String(Math.round(analysisProgress * Math.max(1, totalPlies)))} of ${String(totalPlies)} (${String(Math.round(analysisProgress * 100))}%)`
            )}
            {analysisStatus === 'complete' && (
              `Analysis complete. Quality score: ${String(summary.qualityScore)}/100.`
            )}
            {analysisStatus === 'cancelled' && 'Analysis cancelled. Partial results shown.'}
            {analysisStatus === 'idle' && 'Waiting…'}
          </p>

          <div className={styles.mobileTabs} role="tablist" aria-label="Analysis panels">
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'moves'}
              className={[styles.tabButton, mobileTab === 'moves' ? styles.tabActive : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => { setMobileTab('moves'); }}
              data-testid="analysis-tab-moves"
            >
              Moves
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'analysis'}
              className={[styles.tabButton, mobileTab === 'analysis' ? styles.tabActive : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => { setMobileTab('analysis'); }}
              data-testid="analysis-tab-analysis"
            >
              Analysis
            </button>
          </div>

          <div
            className={[styles.mobilePanel, mobileTab === 'moves' ? styles.panelActive : '']
              .filter(Boolean)
              .join(' ')}
            data-testid="analysis-panel-moves"
          >
            <MoveTimeline
              moves={game.moves}
              currentPly={nav.currentPly - 1}
              moveQualities={qualities}
              onPlySelect={(ply) => { nav.goToPly(ply + 1); }}
            />
          </div>
          <div
            className={[styles.mobilePanel, mobileTab === 'analysis' ? styles.panelActive : '']
              .filter(Boolean)
              .join(' ')}
            data-testid="analysis-panel-analysis"
          >
            <AnalysisDetailPanel
              result={selectedResult}
              plyIndex={selectedPlyIndex}
              playedMoveNotation={playedMoveNotation}
              isAnalyzing={analysisStatus === 'running' && selectedResult === null}
              onDeepAnalyze={handleDeepAnalyze}
              deepAnalyzeAvailable={!deepAnalyzing && nav.currentPly > 0}
            />
          </div>
        </aside>
      </div>

      <div
        className={styles.transportBar}
        role="toolbar"
        aria-label="Analysis controls"
        data-testid="analysis-transport-bar"
      >
        <TransportButton
          label="First move"
          icon="⏮"
          testId="analysis-first"
          disabled={nav.currentPly === 0}
          onClick={nav.goToFirst}
        />
        <TransportButton
          label="Previous move"
          icon="◀"
          testId="analysis-back"
          disabled={nav.currentPly === 0}
          onClick={nav.goBack}
        />
        <span
          className={styles.plyReadout}
          data-testid="analysis-ply-readout"
          aria-live="off"
        >
          {currentNotation}
        </span>
        <TransportButton
          label="Next move"
          icon="▶"
          testId="analysis-forward"
          disabled={nav.currentPly === totalPlies}
          onClick={nav.goForward}
        />
        <TransportButton
          label="Last move"
          icon="⏭"
          testId="analysis-last"
          disabled={nav.currentPly === totalPlies}
          onClick={nav.goToLast}
        />
        <TransportButton
          label={nav.isAutoPlaying ? 'Pause autoplay' : 'Play autoplay'}
          icon={nav.isAutoPlaying ? '⏸' : '▶'}
          testId="analysis-autoplay"
          disabled={false}
          onClick={nav.toggleAutoPlay}
          pressed={nav.isAutoPlaying}
        />
        {analysisStatus === 'running' && (
          <button
            type="button"
            className={styles.stopButton}
            onClick={handleStop}
            data-testid="analysis-stop"
          >
            Stop
          </button>
        )}
      </div>

      <div
        className={styles.liveRegion}
        role="status"
        aria-live="polite"
        data-testid="analysis-live-region"
      >
        {announcement}
      </div>
    </div>
  );
}

interface TransportButtonProps {
  readonly label: string;
  readonly icon: string;
  readonly testId: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly pressed?: boolean;
}

function TransportButton({
  label,
  icon,
  testId,
  disabled,
  onClick,
  pressed,
}: TransportButtonProps) {
  return (
    <button
      type="button"
      className={styles.transportButton}
      aria-label={label}
      aria-pressed={pressed !== undefined ? pressed : undefined}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
