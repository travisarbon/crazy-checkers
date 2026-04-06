/**
 * EventOverlays — SVG overlay components for persistent event visual indicators.
 *
 * Task 11.3: Renders Live Grenade bomb icon, Hot Potato glow ring, and
 * Opposite Day border shift inside the board SVG coordinate space.
 *
 * King for a Day, Up in the Air, and No Touching! indicators are handled
 * by modifications to Piece.tsx and Board.tsx respectively.
 *
 * Accessibility: aria-hidden="true" since these are decorative.
 */

import { PieceType, square } from '../engine/types';
import type { BoardState } from '../engine/types';
import { getBoardSquare, squareToGrid } from '../engine/board';
import { squareCenterCoords } from './useAnimationQueue';
import type { EventOverlayState } from './useEventOverlays';
import { SAFE_HAVEN_SQUARES } from '../engine/events/safeHaven';
import styles from './EventOverlays.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EventOverlaysProps {
  /** Board viewBox width (typically 800). */
  viewBoxWidth: number;
  /** Whether the board is flipped. */
  flipped: boolean;
  /** Overlay state computed by useEventOverlays. */
  overlayState: EventOverlayState;
  /** Animation speed multiplier for CSS animations. */
  speedMultiplier: number;
  /** Current board state for computing overlay positions. */
  board?: BoardState;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LiveGrenadeIndicator({
  viewBoxWidth,
  speedMultiplier,
}: {
  viewBoxWidth: number;
  speedMultiplier: number;
}) {
  const cx = viewBoxWidth - 40;
  const cy = 40;

  return (
    <g
      className={styles.liveGrenadeIndicator}
      style={{ '--pulse-duration': `${String(1200 * speedMultiplier)}ms` } as React.CSSProperties}
      data-testid="live-grenade-indicator"
    >
      {/* Bomb body */}
      <circle cx={cx} cy={cy} r={16} fill="var(--ui-danger)" opacity={0.9} />
      {/* Fuse line */}
      <line
        x1={cx + 8}
        y1={cy - 12}
        x2={cx + 14}
        y2={cy - 20}
        stroke="var(--ui-danger)"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* Spark dot */}
      <circle
        cx={cx + 14}
        cy={cy - 22}
        r={4}
        fill="var(--ui-accent)"
        className={styles.sparkPulse}
      />
    </g>
  );
}

function HotPotatoIndicator({
  hotSquares,
  flipped,
  speedMultiplier,
}: {
  hotSquares: ReadonlySet<number>;
  flipped: boolean;
  speedMultiplier: number;
}) {
  return (
    <g data-testid="hot-potato-indicator">
      {[...hotSquares].map(sq => {
        const { cx, cy } = squareCenterCoords(square(sq), flipped);
        return (
          <circle
            key={sq}
            cx={cx}
            cy={cy}
            r={44}
            fill="none"
            stroke="var(--ui-danger)"
            strokeWidth={3}
            className={styles.hotPotatoGlow}
            style={{ '--glow-duration': `${String(900 * speedMultiplier)}ms` } as React.CSSProperties}
          />
        );
      })}
    </g>
  );
}

function OppositeDayIndicator({
  speedMultiplier,
}: {
  speedMultiplier: number;
}) {
  return (
    <rect
      x={-4}
      y={-4}
      width={808}
      height={808}
      fill="none"
      stroke="var(--ui-danger)"
      strokeWidth={6}
      rx={6}
      className={styles.oppositeDayBorder}
      style={{ '--border-duration': `${String(2000 * speedMultiplier)}ms` } as React.CSSProperties}
      data-testid="opposite-day-indicator"
    />
  );
}

// ---------------------------------------------------------------------------
// Phase 3 Tier 1 sub-components
// ---------------------------------------------------------------------------

