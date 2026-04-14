/**
 * ReplayTool — first user-facing Cogitate tool.
 *
 * Two-phase architecture:
 *   Phase 1 ("select"): browse completed games via GameHistoryBrowser.
 *   Phase 2 ("replay"): step through the selected game move-by-move with an
 *                       evaluation bar, move timeline, transport controls,
 *                       and active-event indicators.
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
import CogitateBoard from '../CogitateBoard';
import EvaluationBar from '../EvaluationBar';
import MoveTimeline from '../MoveTimeline';
import GameHistoryBrowser from '../GameHistoryBrowser';
import { useEventOverlays } from '../useEventOverlays';
import ActiveEventsIndicator from './ActiveEventsIndicator';
import CogitateToolHeader from './CogitateToolHeader';
import { useToolbarNavigation } from '../hooks/useToolbarNavigation';
import { useReplayNavigation } from './useReplayNavigation';
import { formatEvaluationScore } from '../EvaluationBar';
import { formatPlayerLabel } from '../../utils/formatting';
import styles from './ReplayTool.module.css';

export interface ReplayToolProps {
  readonly onBack: () => void;
  readonly initialGameId?: string;
}

type Phase =
  | { readonly kind: 'select' }
  | { readonly kind: 'replay'; readonly game: GameRecord; readonly adapter: CogitateGameAdapter };

function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${String(diffMin)} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${String(diffHr)} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${String(diffDay)} days ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatResult(record: GameRecord): string {
  switch (record.result) {
    case 'WHITE_WIN': return 'White wins';
    case 'BLACK_WIN': return 'Black wins';
    case 'DRAW': return 'Draw';
    default: return record.result;
  }
}

// ---------------------------------------------------------------------------
// ReplayTool component
// ---------------------------------------------------------------------------

export default function ReplayTool({ onBack, initialGameId }: ReplayToolProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'select' });
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const cancelledRef = useRef(false);

  // Load initialGameId on mount if provided.
  useEffect(() => {
    if (!initialGameId) return;
    cancelledRef.current = false;
    void (async () => {
      try {
        const record = await getGameRecord(initialGameId);
        if (cancelledRef.current) return;
        if (!record) return;
        const entry = resolveGameRecord(record);
        const adapter = getAdapter(entry.id);
        if (!adapter) {
          setSelectionError(`Replay is not yet available for mode: ${entry.displayName}`);
          return;
        }
        setPhase({ kind: 'replay', game: record, adapter });
      } catch (err) {
        console.warn('[Replay] Failed to load initial game:', err);
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
      setSelectionError(`Replay is not yet available for mode: ${entry.displayName}`);
      return;
    }
    setSelectionError(null);
    setPhase({ kind: 'replay', game, adapter });
  }, []);

  const handleBackToSelect = useCallback(() => {
    setPhase({ kind: 'select' });
    setSelectionError(null);
  }, []);

  if (phase.kind === 'select') {
    return (
      <div className={styles.root} data-testid="replay-tool">
        <CogitateToolHeader
          title="Select a game to replay"
          onBack={onBack}
          backLabel="Back"
          backTestId="replay-back-to-home"
          headerClassName={styles.selectHeader}
          backButtonClassName={styles.backButton}
          titleClassName={styles.title}
        />
        {selectionError && (
          <p className={styles.error} role="alert" data-testid="replay-selection-error">
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
    <ReplayView
      key={phase.game.id}
      game={phase.game}
      adapter={phase.adapter}
      onBackToSelect={handleBackToSelect}
      onBackToHome={onBack}
    />
  );
}

// ---------------------------------------------------------------------------
// Replay view
// ---------------------------------------------------------------------------

interface ReplayViewProps {
  readonly game: GameRecord;
  readonly adapter: CogitateGameAdapter;
  readonly onBackToSelect: () => void;
  readonly onBackToHome: () => void;
}

function ReplayView({ game, adapter, onBackToSelect, onBackToHome }: ReplayViewProps) {
  const totalPlies = game.moves.length;
  const nav = useReplayNavigation({ game, adapter, totalPlies });

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const { setContainer: transportNavRef, onKeyDown: transportNavKeyDown } =
    useToolbarNavigation<HTMLDivElement>();

  // Keyboard shortcuts (arrow keys, Home, End, Space).
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
          nav.goBack();
          e.preventDefault();
          break;
        case 'ArrowRight':
          nav.goForward();
          e.preventDefault();
          break;
        case 'Home':
          nav.goToFirst();
          e.preventDefault();
          break;
        case 'End':
          nav.goToLast();
          e.preventDefault();
          break;
        case ' ':
          nav.toggleAutoPlay();
          e.preventDefault();
          break;
      }
    }

    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
    };
  }, [nav]);

  // Swipe handlers on the board area (mobile).
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

  // Event overlays via existing shared hook.
  const overlayState = useEventOverlays(
    nav.currentDeserializedEvents,
    nav.currentBoard,
    null,
  );

  const modeDisplayName = resolveGameRecord(game).displayName;

  const evalState = nav.evalLoading
    ? 'loading'
    : nav.currentEval
      ? 'evaluated'
      : 'unavailable';

  const currentNotation =
    nav.currentPly === 0
      ? 'Starting position'
      : `${String(Math.floor((nav.currentPly - 1) / 2) + 1)}. ${game.moves[nav.currentPly - 1] ?? ''}`;

  const announcement = useMemo(() => {
    if (nav.currentPly === 0) {
      return 'Starting position. Evaluation: equal.';
    }
    if (nav.currentPly >= totalPlies) {
      return `Game over. ${formatResult(game)}.`;
    }
    const notation = game.moves[nav.currentPly - 1] ?? '';
    const evalText = nav.currentEval
      ? `Evaluation: ${formatEvaluationScore(nav.currentEval.score)}.`
      : 'Evaluation: computing.';
    return `Move ${String(nav.currentPly)}: ${notation}. ${evalText}`;
  }, [game, nav.currentPly, nav.currentEval, totalPlies]);

  const showEvents =
    game.activeEventsPerPly !== undefined && adapter.modeId !== 'classic';

  return (
    <div
      className={styles.root}
      data-testid="replay-tool"
      data-phase="replay"
      ref={containerRef}
      tabIndex={-1}
    >
      <CogitateToolHeader
        title={`Replay: ${modeDisplayName} — ${formatPlayerLabel(game.playerWhite)} vs ${formatPlayerLabel(game.playerBlack)}`}
        onBack={onBackToSelect}
        backLabel="Games"
        backTestId="replay-back-to-select"
        onHome={onBackToHome}
        homeTestId="replay-back-to-cogitate-home"
        headerClassName={styles.replayHeader}
        backButtonClassName={styles.backButton}
        titleClassName={styles.title}
        homeLinkClassName={styles.homeLink}
      />

      <div className={styles.layout}>
        <div className={styles.boardPanel}>
          <div
            className={styles.boardArea}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <EvaluationBar
              score={nav.currentEval}
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
            score={nav.currentEval}
            orientation="horizontal"
            state={evalState}
            className={styles.evalBarHorizontal}
          />
        </div>

        <aside className={styles.sidePanel}>
          <GameMetadataHeader game={game} modeDisplayName={modeDisplayName} />
          {showEvents && (
            <ActiveEventsIndicator
              events={nav.currentEvents}
              gameMode={adapter.modeId}
            />
          )}
          {game.activeEventsPerPly === undefined && adapter.modeId !== 'classic' && (
            <p className={styles.eventsFallback} data-testid="replay-events-fallback">
              Event state wasn't recorded when this game was saved, so per-move event
              indicators are unavailable. Move playback still works normally.
            </p>
          )}
          <div className={styles.timelineWrap}>
            <div className={styles.timelineDesktop}>
              <MoveTimeline
                moves={game.moves}
                currentPly={nav.currentPly - 1}
                onPlySelect={(ply) => { nav.goToPly(ply + 1); }}
              />
            </div>
            <details className={styles.timelineMobile}>
              <summary>
                Move History ({String(game.moves.length)} moves)
              </summary>
              <MoveTimeline
                moves={game.moves}
                currentPly={nav.currentPly - 1}
                onPlySelect={(ply) => { nav.goToPly(ply + 1); }}
                compact
              />
            </details>
          </div>
        </aside>
      </div>

      <div
        className={styles.transportBar}
        role="toolbar"
        aria-label="Replay controls"
        data-testid="replay-transport-bar"
        ref={transportNavRef}
        onKeyDown={transportNavKeyDown}
      >
        <TransportButton
          label="First move"
          icon="⏮"
          testId="replay-first"
          disabled={nav.currentPly === 0}
          onClick={nav.goToFirst}
        />
        <TransportButton
          label="Previous move"
          icon="◀"
          testId="replay-back"
          disabled={nav.currentPly === 0}
          onClick={nav.goBack}
        />
        <span
          className={styles.plyReadout}
          data-testid="replay-ply-readout"
          aria-live="off"
        >
          {currentNotation}
        </span>
        <TransportButton
          label="Next move"
          icon="▶"
          testId="replay-forward"
          disabled={nav.currentPly === totalPlies}
          onClick={nav.goForward}
        />
        <TransportButton
          label="Last move"
          icon="⏭"
          testId="replay-last"
          disabled={nav.currentPly === totalPlies}
          onClick={nav.goToLast}
        />
        <TransportButton
          label={nav.isAutoPlaying ? 'Pause autoplay' : 'Play autoplay'}
          icon={nav.isAutoPlaying ? '⏸' : '▶'}
          testId="replay-autoplay"
          disabled={false}
          onClick={nav.toggleAutoPlay}
          pressed={nav.isAutoPlaying}
        />
      </div>

      <div
        className={styles.liveRegion}
        role="status"
        aria-live="polite"
        data-testid="replay-live-region"
      >
        {announcement}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TransportButtonProps {
  readonly label: string;
  readonly icon: string;
  readonly testId: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly pressed?: boolean;
}

function TransportButton({ label, icon, testId, disabled, onClick, pressed }: TransportButtonProps) {
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

interface GameMetadataHeaderProps {
  readonly game: GameRecord;
  readonly modeDisplayName: string;
}

function GameMetadataHeader({ game, modeDisplayName }: GameMetadataHeaderProps) {
  return (
    <dl className={styles.metadata} data-testid="replay-game-metadata">
      <div>
        <dt>Mode</dt>
        <dd>{modeDisplayName}</dd>
      </div>
      <div>
        <dt>White</dt>
        <dd>{formatPlayerLabel(game.playerWhite)}</dd>
      </div>
      <div>
        <dt>Black</dt>
        <dd>{formatPlayerLabel(game.playerBlack)}</dd>
      </div>
      <div>
        <dt>Result</dt>
        <dd>{formatResult(game)}</dd>
      </div>
      <div>
        <dt>Date</dt>
        <dd>{formatRelativeTime(game.completedAt)}</dd>
      </div>
      <div>
        <dt>Moves</dt>
        <dd>{String(game.moves.length)}</dd>
      </div>
    </dl>
  );
}
