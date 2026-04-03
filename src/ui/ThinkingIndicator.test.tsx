import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ThinkingIndicator from './ThinkingIndicator';

describe('ThinkingIndicator', () => {
  it('renders three dot elements when isThinking is true', () => {
    render(<ThinkingIndicator isThinking={true} />);
    const container = screen.getByTestId('thinking-dots');
    const dots = container.querySelectorAll('span > span');
    expect(dots).toHaveLength(3);
  });

  it('renders nothing when isThinking is false', () => {
    render(<ThinkingIndicator isThinking={false} />);
    expect(screen.queryByTestId('thinking-dots')).toBeNull();
  });

  it('has aria-hidden="true" on the dots container', () => {
    render(<ThinkingIndicator isThinking={true} />);
    const container = screen.getByTestId('thinking-dots');
    expect(container.getAttribute('aria-hidden')).toBe('true');
  });
});
