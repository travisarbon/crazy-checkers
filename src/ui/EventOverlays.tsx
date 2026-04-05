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

import type { Square } from '../engine/types';
import { squareCenterCoords } from './useAnimationQueue';
import type { EventOverlayState } from './useEventOverlays';
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
// Main component
// ---------------------------------------------------------------------------

export default function EventOverlays({
  viewBoxWidth,
  flipped,
  overlayState,
  speedMultiplier,
}: EventOverlaysProps) {
  const {
    liveGrenadeActive,
    hotPieceSquare,
    oppositeDayActive,
  } = overlayState;

  const hasAny = liveGrenadeActive || hotPieceSquare !== null || oppositeDayActive;
  if (!hasAny) return null;

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
    </g>
  );
}
