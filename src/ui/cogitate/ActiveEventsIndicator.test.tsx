import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActiveEventsIndicator from './ActiveEventsIndicator';
import type { SerializedActiveEvent } from '../../persistence/serialization';
import { CrazyEvent, PieceColor } from '../../engine/types';

function ev(
  type: CrazyEvent,
  remainingPlies: number,
  overrides: Partial<SerializedActiveEvent> = {},
): SerializedActiveEvent {
  return {
    type,
    remainingPlies,
    triggeredBy: PieceColor.White,
    triggeredAtPly: 0,
    ...overrides,
  };
}

describe('ActiveEventsIndicator (cogitate)', () => {
  it('returns null for classic mode regardless of events', () => {
    const { container } = render(
      <ActiveEventsIndicator
        events={[ev(CrazyEvent.KingForADay, 4)]}
        gameMode="classic"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when events array is empty', () => {
    const { container } = render(
      <ActiveEventsIndicator events={[]} gameMode="crazy" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a single timed event with turn count', () => {
    render(
      <ActiveEventsIndicator
        events={[ev(CrazyEvent.KingForADay, 4)]}
        gameMode="crazy"
      />,
    );
    const pills = screen.getAllByTestId('cogitate-active-event-pill');
    expect(pills.length).toBe(1);
    expect(pills[0]?.textContent).toContain('King for a Day');
    expect(pills[0]?.textContent).toContain('2 turns left');
    expect(pills[0]?.getAttribute('data-permanent')).toBe('false');
  });

  it('renders multiple simultaneous events', () => {
    render(
      <ActiveEventsIndicator
        events={[
          ev(CrazyEvent.LiveGrenade, -1),
          ev(CrazyEvent.HotPotato, 6),
        ]}
        gameMode="chaos"
      />,
    );
    expect(screen.getAllByTestId('cogitate-active-event-pill').length).toBe(2);
  });

  it('shows permanent label for Choice-mode permanent events', () => {
    render(
      <ActiveEventsIndicator
        events={[ev(CrazyEvent.KingForADay, -1)]}
        gameMode="choice-1"
      />,
    );
    const pill = screen.getByTestId('cogitate-active-event-pill');
    expect(pill.textContent).toContain('permanent');
    expect(pill.getAttribute('data-permanent')).toBe('true');
  });

  it('formats duration compactly in compact mode', () => {
    render(
      <ActiveEventsIndicator
        events={[ev(CrazyEvent.KingForADay, 4)]}
        gameMode="crazy"
        compact
      />,
    );
    const pill = screen.getByTestId('cogitate-active-event-pill');
    expect(pill.textContent).toContain('2t');
  });

  it('sets status role and aria-live polite for announcements', () => {
    render(
      <ActiveEventsIndicator
        events={[ev(CrazyEvent.KingForADay, 4)]}
        gameMode="crazy"
      />,
    );
    const container = screen.getByTestId('cogitate-active-events');
    expect(container.getAttribute('role')).toBe('status');
    expect(container.getAttribute('aria-live')).toBe('polite');
  });

  it('includes turn count in aria-label of timed pill', () => {
    render(
      <ActiveEventsIndicator
        events={[ev(CrazyEvent.KingForADay, 4)]}
        gameMode="crazy"
      />,
    );
    const pill = screen.getByTestId('cogitate-active-event-pill');
    expect(pill.getAttribute('aria-label')).toMatch(/2 turns remaining/);
  });
});
