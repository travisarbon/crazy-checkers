/**
 * Task 11.3 — EventOverlays: Component rendering tests.
 *
 * Verifies that each persistent event indicator renders when its event
 * is active and doesn't render when inactive.
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EventOverlays from './EventOverlays';
import type { EventOverlayState } from './useEventOverlays';
import { square } from '../engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_STATE: EventOverlayState = {
  temporaryKingSquares: new Set(),
  liveGrenadeActive: false,
  hotPieceSquare: null,
  oppositeDayActive: false,
  upInTheAirActive: false,
  noTouchingActive: false,
  restrictedCaptureSquares: new Set(),
};

function renderOverlays(overlayState: Partial<EventOverlayState> = {}) {
  const state = { ...EMPTY_STATE, ...overlayState };
  return render(
    <svg>
      <EventOverlays
        viewBoxWidth={800}
        flipped={false}
        overlayState={state}
        speedMultiplier={1}
      />
    </svg>,
  );
}

// ===========================================================================
// Tests
// ===========================================================================

describe('EventOverlays', () => {
  it('returns null when no indicators are active', () => {
    const { container } = renderOverlays();
    expect(container.querySelector('[data-testid="event-overlays"]')).toBeNull();
  });

  it('renders Live Grenade indicator when active', () => {
    const { container } = renderOverlays({ liveGrenadeActive: true });
    expect(container.querySelector('[data-testid="live-grenade-indicator"]')).not.toBeNull();
  });

  it('renders Hot Potato indicator when active', () => {
    const { container } = renderOverlays({ hotPieceSquare: square(14) });
    expect(container.querySelector('[data-testid="hot-potato-indicator"]')).not.toBeNull();
  });

  it('renders Opposite Day indicator when active', () => {
    const { container } = renderOverlays({ oppositeDayActive: true });
    expect(container.querySelector('[data-testid="opposite-day-indicator"]')).not.toBeNull();
  });

  it('renders all three indicators simultaneously', () => {
    const { container } = renderOverlays({
      liveGrenadeActive: true,
      hotPieceSquare: square(14),
      oppositeDayActive: true,
    });
    expect(container.querySelector('[data-testid="live-grenade-indicator"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="hot-potato-indicator"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="opposite-day-indicator"]')).not.toBeNull();
  });

  it('root element has aria-hidden="true"', () => {
    const { container } = renderOverlays({ liveGrenadeActive: true });
    const root = container.querySelector('[data-testid="event-overlays"]');
    expect(root?.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not render Live Grenade indicator when inactive', () => {
    const { container } = renderOverlays({ oppositeDayActive: true });
    expect(container.querySelector('[data-testid="live-grenade-indicator"]')).toBeNull();
  });

  it('does not render Hot Potato indicator when hotPieceSquare is null', () => {
    const { container } = renderOverlays({ liveGrenadeActive: true });
    expect(container.querySelector('[data-testid="hot-potato-indicator"]')).toBeNull();
  });
});
