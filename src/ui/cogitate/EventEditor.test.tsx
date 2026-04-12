import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventEditor from './EventEditor';
import { CrazyEvent, PieceColor } from '../../engine/types';
import type { ActiveEvent } from '../../engine/types';

describe('EventEditor', () => {
  it('returns null for classic mode', () => {
    const { container } = render(
      <EventEditor activeEvents={[]} onEventsChange={vi.fn()} modeId="classic" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders for crazy mode', () => {
    render(<EventEditor activeEvents={[]} onEventsChange={vi.fn()} modeId="crazy" />);
    expect(screen.getByTestId('event-editor')).toBeInTheDocument();
  });

  it('renders for chaos mode', () => {
    render(<EventEditor activeEvents={[]} onEventsChange={vi.fn()} modeId="chaos" />);
    expect(screen.getByTestId('event-editor')).toBeInTheDocument();
  });

  it('toggles an event on when clicked', () => {
    const onChange = vi.fn();
    render(<EventEditor activeEvents={[]} onEventsChange={onChange} modeId="crazy" />);
    fireEvent.click(screen.getByTestId(`event-toggle-${CrazyEvent.HotPotato}`));
    const call = onChange.mock.calls[0]?.[0] as readonly ActiveEvent[];
    expect(call).toHaveLength(1);
    expect(call[0]?.type).toBe(CrazyEvent.HotPotato);
    expect(call[0]?.remainingPlies).toBe(-1);
  });

  it('toggles an active event off', () => {
    const active: ActiveEvent = {
      type: CrazyEvent.HotPotato,
      remainingPlies: -1,
      triggeredBy: PieceColor.White,
      triggeredAtPly: 0,
    };
    const onChange = vi.fn();
    render(
      <EventEditor
        activeEvents={[active]}
        onEventsChange={onChange}
        modeId="crazy"
      />,
    );
    fireEvent.click(screen.getByTestId(`event-toggle-${CrazyEvent.HotPotato}`));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('filters events by search query', () => {
    render(<EventEditor activeEvents={[]} onEventsChange={vi.fn()} modeId="crazy" />);
    fireEvent.change(screen.getByTestId('event-editor-filter'), {
      target: { value: 'hot' },
    });
    expect(screen.getByTestId(`event-toggle-${CrazyEvent.HotPotato}`)).toBeInTheDocument();
    expect(
      screen.queryByTestId(`event-toggle-${CrazyEvent.KingForADay}`),
    ).toBeNull();
  });

  it('clear-all disabled when empty', () => {
    render(<EventEditor activeEvents={[]} onEventsChange={vi.fn()} modeId="crazy" />);
    expect(screen.getByTestId('event-editor-clear-all')).toBeDisabled();
  });

  it('clear-all fires onEventsChange with empty array', () => {
    const active: ActiveEvent = {
      type: CrazyEvent.HotPotato,
      remainingPlies: -1,
      triggeredBy: PieceColor.White,
      triggeredAtPly: 0,
    };
    const onChange = vi.fn();
    render(
      <EventEditor
        activeEvents={[active]}
        onEventsChange={onChange}
        modeId="crazy"
      />,
    );
    fireEvent.click(screen.getByTestId('event-editor-clear-all'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('excludes DoubleTrouble from the list', () => {
    render(<EventEditor activeEvents={[]} onEventsChange={vi.fn()} modeId="crazy" />);
    expect(
      screen.queryByTestId(`event-toggle-${CrazyEvent.DoubleTrouble}`),
    ).toBeNull();
  });
});