function BodyguardIndicator({
  guardedKings,
  flipped,
  speedMultiplier,
}: {
  guardedKings: ReadonlySet<number>;
  flipped: boolean;
  speedMultiplier: number;
}) {
  return (
    <g data-testid="bodyguard-indicator">
      {[...guardedKings].map(sq => {
        const { cx, cy } = squareCenterCoords(square(sq), flipped);
        return (
          <text
            key={sq}
            x={cx + 30}
            y={cy - 25}
            fontSize="22"
            fill="var(--ui-accent)"
            className={styles.bodyguardShield}
            style={{ '--shield-duration': `${String(1500 * speedMultiplier)}ms` } as React.CSSProperties}
          >
            &#x1F6E1;
          </text>
        );
      })}
    </g>
  );
}

function QuicksandIndicator({
  board,
  flipped,
  speedMultiplier,
}: {
  board: BoardState;
  flipped: boolean;
  speedMultiplier: number;
}) {
  const edgeSquares: number[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    if (getBoardSquare(board, square(sq)) !== null && ((): boolean => {
      const { row, col } = squareToGrid(square(sq));
      return row === 0 || row === 7 || col === 0 || col === 7;
    })()) {
      edgeSquares.push(sq);
    }
  }

  return (
    <g data-testid="quicksand-indicator">
      {edgeSquares.map(sq => {
        const { cx, cy } = squareCenterCoords(square(sq), flipped);
        return (
          <circle
            key={sq}
            cx={cx} cy={cy} r={45}
            fill="rgba(100, 70, 30, 0.25)"
            className={styles.quicksandCircle}
            style={{ '--quicksand-duration': `${String(2000 * speedMultiplier)}ms` } as React.CSSProperties}
          />
        );
      })}
    </g>
  );
}

