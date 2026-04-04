import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ActiveEventsIndicator from './ActiveEventsIndicator';
import type { ActiveEvent } from '../engine/types';
import { CrazyEvent, PieceColor } from '../engine/types';

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
