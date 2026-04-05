/**
 * EventAnimations — SVG overlay components for event animation effects.
 *
 * Task 11.1: Pure presentation component receiving state from useAnimationQueue.
 * Renders flash overlays, explosion effects, and text overlays inside the
 * board SVG coordinate space (800x800 viewBox).
 *
 * Accessibility: aria-hidden="true" since these are decorative.
 * Screen reader announcements are handled by EventAnnouncement.tsx.
 */

import type {
  FlashingSquaresState,
  ExplosionState,
  OverlayState,
} from './useAnimationQueue';
import { squareCenterCoords } from './useAnimationQueue';
import type { Square } from '../engine/types';
import styles from './EventAnimations.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EventAnimationsProps {
  /** Board viewBox width (typically 800). */
  viewBoxWidth: number;
  /** Board viewBox height (typically 800). */
  viewBoxHeight: number;
  /** Whether the board is flipped. */
  flipped: boolean;
  /** Flash overlay state from useAnimationQueue. */
  flashingSquares: FlashingSquaresState | null;
  /** Explosion overlay state from useAnimationQueue. */
  explosionState: ExplosionState | null;
  /** Text overlay state from useAnimationQueue. */
  overlayState: OverlayState | null;
  /** Animation speed multiplier (affects CSS custom property durations). */
  speedMultiplier: number;
}

// ---------------------------------------------------------------------------
// Square size constant (matches Board.tsx grid)
// ---------------------------------------------------------------------------

const SQUARE_SIZE = 100;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FlashOverlays({
  state,
  flipped,
  speedMultiplier,
}: {
  state: FlashingSquaresState;
  flipped: boolean;
  speedMultiplier: number;
}) {
  const duration = state.durationMs * speedMultiplier;

  return (
    <>
      {Array.from(state.squares).map((sq) => {
        const { cx, cy } = squareCenterCoords(sq as Square, flipped);
        return (
          <circle
            key={sq}
            className={styles.flashOverlay}
            cx={cx}
            cy={cy}
            r={SQUARE_SIZE / 2}
            fill={state.color}
            style={{
              '--flash-duration': `${String(duration / state.pulses)}ms`,
              '--flash-pulses': String(state.pulses),
            } as React.CSSProperties}
          />
        );
      })}
    </>
  );
}

function ExplosionEffect({
  state,
  flipped,
  speedMultiplier,
}: {
  state: ExplosionState;
  flipped: boolean;
  speedMultiplier: number;
}) {
  const duration = state.durationMs * speedMultiplier;
  const { cx: centerX, cy: centerY } = squareCenterCoords(
    state.centerSquare as Square,
    flipped,
  );

  // Compute particle directions from center to each affected square
  const particles = Array.from(state.affectedSquares).map((sq) => {
    const { cx, cy } = squareCenterCoords(sq as Square, flipped);
    const dx = cx - centerX;
    const dy = cy - centerY;
    return { sq, dx, dy };
  });

  return (
    <>
      {/* Radial burst from center */}
      <circle
        className={styles.explosionBurst}
        cx={centerX}
        cy={centerY}
        r={SQUARE_SIZE * 1.5}
        fill="rgba(255, 120, 0, 0.6)"
        style={{ '--explosion-duration': `${String(duration)}ms` } as React.CSSProperties}
      />

      {/* Particles scatter outward — bounded to affectedSquares.length (max 5) */}
      {particles.map(({ sq, dx, dy }) => (
        <circle
          key={sq}
          className={styles.explosionParticle}
          cx={centerX}
          cy={centerY}
          r={8}
          fill="rgba(255, 200, 50, 0.8)"
          style={{
            '--explosion-duration': `${String(duration)}ms`,
            '--particle-dx': `${String(dx)}px`,
            '--particle-dy': `${String(dy)}px`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

function TextOverlay({
  state,
  viewBoxWidth,
  viewBoxHeight,
  speedMultiplier,
}: {
  state: OverlayState;
  viewBoxWidth: number;
  viewBoxHeight: number;
  speedMultiplier: number;
}) {
  const duration = state.durationMs * speedMultiplier;
  const centerX = viewBoxWidth / 2;
  const centerY = viewBoxHeight / 2;

  return (
    <g
      className={styles.textOverlay}
      style={{ '--overlay-duration': `${String(duration)}ms` } as React.CSSProperties}
    >
      {/* Semi-transparent backdrop */}
      <rect
        className={styles.textOverlayBackdrop}
        x={centerX - 180}
        y={centerY - 30}
        width={360}
        height={60}
      />
      {/* Text */}
      <text
        className={styles.textOverlayText}
        x={centerX}
        y={centerY}
      >
        {state.text}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EventAnimations({
  viewBoxWidth,
  viewBoxHeight,
  flipped,
  flashingSquares,
  explosionState,
  overlayState,
  speedMultiplier,
}: EventAnimationsProps) {
  const hasAny = flashingSquares !== null || explosionState !== null || overlayState !== null;
  if (!hasAny) return null;

  return (
    <g aria-hidden="true" data-testid="event-animations">
      {flashingSquares && (
        <FlashOverlays
          state={flashingSquares}
          flipped={flipped}
          speedMultiplier={speedMultiplier}
        />
      )}
      {explosionState && (
        <ExplosionEffect
          state={explosionState}
          flipped={flipped}
          speedMultiplier={speedMultiplier}
        />
      )}
      {overlayState && (
        <TextOverlay
          state={overlayState}
          viewBoxWidth={viewBoxWidth}
          viewBoxHeight={viewBoxHeight}
          speedMultiplier={speedMultiplier}
        />
      )}
    </g>
  );
}
