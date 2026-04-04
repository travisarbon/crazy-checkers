import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EventAnnouncement from './EventAnnouncement';
import type { ActiveEvent } from '../engine/types';
import { CrazyEvent, PieceColor } from '../engine/types';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeEvent(type: CrazyEvent, ply = 5): ActiveEvent {
  return {
    type,
    remainingPlies: 2,
    triggeredBy: PieceColor.White,
    triggeredAtPly: ply,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventAnnouncement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders event name and flavor text', () => {
    const event = makeEvent(CrazyEvent.KingForADay);
    render(<EventAnnouncement events={[event]} onDismiss={vi.fn()} />);
    expect(screen.getByText('King for a Day')).toBeInTheDocument();
    expect(screen.getByText('For one round everyone wears the crown!')).toBeInTheDocument();
  });

  it('auto-dismisses after the specified delay', () => {
    const onDismiss = vi.fn();
    render(<EventAnnouncement events={[makeEvent(CrazyEvent.LiveGrenade)]} onDismiss={onDismiss} dismissDelay={2000} />);
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('dismisses on click', () => {
    const onDismiss = vi.fn();
    render(<EventAnnouncement events={[makeEvent(CrazyEvent.HotPotato)]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('event-announcement'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls onDismiss exactly once (click then timer)', () => {
    const onDismiss = vi.fn();
    render(<EventAnnouncement events={[makeEvent(CrazyEvent.ChecksMix)]} onDismiss={onDismiss} dismissDelay={2000} />);
    fireEvent.click(screen.getByTestId('event-announcement'));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders multiple events when given array of length > 1', () => {
    const events = [
      makeEvent(CrazyEvent.OppositeDay, 5),
      makeEvent(CrazyEvent.UpInTheAir, 6),
    ];
    render(<EventAnnouncement events={events} onDismiss={vi.fn()} />);
    expect(screen.getByText('Opposite Day')).toBeInTheDocument();
    expect(screen.getByText('Up in the Air')).toBeInTheDocument();
  });

  it('cleans up timer on unmount (no memory leaks)', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <EventAnnouncement events={[makeEvent(CrazyEvent.NoTouching)]} onDismiss={onDismiss} dismissDelay={2000} />,
    );
    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('has correct accessibility attributes', () => {
    render(<EventAnnouncement events={[makeEvent(CrazyEvent.KingForADay)]} onDismiss={vi.fn()} />);
    const overlay = screen.getByTestId('event-announcement');
    expect(overlay).toHaveAttribute('role', 'alert');
    expect(overlay).toHaveAttribute('aria-live', 'assertive');
  });
});
