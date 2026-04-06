import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EventDiagram from './EventDiagram';
import { CrazyEvent } from '../engine/types';
import { createInitialBoard } from '../engine/board';
import { EVENT_DISPLAY_NAMES, EVENT_FLAVOR_TEXT } from '../engine/events';

const startingBoard = createInitialBoard();

describe('EventDiagram', () => {
  it('renders event name', () => {
    render(
      <EventDiagram eventType={CrazyEvent.KingForADay} beforePosition={startingBoard} />,
    );
    expect(screen.getByText(EVENT_DISPLAY_NAMES[CrazyEvent.KingForADay])).toBeInTheDocument();
  });

  it('renders flavor text', () => {
    render(
      <EventDiagram eventType={CrazyEvent.KingForADay} beforePosition={startingBoard} />,
    );
    expect(screen.getByText(EVENT_FLAVOR_TEXT[CrazyEvent.KingForADay])).toBeInTheDocument();
  });

  it('single board mode when no afterPosition', () => {
    const { container } = render(
      <EventDiagram eventType={CrazyEvent.KingForADay} beforePosition={startingBoard} />,
    );
    const svgs = container.querySelectorAll('svg[role="img"]');
    expect(svgs).toHaveLength(1);
  });

  it('before/after mode with two boards', () => {
    const { container } = render(
      <EventDiagram
        eventType={CrazyEvent.KingForADay}
        beforePosition={startingBoard}
        afterPosition={startingBoard}
      />,
    );
    const svgs = container.querySelectorAll('svg[role="img"]');
    expect(svgs).toHaveLength(2);
  });

  it('highlight squares passed through', () => {
    const { container } = render(
      <EventDiagram
        eventType={CrazyEvent.KingForADay}
        beforePosition={startingBoard}
        highlightSquares={[1, 5]}
      />,
    );
    expect(container.querySelector('[data-testid="highlight-1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="highlight-5"]')).toBeInTheDocument();
  });

  it('annotations rendered', () => {
    const { container } = render(
      <EventDiagram
        eventType={CrazyEvent.KingForADay}
        beforePosition={startingBoard}
        annotations={[{ square: 1, text: 'Promoted!', side: 'before' }]}
      />,
    );
    expect(container.querySelector('[data-testid="annotation-before-1"]')).toBeInTheDocument();
    expect(screen.getByText('Promoted!')).toBeInTheDocument();
  });

  it('figure role', () => {
    render(
      <EventDiagram eventType={CrazyEvent.KingForADay} beforePosition={startingBoard} />,
    );
    expect(screen.getByTestId('event-diagram')).toHaveAttribute('role', 'figure');
  });

  it('aria label', () => {
    render(
      <EventDiagram eventType={CrazyEvent.KingForADay} beforePosition={startingBoard} />,
    );
    const diagram = screen.getByTestId('event-diagram');
    expect(diagram.getAttribute('aria-label')).toContain('King for a Day');
  });
});
