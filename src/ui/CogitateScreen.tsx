/**
 * CogitateScreen — hub for all Cogitate tools (Replay, Analysis, Training,
 * Free Play). Hosts its own internal navigation so that individual tools
 * render without a nested ModeScreenShell.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import ModeScreenShell from './ModeScreenShell';
import ReplayTool from './cogitate/ReplayTool';
import AnalysisTool from './cogitate/AnalysisTool';
import TrainingTool from './cogitate/TrainingTool';
import FreePlayTool from './cogitate/FreePlayTool';
import { useToolAvailability } from './cogitate/useToolAvailability';
import { useCogitateHistory, type CogitateView } from './cogitate/useCogitateHistory';
import styles from './CogitateScreen.module.css';

interface CogitateScreenProps {
  onBack: () => void;
}

type ToolIcon = 'replay' | 'analysis' | 'training' | 'freeplay';

interface ToolCardProps {
  readonly title: string;
  readonly description: string;
  readonly available: boolean;
  readonly unavailableMessage?: string;
  readonly onLaunch: () => void;
  readonly testId: string;
  readonly icon: ToolIcon;
  readonly launchRef?: React.Ref<HTMLButtonElement>;
}

function ToolCardIcon({ icon }: { icon: ToolIcon }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
  switch (icon) {
    case 'replay':
      return (
        <svg {...common}>
          <polygon points="19 20 9 12 19 4 19 20" />
          <line x1="5" y1="19" x2="5" y2="5" />
        </svg>
      );
    case 'analysis':
      return (
        <svg {...common}>
          <line x1="4" y1="20" x2="4" y2="10" />
          <line x1="10" y1="20" x2="10" y2="4" />
          <line x1="16" y1="20" x2="16" y2="14" />
          <line x1="22" y1="20" x2="2" y2="20" />
        </svg>
      );
    case 'training':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'freeplay':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
  }
}

function ToolCard({
  title,
  description,
  available,
  unavailableMessage,
  onLaunch,
  testId,
  icon,
  launchRef,
}: ToolCardProps) {
  const messageId = `${testId}-unavailable-msg`;
  return (
    <article
      className={[styles.card, available ? '' : styles.cardDisabled].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon} aria-hidden="true">
          <ToolCardIcon icon={icon} />
        </span>
        <h3 className={styles.cardTitle}>{title}</h3>
      </div>
      <p className={styles.cardDescription}>{description}</p>
      {!available && unavailableMessage ? (
        <p id={messageId} className={styles.cardUnavailableMessage}>
          {unavailableMessage}
        </p>
      ) : null}
      <button
        type="button"
        ref={launchRef}
        className={styles.cardButton}
        disabled={!available}
        onClick={onLaunch}
        data-testid={`${testId}-launch`}
        aria-describedby={!available && unavailableMessage ? messageId : undefined}
      >
        {available ? 'Launch' : 'Unavailable'}
      </button>
    </article>
  );
}

export default function CogitateScreen({ onBack }: CogitateScreenProps) {
  const [view, setView] = useState<CogitateView>({ kind: 'cogitate-home' });
  const [refreshKey, setRefreshKey] = useState(0);
  const availability = useToolAvailability(refreshKey);
  useCogitateHistory({ view, setView });

  const previousViewRef = useRef<CogitateView['kind']>('cogitate-home');
  const replayRef = useRef<HTMLButtonElement>(null);
  const analysisRef = useRef<HTMLButtonElement>(null);
  const trainingRef = useRef<HTMLButtonElement>(null);
  const freeplayRef = useRef<HTMLButtonElement>(null);
  const prevAvailabilityRef = useRef(availability);
  const announcementRef = useRef<HTMLDivElement>(null);

  const goHome = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setView({ kind: 'cogitate-home' });
  }, []);

  const launchTool = useCallback((kind: Exclude<CogitateView['kind'], 'cogitate-home'>) => {
    previousViewRef.current = kind;
    setView({ kind });
  }, []);

  useEffect(() => {
    if (view.kind !== 'cogitate-home' || !availability.isLoaded) return;
    const prev = prevAvailabilityRef.current;
    const changes: string[] = [];
    if (!prev.replayAvailable && availability.replayAvailable) changes.push('Replay');
    if (!prev.analysisAvailable && availability.analysisAvailable) changes.push('Analysis');
    if (!prev.trainingAvailable && availability.trainingAvailable) changes.push('Training');
    prevAvailabilityRef.current = availability;
    if (changes.length > 0 && announcementRef.current) {
      const names = changes.join(', ');
      announcementRef.current.textContent = `${names} ${
        changes.length === 1 ? 'tool is' : 'tools are'
      } now available.`;
    }
  }, [availability, view.kind]);

  useEffect(() => {
    if (view.kind !== 'cogitate-home') return;
    const target = previousViewRef.current;
    if (target === 'cogitate-home') return;
    const refByKind: Record<string, React.RefObject<HTMLButtonElement | null>> = {
      'cogitate-replay': replayRef,
      'cogitate-analysis': analysisRef,
      'cogitate-training': trainingRef,
      'cogitate-freeplay': freeplayRef,
    };
    const btn = refByKind[target]?.current;
    if (btn && !btn.disabled) {
      btn.focus();
    }
    previousViewRef.current = 'cogitate-home';
  }, [view.kind, availability.isLoaded]);

  if (view.kind === 'cogitate-replay') {
    return <ReplayTool onBack={goHome} />;
  }
  if (view.kind === 'cogitate-analysis') {
    return <AnalysisTool onBack={goHome} />;
  }
  if (view.kind === 'cogitate-training') {
    return <TrainingTool onBack={goHome} />;
  }
  if (view.kind === 'cogitate-freeplay') {
    return <FreePlayTool onBack={goHome} />;
  }

  return (
    <ModeScreenShell title="Cogitate" onBack={onBack} testId="cogitate-screen">
      <div
        ref={announcementRef}
        aria-live="polite"
        className={styles.srOnly}
        data-testid="cogitate-announcements"
      />
      <div className={styles.grid} data-testid="cogitate-home">
        <ToolCard
          title="Replay"
          description="Step through any completed game move-by-move with the engine's evaluation."
          available={availability.replayAvailable}
          unavailableMessage="Play some games first to unlock this tool."
          onLaunch={() => { launchTool('cogitate-replay'); }}
          testId="cogitate-tool-replay"
          icon="replay"
          launchRef={replayRef}
        />
        <ToolCard
          title="Analysis"
          description="Deep engine analysis of positions with move-quality annotations."
          available={availability.analysisAvailable}
          unavailableMessage="Play some games first to unlock this tool."
          onLaunch={() => { launchTool('cogitate-analysis'); }}
          testId="cogitate-tool-analysis"
          icon="analysis"
          launchRef={analysisRef}
        />
        <ToolCard
          title="Training"
          description="Practice positions where you made suboptimal moves in past games."
          available={availability.trainingAvailable}
          unavailableMessage="Analyze a completed game in the Analysis tool to generate training positions."
          onLaunch={() => { launchTool('cogitate-training'); }}
          testId="cogitate-tool-training"
          icon="training"
          launchRef={trainingRef}
        />
        <ToolCard
          title="Free Play"
          description="Set up custom positions and play them out with real-time engine evaluation."
          available={availability.freePlayAvailable}
          onLaunch={() => { launchTool('cogitate-freeplay'); }}
          testId="cogitate-tool-freeplay"
          icon="freeplay"
          launchRef={freeplayRef}
        />
      </div>
    </ModeScreenShell>
  );
}
