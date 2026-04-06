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
import type { BoardState, Square } from '../engine/types';
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
  hotSquare,
  flipped,
  speedMultiplier,
}: {
  hotSquare: Square;
  flipped: boolean;
  speedMultiplier: number;
}) {
  const { cx, cy } = squareCenterCoords(hotSquare, flipped);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={44}
      fill="none"
      stroke="var(--ui-danger)"
      strokeWidth={3}
      className={styles.hotPotatoGlow}
      style={{ '--glow-duration': `${String(900 * speedMultiplier)}ms` } as React.CSSProperties}
      data-testid="hot-potato-indicator"
    />
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
    hotPieceSquare,
    oppositeDayActive,
    guardedKingSquares,
    quicksandActive,
    frozenAssetsActive,
    safeHavenActive,
    promotionPartyActive,
    forcedMarchSquare,
    royalDecreeActive,
    sentryPinLines,
  } = overlayState;

  const hasPhase2 = liveGrenadeActive || hotPieceSquare !== null || oppositeDayActive;
  const hasPhase3 =
    guardedKingSquares.size > 0 ||
    (quicksandActive && board !== undefined) ||
    (frozenAssetsActive && board !== undefined) ||
    safeHavenActive ||
    promotionPartyActive ||
    forcedMarchSquare !== null ||
    royalDecreeActive ||
    sentryPinLines.length > 0;

  if (!hasPhase2 && !hasPhase3) return null;

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
      {hotPieceSquare !== null && (
        <HotPotatoIndicator
          hotSquare={hotPieceSquare}
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
    </g>
  );
}
