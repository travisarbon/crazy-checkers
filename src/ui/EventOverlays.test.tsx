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


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_STATE: EventOverlayState = {
  temporaryKingSquares: new Set(),
  liveGrenadeActive: false,
  hotPotatoSquares: new Set(),
  oppositeDayActive: false,
  upInTheAirActive: false,
  noTouchingActive: false,
  restrictedCaptureSquares: new Set(),
  guardedKingSquares: new Set(),
  quicksandActive: false,
  frozenAssetsActive: false,
  safeHavenActive: false,
  promotionPartyActive: false,
  forcedMarchSquare: null,
  royalDecreeActive: false,
  sentryPinLines: [],
  ghostWalkActive: false,
  landmineSquares: new Set(),
  doubleTimeActive: false,
  wormholePortals: [],
  timeBombState: null,
  backfireActive: false,
  flippedScriptActive: false,
  marchingOrdersActive: false,
  marchingOrdersGrid: null,
  hauntedGhosts: [],
  shrinkingBoardRemovedSquares: new Set(),
  shrinkingBoardRingLevel: 0,
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
    const { container } = renderOverlays({ hotPotatoSquares: new Set([14]) });
    expect(container.querySelector('[data-testid="hot-potato-indicator"]')).not.toBeNull();
  });

  it('renders Opposite Day indicator when active', () => {
    const { container } = renderOverlays({ oppositeDayActive: true });
    expect(container.querySelector('[data-testid="opposite-day-indicator"]')).not.toBeNull();
  });

  it('renders all three indicators simultaneously', () => {
    const { container } = renderOverlays({
      liveGrenadeActive: true,
      hotPotatoSquares: new Set([14]),
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

  it('does not render Hot Potato indicator when hotPotatoSquares is empty', () => {
    const { container } = renderOverlays({ liveGrenadeActive: true });
    expect(container.querySelector('[data-testid="hot-potato-indicator"]')).toBeNull();
  });

  it('applies speed multiplier to CSS custom property for Live Grenade pulse', () => {
    const state = { ...EMPTY_STATE, liveGrenadeActive: true };
    const { container } = render(
      <svg>
        <EventOverlays
          viewBoxWidth={800}
          flipped={false}
          overlayState={state}
          speedMultiplier={2}
        />
      </svg>,
    );
    const indicator = container.querySelector('[data-testid="live-grenade-indicator"]');
    expect(indicator).not.toBeNull();
    const style = (indicator as SVGElement).style;
    expect(style.getPropertyValue('--pulse-duration')).toBe('2400ms');
  });

  it('renders Hot Potato indicator at correct square coordinates when flipped', () => {
    const state = { ...EMPTY_STATE, hotPotatoSquares: new Set([1]) };
    const { container: normalContainer } = render(
      <svg>
        <EventOverlays
          viewBoxWidth={800}
          flipped={false}
          overlayState={state}
          speedMultiplier={1}
        />
      </svg>,
    );
    const { container: flippedContainer } = render(
      <svg>
        <EventOverlays
          viewBoxWidth={800}
          flipped={true}
          overlayState={state}
          speedMultiplier={1}
        />
      </svg>,
    );
    const normalCircle = normalContainer.querySelector('[data-testid="hot-potato-indicator"] circle');
    const flippedCircle = flippedContainer.querySelector('[data-testid="hot-potato-indicator"] circle');
    expect(normalCircle).not.toBeNull();
    expect(flippedCircle).not.toBeNull();
    // cx should be the same (same column), cy should differ (flipped row)
    const normalCy = normalCircle?.getAttribute('cy');
    const flippedCy = flippedCircle?.getAttribute('cy');
    expect(normalCy).not.toBe(flippedCy);
  });
});
