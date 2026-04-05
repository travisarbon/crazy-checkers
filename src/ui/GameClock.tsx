/**
 * GameClock — stateless presentational component for one player's clock face.
 *
 * Renders the formatted time, player color swatch, active/inactive styling,
 * low-time warning pulse, and mode indicator. Hidden for CPU players in
 * vs-CPU games.
 */

import type { PieceColor } from '../engine/types';
import { PieceColor as PC } from '../engine/types';
import styles from './GameClock.module.css';

interface GameClockProps {
  /** Which player this clock represents. */
  color: PieceColor;
  /** Formatted time string to display. */
  timeDisplay: string;
  /** Whether this player's clock is actively counting down. */
  isActive: boolean;
  /** Whether this player is in low-time warning territory. */
  isLowTime: boolean;
  /** Time control mode indicator text (e.g., "+2s", "delay 5s"). */
  modeIndicator: string | null;
  /** Whether this clock should be hidden (CPU player in vs. CPU mode). */
  hidden?: boolean;
}

export default function GameClock({
  color,
  timeDisplay,
  isActive,
  isLowTime,
  modeIndicator,
  hidden = false,
}: GameClockProps) {
  const isWhite = color === PC.White;
  const colorLabel = isWhite ? 'White' : 'Black';
  const fillVar = isWhite ? 'var(--piece-white)' : 'var(--piece-black)';
  const strokeVar = isWhite ? 'var(--piece-white-stroke)' : 'var(--piece-black-stroke)';
  const isExpired = timeDisplay === '0.0';
  const testId = isWhite ? 'game-clock-white' : 'game-clock-black';

  // Build accessible time description
  const ariaTimeDescription = buildAriaTimeDescription(timeDisplay);

  if (hidden) return null;

  const containerClass = `${styles.clockContainer ?? ''} ${isActive ? (styles.clockActive ?? '') : (styles.clockInactive ?? '')}`;

  const timeClass = [
    styles.timeDisplay,
    isExpired ? styles.timeExpired : isLowTime ? styles.timeLow : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClass}
      data-testid={testId}
      data-active={isActive ? 'true' : undefined}
      data-low-time={isLowTime ? 'true' : undefined}
      aria-label={`${colorLabel}'s remaining time: ${ariaTimeDescription}`}
    >
      <svg width={16} height={16} aria-hidden="true">
        <circle cx={8} cy={8} r={6} fill={fillVar} stroke={strokeVar} strokeWidth={2} />
      </svg>
      <span className={styles.playerLabel}>{colorLabel}</span>
      {modeIndicator && <span className={styles.modeIndicator}>{modeIndicator}</span>}
      <span className={timeClass} role="timer" aria-live="off">
        {timeDisplay}
      </span>
      {/* Low-time announcement for screen readers */}
      {isLowTime && (
        <span
          aria-live="assertive"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
        >
          {colorLabel} is low on time
        </span>
      )}
    </div>
  );
}

/** Convert a formatted time string into a human-readable description for screen readers. */
function buildAriaTimeDescription(timeDisplay: string): string {
  if (timeDisplay === '0.0') return '0 seconds';

  // h:mm:ss
  const hmsMatch = /^(\d+):(\d{2}):(\d{2})$/.exec(timeDisplay);
  if (hmsMatch) {
    const h = parseInt(hmsMatch[1] ?? '0', 10);
    const m = parseInt(hmsMatch[2] ?? '0', 10);
    const s = parseInt(hmsMatch[3] ?? '0', 10);
    const parts: string[] = [];
    if (h > 0) parts.push(`${String(h)} hour${h !== 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${String(m)} minute${m !== 1 ? 's' : ''}`);
    if (s > 0) parts.push(`${String(s)} second${s !== 1 ? 's' : ''}`);
    return parts.join(' ') || '0 seconds';
  }

  // mm:ss
  const msMatch = /^(\d{2}):(\d{2})$/.exec(timeDisplay);
  if (msMatch) {
    const m = parseInt(msMatch[1] ?? '0', 10);
    const s = parseInt(msMatch[2] ?? '0', 10);
    const parts: string[] = [];
    if (m > 0) parts.push(`${String(m)} minute${m !== 1 ? 's' : ''}`);
    if (s > 0) parts.push(`${String(s)} second${s !== 1 ? 's' : ''}`);
    return parts.join(' ') || '0 seconds';
  }

  // s.t (tenths)
  const stMatch = /^(\d+)\.(\d)$/.exec(timeDisplay);
  if (stMatch) {
    const s = parseInt(stMatch[1] ?? '0', 10);
    const t = parseInt(stMatch[2] ?? '0', 10);
    if (s === 0 && t === 0) return '0 seconds';
    return `${String(s)}.${String(t)} seconds`;
  }

  return timeDisplay;
}
