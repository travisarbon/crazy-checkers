import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ExpandableDetailPanel from './ExpandableDetailPanel';

describe('ExpandableDetailPanel', () => {
  it('renders title', () => {
    render(
      <ExpandableDetailPanel title="Test Panel">
        <p>Content</p>
      </ExpandableDetailPanel>,
    );
    expect(screen.getByText('Test Panel')).toBeInTheDocument();
  });

  it('collapsed by default', () => {
    render(
      <ExpandableDetailPanel title="Panel">
        <p>Hidden content</p>
      </ExpandableDetailPanel>,
    );
    const toggle = screen.getByRole('button', { name: 'Panel' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands on click', () => {
    render(
      <ExpandableDetailPanel title="Panel">
        <p>Content</p>
      </ExpandableDetailPanel>,
    );
    const toggle = screen.getByRole('button', { name: 'Panel' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses on second click', () => {
    render(
      <ExpandableDetailPanel title="Panel">
        <p>Content</p>
      </ExpandableDetailPanel>,
    );
    const toggle = screen.getByRole('button', { name: 'Panel' });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('defaultExpanded=true starts expanded', () => {
    render(
      <ExpandableDetailPanel title="Panel" defaultExpanded>
        <p>Content</p>
      </ExpandableDetailPanel>,
    );
    const toggle = screen.getByRole('button', { name: 'Panel' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('summary shown when collapsed', () => {
    render(
      <ExpandableDetailPanel title="Panel" summary="Brief summary">
        <p>Content</p>
      </ExpandableDetailPanel>,
    );
    expect(screen.getByText('Brief summary')).toBeInTheDocument();
  });

  it('summary hidden when expanded', () => {
    render(
      <ExpandableDetailPanel title="Panel" summary="Brief summary" defaultExpanded>
        <p>Content</p>
      </ExpandableDetailPanel>,
    );
    expect(screen.queryByText('Brief summary')).not.toBeInTheDocument();
  });

  it('aria-controls links to panel', () => {
    render(
      <ExpandableDetailPanel title="Panel">
        <p>Content</p>
      </ExpandableDetailPanel>,
    );
    const toggle = screen.getByRole('button', { name: 'Panel' });
    const controlsId = toggle.getAttribute('aria-controls') ?? '';
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId)).toBeInTheDocument();
  });

  it('chevron has rotation class when expanded', () => {
    const { container } = render(
      <ExpandableDetailPanel title="Panel" defaultExpanded>
        <p>Content</p>
      </ExpandableDetailPanel>,
    );
    const chevron = container.querySelector('[aria-hidden="true"]');
    expect(chevron?.className).toContain('chevronExpanded');
  });

  it('custom ariaLabel', () => {
    render(
      <ExpandableDetailPanel title="Panel" ariaLabel="Show rules">
        <p>Content</p>
      </ExpandableDetailPanel>,
    );
    expect(screen.getByRole('button', { name: 'Show rules' })).toBeInTheDocument();
  });
});