function FrozenAssetsIndicator({
  board,
  flipped,
  speedMultiplier,
}: {
  board: BoardState;
  flipped: boolean;
  speedMultiplier: number;
}) {
  const kingSquares: number[] = [];
  for (let sq = 1; sq <= 32; sq++) {
    const p = getBoardSquare(board, square(sq));
    if (p !== null && p.type === PieceType.King) kingSquares.push(sq);
  }

  return (
    <g data-testid="frozen-assets-indicator">
      {kingSquares.map(sq => {
        const { cx, cy } = squareCenterCoords(square(sq), flipped);
        return (
          <g
            key={sq}
            className={styles.frozenAssetsStar}
            style={{ '--frozen-duration': `${String(4000 * speedMultiplier)}ms` } as React.CSSProperties}
          >
            {/* Six-pointed star (snowflake) */}
            <text x={cx - 12} y={cy + 8} fontSize="24" fill="rgba(150, 200, 255, 0.7)">
              &#x2744;
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SafeHavenIndicator({
  flipped,
  speedMultiplier,
}: {
  flipped: boolean;
  speedMultiplier: number;
}) {
  return (
    <g data-testid="safe-haven-indicator">
      {[...SAFE_HAVEN_SQUARES].map(sq => {
        const { cx, cy } = squareCenterCoords(square(sq), flipped);
        return (
          <circle
            key={sq}
            cx={cx} cy={cy} r={44}
            fill="none"
            stroke="var(--ui-accent)"
            strokeWidth={2.5}
            className={styles.safeHavenRing}
            style={{ '--haven-duration': `${String(1800 * speedMultiplier)}ms` } as React.CSSProperties}
          />
        );
      })}
    </g>
  );
}

function PromotionPartyIndicator({
  flipped,
  speedMultiplier,
}: {
  flipped: boolean;
  speedMultiplier: number;
}) {
  // Expanded promotion zones: rows 0-1 (top) and rows 6-7 (bottom)
  // In board coords: row 0 = y:0, row 7 = y:700. Each row is 100px.
  const topY = flipped ? 600 : 0;
  const bottomY = flipped ? 0 : 600;

  return (
    <g
      data-testid="promotion-party-indicator"
      className={styles.promotionPartyZone}
      style={{ '--promo-duration': `${String(2000 * speedMultiplier)}ms` } as React.CSSProperties}
    >
      <rect x={0} y={topY} width={800} height={200}
        fill="none" stroke="var(--ui-accent)" strokeWidth={3}
        strokeDasharray="8 4" rx={4} />
      <rect x={0} y={bottomY} width={800} height={200}
        fill="none" stroke="var(--ui-accent)" strokeWidth={3}
        strokeDasharray="8 4" rx={4} />
    </g>
  );
}

function ForcedMarchIndicator({
  forcedSquare,
  flipped,
  speedMultiplier,
}: {
  forcedSquare: number;
  flipped: boolean;
  speedMultiplier: number;
}) {
  const { cx, cy } = squareCenterCoords(square(forcedSquare), flipped);
  // Arrow pointing up (toward opponent)
  return (
    <polygon
      points={`${String(cx)},${String(cy - 42)} ${String(cx - 10)},${String(cy - 28)} ${String(cx + 10)},${String(cy - 28)}`}
      fill="var(--ui-accent)"
      className={styles.forcedMarchArrow}
      style={{ '--arrow-duration': `${String(1200 * speedMultiplier)}ms` } as React.CSSProperties}
      data-testid="forced-march-indicator"
    />
  );
}

function SentryIndicator({
  pinLines,
  flipped,
  speedMultiplier,
}: {
  pinLines: ReadonlyArray<{ from: number; to: number }>;
  flipped: boolean;
  speedMultiplier: number;
}) {
  return (
    <g data-testid="sentry-indicator">
      {pinLines.map((line, i) => {
        const from = squareCenterCoords(square(line.from), flipped);
        const to = squareCenterCoords(square(line.to), flipped);
        return (
          <line
            key={i}
            x1={from.cx} y1={from.cy}
            x2={to.cx} y2={to.cy}
            stroke="var(--ui-danger)"
            strokeWidth={2}
            strokeDasharray="6 3"
            className={styles.sentryLine}
            style={{ '--sentry-duration': `${String(1500 * speedMultiplier)}ms` } as React.CSSProperties}
          />
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Phase 3 Tier 2/3 sub-components
// ---------------------------------------------------------------------------

function GhostWalkIndicator({
  flipped,
  speedMultiplier,
  board,
}: { flipped: boolean; speedMultiplier: number; board: BoardState }) {
  const occupiedSquares: number[] = [];
  for (let i = 0; i < 32; i++) {
    if (board[i] != null) occupiedSquares.push(i + 1);
  }
  return (
    <g>
      {occupiedSquares.map(sq => {
        const { cx, cy } = squareCenterCoords(square(sq), flipped);
        return (
          <circle key={`gw-${String(sq)}`} cx={cx} cy={cy} r={40}
            fill="rgba(200, 200, 255, 0.15)"
            className={styles.ghostWalkShimmer}
            style={{ '--shimmer-duration': `${String(2000 / speedMultiplier)}ms` } as React.CSSProperties}
          />
        );
      })}
    </g>
  );
}

function LandmineIndicator({
  landmineSquares,
  flipped,
  speedMultiplier,
}: { landmineSquares: ReadonlySet<number>; flipped: boolean; speedMultiplier: number }) {
  return (
    <g>
      {[...landmineSquares].map(sq => {
        const { cx, cy } = squareCenterCoords(square(sq), flipped);
        return (
          <g key={`lm-${String(sq)}`} className={styles.landmineIcon}
            style={{ '--mine-duration': `${String(1500 / speedMultiplier)}ms` } as React.CSSProperties}>
            <circle cx={cx} cy={cy} r={30} fill="none" stroke="var(--ui-danger, #dc3545)" strokeWidth={2} strokeDasharray="6 3" />
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize={20} fill="var(--ui-danger, #dc3545)">💣</text>
          </g>
        );
      })}
    </g>
  );
}

function DoubleTimeIndicator({ speedMultiplier }: { speedMultiplier: number }) {
  const color = 'var(--ui-accent, #ffc107)';
  return (
    <g className={styles.doubleTimeArrow}
      style={{ '--double-duration': `${String(1200 / speedMultiplier)}ms` } as React.CSSProperties}>
      {/* Two stacked chevron arrows */}
      <path d="M20 18 L32 28 L20 38" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 18 L46 28 L34 38" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function WormholeIndicator({
  portals,
  flipped,
  speedMultiplier,
}: { portals: ReadonlyArray<{ a: number; b: number }>; flipped: boolean; speedMultiplier: number }) {
  const colors = ['rgba(128, 0, 255, 0.5)', 'rgba(0, 200, 100, 0.5)'];
  return (
    <g>
      {portals.map((pair, idx) => {
        const color = colors[idx] ?? colors[0];
        return [pair.a, pair.b].map(sq => {
          const { cx, cy } = squareCenterCoords(square(sq), flipped);
          return (
            <circle key={`wh-${String(sq)}`} cx={cx} cy={cy} r={35}
              fill="none" stroke={color} strokeWidth={3} strokeDasharray="8 4"
              className={styles.wormholePortal}
              style={{
                '--wormhole-duration': `${String(6000 / speedMultiplier)}ms`,
                transformOrigin: `${String(cx)}px ${String(cy)}px`,
              } as React.CSSProperties}
            />
          );
        });
      })}
    </g>
  );
}

function TimeBombIndicator({
  bombState,
  flipped,
  speedMultiplier,
}: { bombState: { square: number; remaining: number }; flipped: boolean; speedMultiplier: number }) {
  const { cx, cy } = squareCenterCoords(square(bombState.square), flipped);
  const speed = Math.max(500, 2000 - (3 - bombState.remaining) * 300);
  return (
    <g className={styles.timeBombCountdown}
      style={{
        '--bomb-speed': `${String(speed / speedMultiplier)}ms`,
        transformOrigin: `${String(cx)}px ${String(cy)}px`,
      } as React.CSSProperties}>
      <circle cx={cx} cy={cy} r={38} fill="rgba(0,0,0,0.45)" stroke="var(--ui-danger, #dc3545)" strokeWidth={3} />
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={26} fontWeight="bold"
        fill="#fff" stroke="var(--ui-danger, #dc3545)" strokeWidth={1}>
        {String(bombState.remaining)}
      </text>
    </g>
  );
}

function BackfireIndicator({
  flipped,
  speedMultiplier,
  board,
}: { flipped: boolean; speedMultiplier: number; board: BoardState }) {
  const occupiedSquares: number[] = [];
  for (let i = 0; i < 32; i++) {
    if (board[i] != null) occupiedSquares.push(i + 1);
  }
  return (
    <g>
      {occupiedSquares.map(sq => {
        const { cx, cy } = squareCenterCoords(square(sq), flipped);
        return (
          <circle key={`bf-${String(sq)}`} cx={cx} cy={cy} r={40}
            fill="rgba(200, 50, 50, 0.15)"
            className={styles.backfireGlow}
            style={{ '--backfire-duration': `${String(2000 / speedMultiplier)}ms` } as React.CSSProperties}
          />
        );
      })}
    </g>
  );
}

function FlippedScriptIndicator({
  flipped,
  speedMultiplier,
}: { flipped: boolean; speedMultiplier: number }) {
  // White promotion zone = row 7, Black = row 0
  const whiteRow = flipped ? 0 : 7;
  const blackRow = flipped ? 7 : 0;
  return (
    <g className={styles.flippedScriptZone}
      style={{ '--flipped-duration': `${String(2000 / speedMultiplier)}ms` } as React.CSSProperties}>
      <rect x={0} y={whiteRow * 100} width={800} height={100}
        fill="none" stroke="var(--ui-accent, #ffc107)" strokeWidth={2} strokeDasharray="10 5" />
      <text x={15} y={whiteRow * 100 + 20} fontSize={14} fill="var(--ui-accent, #ffc107)">W</text>
      <rect x={0} y={blackRow * 100} width={800} height={100}
        fill="none" stroke="var(--ui-accent, #ffc107)" strokeWidth={2} strokeDasharray="10 5" />
      <text x={15} y={blackRow * 100 + 20} fontSize={14} fill="var(--ui-accent, #ffc107)">B</text>
    </g>
  );
}

function MarchingOrdersIndicator({ speedMultiplier }: { speedMultiplier: number }) {
  void speedMultiplier;
  // Render 64-square grid lines
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < 8; i++) {
    lines.push(
      <line key={`h-${String(i)}`} x1={0} y1={i * 100} x2={800} y2={i * 100} stroke="rgba(255, 165, 0, 0.25)" strokeWidth={1} />,
    );
    lines.push(
      <line key={`v-${String(i)}`} x1={i * 100} y1={0} x2={i * 100} y2={800} stroke="rgba(255, 165, 0, 0.25)" strokeWidth={1} />,
    );
  }
  // Light square fills
  const lightSquares: React.ReactNode[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = r % 2 === 0 ? c % 2 === 0 : c % 2 === 1;
      if (isLight) {
        lightSquares.push(
          <rect key={`ls-${String(r)}-${String(c)}`} x={c * 100} y={r * 100} width={100} height={100} fill="rgba(255, 165, 0, 0.05)" />,
        );
      }
    }
  }
  return (
    <g className={styles.marchingOrdersGrid}>
      {lightSquares}
      {lines}
    </g>
  );
}

function HauntedGhostIndicator({
  ghosts,
  flipped,
}: { ghosts: ReadonlyArray<{ square: number; remainingPlies: number }>; flipped: boolean }) {
  return (
    <g>
      {ghosts.map(ghost => {
        const { cx, cy } = squareCenterCoords(square(ghost.square), flipped);
        const opacity = 0.15 + ghost.remainingPlies * 0.05;
        return (
          <g key={`ghost-${String(ghost.square)}`} className={styles.hauntedGhost}
            style={{ '--ghost-opacity': String(opacity) } as React.CSSProperties}>
            <circle cx={cx} cy={cy} r={30} fill={`rgba(255, 255, 255, ${String(opacity)})`} />
            <circle cx={cx - 8} cy={cy - 5} r={4} fill="rgba(100, 100, 150, 0.5)" />
            <circle cx={cx + 8} cy={cy - 5} r={4} fill="rgba(100, 100, 150, 0.5)" />
            <text x={cx + 28} y={cy - 22} fontSize={12} fill="rgba(255, 255, 255, 0.6)">{String(ghost.remainingPlies)}</text>
          </g>
        );
      })}
    </g>
  );
}

function ShrinkingBoardIndicator({
  removedSquares,
  flipped,
  speedMultiplier,
}: { removedSquares: ReadonlySet<number>; flipped: boolean; speedMultiplier: number }) {
  return (
    <g>
      {[...removedSquares].map(sq => {
        const { row, col } = squareToGrid(square(sq));
        const renderRow = flipped ? 7 - row : row;
        const renderCol = flipped ? 7 - col : col;
        return (
          <rect key={`sb-${String(sq)}`} x={renderCol * 100} y={renderRow * 100} width={100} height={100}
            fill="rgba(0, 0, 0, 0.5)" className={styles.shrinkingBoardDead}
          />
        );
      })}
      <rect x={0} y={0} width={800} height={800} fill="none"
        stroke="var(--ui-danger, #dc3545)" strokeWidth={2} strokeDasharray="8 4"
        className={styles.shrinkingBoardBoundary}
        style={{ '--boundary-duration': `${String(2000 / speedMultiplier)}ms` } as React.CSSProperties}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EventOverlays({
  viewBoxWidth,
  flipped,
  overlayState,
  speedMultiplier,
  board,
}: EventOverlaysProps) {
  const {
    liveGrenadeActive,
    hotPotatoSquares,
    oppositeDayActive,
    guardedKingSquares,
    quicksandActive,
    frozenAssetsActive,
    safeHavenActive,
    promotionPartyActive,
    forcedMarchSquare,
    royalDecreeActive,
    sentryPinLines,
    ghostWalkActive,
    landmineSquares,
    doubleTimeActive,
    wormholePortals,
    timeBombState,
    backfireActive,
    flippedScriptActive,
    marchingOrdersActive,
    hauntedGhosts,
    shrinkingBoardRemovedSquares,
  } = overlayState;

  const hasPhase2 = liveGrenadeActive || hotPotatoSquares.size > 0 || oppositeDayActive;
  const hasPhase3 =
    guardedKingSquares.size > 0 ||
    (quicksandActive && board !== undefined) ||
    (frozenAssetsActive && board !== undefined) ||
    safeHavenActive ||
    promotionPartyActive ||
    forcedMarchSquare !== null ||
    royalDecreeActive ||
    sentryPinLines.length > 0;
  const hasTier2_3 =
    (ghostWalkActive && board !== undefined) ||
    landmineSquares.size > 0 ||
    doubleTimeActive ||
    wormholePortals.length > 0 ||
    timeBombState !== null ||
    (backfireActive && board !== undefined) ||
    flippedScriptActive ||
    marchingOrdersActive ||
    hauntedGhosts.length > 0 ||
    shrinkingBoardRemovedSquares.size > 0;

  if (!hasPhase2 && !hasPhase3 && !hasTier2_3) return null;

  return (
    <g aria-hidden="true" data-testid="event-overlays">
      {oppositeDayActive && (
        <OppositeDayIndicator speedMultiplier={speedMultiplier} />
      )}
      {liveGrenadeActive && (
        <LiveGrenadeIndicator
          viewBoxWidth={viewBoxWidth}
          speedMultiplier={speedMultiplier}
        />
      )}
      {hotPotatoSquares.size > 0 && (
        <HotPotatoIndicator
          hotSquares={hotPotatoSquares}
          flipped={flipped}
          speedMultiplier={speedMultiplier}
        />
      )}
      {guardedKingSquares.size > 0 && (
        <BodyguardIndicator
          guardedKings={guardedKingSquares}
          flipped={flipped}
          speedMultiplier={speedMultiplier}
        />
      )}
      {quicksandActive && board !== undefined && (
        <QuicksandIndicator board={board} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {frozenAssetsActive && board !== undefined && (
        <FrozenAssetsIndicator board={board} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {safeHavenActive && (
        <SafeHavenIndicator flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {promotionPartyActive && (
        <PromotionPartyIndicator flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {forcedMarchSquare !== null && (
        <ForcedMarchIndicator forcedSquare={forcedMarchSquare} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {sentryPinLines.length > 0 && (
        <SentryIndicator pinLines={sentryPinLines} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {/* Phase 3 Tier 2/3 overlays */}
      {shrinkingBoardRemovedSquares.size > 0 && (
        <ShrinkingBoardIndicator removedSquares={shrinkingBoardRemovedSquares} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {marchingOrdersActive && (
        <MarchingOrdersIndicator speedMultiplier={speedMultiplier} />
      )}
      {ghostWalkActive && board !== undefined && (
        <GhostWalkIndicator board={board} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {landmineSquares.size > 0 && (
        <LandmineIndicator landmineSquares={landmineSquares} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {wormholePortals.length > 0 && (
        <WormholeIndicator portals={wormholePortals} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {backfireActive && board !== undefined && (
        <BackfireIndicator board={board} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {flippedScriptActive && (
        <FlippedScriptIndicator flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {hauntedGhosts.length > 0 && (
        <HauntedGhostIndicator ghosts={hauntedGhosts} flipped={flipped} />
      )}
      {timeBombState !== null && (
        <TimeBombIndicator bombState={timeBombState} flipped={flipped} speedMultiplier={speedMultiplier} />
      )}
      {doubleTimeActive && (
        <DoubleTimeIndicator speedMultiplier={speedMultiplier} />
      )}
    </g>
  );
}
