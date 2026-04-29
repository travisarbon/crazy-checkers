/**
 * P5.1 — EventIcon component coverage.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CrazyEvent } from '../engine/types';
import EventIcon from './EventIcon';

describe('EventIcon (P5.1, P5.5)', () => {
  it('renders a placeholder while the asset is loading', () => {
    render(<EventIcon eventType={CrazyEvent.KingForADay} />);
    const wrapper = screen.getByLabelText('King for a Day');
    expect(wrapper).toHaveAttribute('data-loaded', 'false');
  });

  it('mounts the icon SVG once the lazy loader resolves', async () => {
    render(<EventIcon eventType={CrazyEvent.KingForADay} />);
    await waitFor(
      () => {
        const wrapper = screen.getByLabelText('King for a Day');
        expect(wrapper).toHaveAttribute('data-loaded', 'true');
      },
      { timeout: 3000 },
    );
  });

  it('exposes the event type via data attribute for selectors', () => {
    render(<EventIcon eventType={CrazyEvent.LiveGrenade} />);
    const wrapper = screen.getByLabelText('Live Grenade');
    expect(wrapper).toHaveAttribute('data-event-type', CrazyEvent.LiveGrenade);
  });

  it('respects a custom size prop', () => {
    render(<EventIcon eventType={CrazyEvent.HotPotato} size={96} />);
    const wrapper = screen.getByLabelText('Hot Potato');
    expect(wrapper).toHaveStyle({ width: '96px', height: '96px' });
  });

  it('always carries the event-icon-thumbnail global class', () => {
    render(<EventIcon eventType={CrazyEvent.UpInTheAir} />);
    const wrapper = screen.getByLabelText('Up in the Air');
    expect(wrapper.className).toMatch(/event-icon-thumbnail/);
  });
});
