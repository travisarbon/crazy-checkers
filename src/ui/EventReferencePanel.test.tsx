import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EventReferencePanel from './EventReferencePanel';

describe('EventReferencePanel', () => {
  it('renders 40-event table', () => {
    render(<EventReferencePanel />);
    const table = screen.getByTestId('event-table');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(40);
  });

  it('event names from data', () => {
    render(<EventReferencePanel />);
    expect(screen.getAllByText(/King for a Day/i).length).toBeGreaterThanOrEqual(1);
  });

  it('intro content rendered', () => {
    render(<EventReferencePanel introContent={<p>Custom intro</p>} />);
    expect(screen.getByText('Custom intro')).toBeInTheDocument();
  });

  it('no intro content', () => {
    render(<EventReferencePanel />);
    expect(screen.queryByText('Custom intro')).not.toBeInTheDocument();
  });

  it('event card expandable', () => {
    render(<EventReferencePanel />);
    // Find the first event card toggle button (contains event name)
    const toggles = screen.getAllByRole('button', { name: /King for a Day/i });
    fireEvent.click(toggles[0] as HTMLElement);
    // Text appears in both table and expanded card
    expect(screen.getAllByText(/temporarily become kings/i).length).toBeGreaterThanOrEqual(2);
  });

  it('interaction overview present', () => {
    render(<EventReferencePanel />);
    expect(screen.getByText(/Event Stacking/i)).toBeInTheDocument();
  });
});
