import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ActiveEventsIndicator from './ActiveEventsIndicator';
import type { ActiveEvent } from '../engine/types';
import { CrazyEvent, PieceColor } from '../engine/types';

const indicatorCss = readFileSync(
  path.resolve(__dirname, 'ActiveEventsIndicator.module.css'),
  'utf8',
);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeEvent(
  type: CrazyEvent,
  remainingPlies: number,
  triggeredBy: typeof PieceColor.White | typeof PieceColor.Black = PieceColor.White,
  ply = 5,
): ActiveEvent {
  return { type, remainingPlies, triggeredBy, triggeredAtPly: ply };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActiveEventsIndicator', () => {
  it('renders nothing when activeEvents is empty', () => {
    const { container } = render(
      <ActiveEventsIndicator activeEvents={[]} activeColor={PieceColor.White} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders event name from EVENT_DISPLAY_NAMES for each active event', () => {
    const events = [makeEvent(CrazyEvent.KingForADay, 2)];
    render(<ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />);
    expect(screen.getByText('King for a Day')).toBeInTheDocument();
  });

  it('displays correct round count for timed events (remainingPlies: 4 → "2 rounds")', () => {
    const events = [makeEvent(CrazyEvent.OppositeDay, 4)];
    render(<ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />);
    expect(screen.getByText('2 rounds')).toBeInTheDocument();
  });

  it('displays "1 round" (singular) for remainingPlies: 1 or 2', () => {
    const events = [makeEvent(CrazyEvent.UpInTheAir, 1)];
    render(<ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />);
    expect(screen.getByText('1 round')).toBeInTheDocument();
  });

  it('displays condition text for condition-based events (remainingPlies: -1)', () => {
    const events = [makeEvent(CrazyEvent.LiveGrenade, -1)];
    render(<ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />);
    expect(screen.getByText('Until next capture')).toBeInTheDocument();
  });

  it('filters out instant events (remainingPlies: 0)', () => {
    const events = [
      makeEvent(CrazyEvent.ChecksMix, 0, PieceColor.White, 3),
      makeEvent(CrazyEvent.KingForADay, 2, PieceColor.White, 4),
    ];
    render(<ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />);
    expect(screen.queryByText('Checks Mix')).not.toBeInTheDocument();
    expect(screen.getByText('King for a Day')).toBeInTheDocument();
  });

  it('shows triggered-by color indicator', () => {
    const events = [makeEvent(CrazyEvent.KingForADay, 2, PieceColor.Black)];
    render(<ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />);
    const dot = screen.getByLabelText('Triggered by Black');
    expect(dot).toBeInTheDocument();
  });

  it('renders multiple simultaneous events', () => {
    const events = [
      makeEvent(CrazyEvent.KingForADay, 2, PieceColor.White, 3),
      makeEvent(CrazyEvent.OppositeDay, 4, PieceColor.Black, 5),
      makeEvent(CrazyEvent.LiveGrenade, -1, PieceColor.White, 7),
    ];
    render(<ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />);
    expect(screen.getByText('King for a Day')).toBeInTheDocument();
    expect(screen.getByText('Opposite Day')).toBeInTheDocument();
    expect(screen.getByText('Live Grenade')).toBeInTheDocument();
    expect(screen.getAllByTestId('active-event-row')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// P3.3 — Margin Notes paper-card chrome
// ---------------------------------------------------------------------------

describe('ActiveEventsIndicator — Margin Notes chrome (P3.3)', () => {
  afterEach(() => {
    delete document.body.dataset.theme;
  });

  it('container has the active-events-card global class', () => {
    const events = [makeEvent(CrazyEvent.KingForADay, 2)];
    render(
      <ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />,
    );
    const container = screen.getByTestId('active-events-indicator');
    expect(container.className).toContain('active-events-card');
  });

  it('container retains its CSS-Module class alongside active-events-card', () => {
    const events = [makeEvent(CrazyEvent.KingForADay, 2)];
    render(
      <ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />,
    );
    const container = screen.getByTestId('active-events-indicator');
    // The CSS-Module hashed class always contains "container" as a substring.
    expect(container.className).toMatch(/container/);
    expect(container.className).toContain('active-events-card');
  });

  it('renders the same DOM under any theme (chrome difference is CSS-only)', () => {
    const events = [makeEvent(CrazyEvent.KingForADay, 2)];

    document.body.dataset.theme = 'crazy-original';
    const { container: cOriginal, unmount: unmountOriginal } = render(
      <ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />,
    );
    const htmlOriginal = cOriginal.innerHTML;
    unmountOriginal();

    document.body.dataset.theme = 'margin-notes';
    const { container: cMargin } = render(
      <ActiveEventsIndicator activeEvents={events} activeColor={PieceColor.White} />,
    );
    const htmlMargin = cMargin.innerHTML;

    // Identical DOM — the visual difference comes from the
    // body[data-theme]-gated CSS rules (which jsdom doesn't visualize).
    expect(htmlOriginal).toBe(htmlMargin);
  });

  it('CSS source declares a Margin Notes paper-card override', () => {
    expect(indicatorCss).toContain("body[data-theme='margin-notes']");
    expect(indicatorCss).toContain(':global(.active-events-card)');
    expect(indicatorCss).toContain('background: var(--ui-surface)');
  });

  it('CSS source declares the tape ::before pseudo-element', () => {
    expect(indicatorCss).toContain(':global(.active-events-card)::before');
    expect(indicatorCss).toContain('var(--highlighter-yellow) 75%');
    expect(indicatorCss).toContain('rotate(var(--annotation-rotation-sm))');
  });

  it('CSS source declares the sway keyframe and binds it under Margin Notes', () => {
    expect(indicatorCss).toMatch(/@keyframes\s+activeEventsSway/);
    expect(indicatorCss).toMatch(/animation:\s*activeEventsSway\s+4s/);
  });

  it('CSS source declares a reduced-motion guard that disables the sway', () => {
    expect(indicatorCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    // The reduced-motion block must include `animation: none` for the card.
    const reducedMotionBlock = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/;
    const match = reducedMotionBlock.exec(indicatorCss);
    expect(match).not.toBeNull();
    expect(match?.[1] ?? '').toContain('animation: none');
  });
});
