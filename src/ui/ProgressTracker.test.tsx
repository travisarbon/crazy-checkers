import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProgressTracker from './ProgressTracker';
import type { Milestone } from './ProgressTracker';

const sampleMilestones: Milestone[] = [
  { name: 'Bronze', threshold: 25, completed: true },
  { name: 'Silver', threshold: 50, completed: true },
  { name: 'Gold', threshold: 75, completed: false },
];

describe('ProgressTracker', () => {
  it('renders track name', () => {
    render(
      <ProgressTracker trackName="Wins" milestones={[]} currentValue={0} maxValue={100} />,
    );
    expect(screen.getByText('Wins')).toBeInTheDocument();
  });

  it('bar fill width at 50%', () => {
    const { container } = render(
      <ProgressTracker trackName="Wins" milestones={[]} currentValue={50} maxValue={100} />,
    );
    const fill = container.querySelector('[role="progressbar"]') as HTMLElement;
    expect(fill.style.width).toBe('50%');
  });

  it('zero progress', () => {
    const { container } = render(
      <ProgressTracker trackName="Wins" milestones={[]} currentValue={0} maxValue={100} />,
    );
    const fill = container.querySelector('[role="progressbar"]') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('full progress', () => {
    const { container } = render(
      <ProgressTracker trackName="Wins" milestones={[]} currentValue={100} maxValue={100} />,
    );
    const fill = container.querySelector('[role="progressbar"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('percentage label', () => {
    render(
      <ProgressTracker trackName="Wins" milestones={[]} currentValue={42} maxValue={100} />,
    );
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('milestones rendered', () => {
    render(
      <ProgressTracker trackName="Wins" milestones={sampleMilestones} currentValue={60} maxValue={100} />,
    );
    expect(screen.getByText('Bronze')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('completed milestone marker', () => {
    render(
      <ProgressTracker trackName="Wins" milestones={sampleMilestones} currentValue={60} maxValue={100} />,
    );
    const bronzeMarker = screen.getByLabelText('Bronze: completed');
    expect(bronzeMarker).toBeInTheDocument();
    expect(bronzeMarker.textContent).toContain('✓');
  });

  it('incomplete milestone marker', () => {
    render(
      <ProgressTracker trackName="Wins" milestones={sampleMilestones} currentValue={60} maxValue={100} />,
    );
    const goldMarker = screen.getByLabelText('Gold: not yet reached');
    expect(goldMarker).toBeInTheDocument();
    expect(goldMarker.textContent).toContain('○');
  });

  it('progressbar ARIA role', () => {
    const { container } = render(
      <ProgressTracker trackName="Wins" milestones={[]} currentValue={50} maxValue={100} />,
    );
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('milestone aria-labels', () => {
    render(
      <ProgressTracker trackName="Wins" milestones={sampleMilestones} currentValue={60} maxValue={100} />,
    );
    expect(screen.getByLabelText('Bronze: completed')).toBeInTheDocument();
    expect(screen.getByLabelText('Gold: not yet reached')).toBeInTheDocument();
  });

  it('custom accent color', () => {
    const { container } = render(
      <ProgressTracker trackName="Wins" milestones={[]} currentValue={50} maxValue={100} accentColor="#ff0000" />,
    );
    const fill = container.querySelector('[role="progressbar"]') as HTMLElement;
    expect(fill.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('division by zero protection', () => {
    render(
      <ProgressTracker trackName="Wins" milestones={[]} currentValue={0} maxValue={0} />,
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
