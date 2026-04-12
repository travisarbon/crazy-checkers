import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrincipalVariation from './PrincipalVariation';

describe('PrincipalVariation', () => {
  it('renders each notation token', () => {
    render(<PrincipalVariation pvNotation={['11-15', '22-18', '15x22']} />);
    expect(screen.getByText('11-15')).toBeInTheDocument();
    expect(screen.getByText('22-18')).toBeInTheDocument();
    expect(screen.getByText('15x22')).toBeInTheDocument();
  });

  it('alternates white/black styling', () => {
    render(<PrincipalVariation pvNotation={['a', 'b', 'c', 'd']} />);
    const first = screen.getByTestId('pv-move-0');
    const second = screen.getByTestId('pv-move-1');
    expect(first.className).not.toEqual(second.className);
  });

  it('truncates when above maxMoves', () => {
    render(<PrincipalVariation pvNotation={['1', '2', '3', '4', '5', '6']} maxMoves={3} />);
    expect(screen.queryByText('4')).not.toBeInTheDocument();
    expect(screen.getByTestId('principal-variation')).toHaveTextContent('…');
  });

  it('renders empty state when no moves given', () => {
    render(<PrincipalVariation pvNotation={[]} />);
    expect(screen.getByTestId('principal-variation-empty')).toBeInTheDocument();
  });

  it('exposes ARIA label with full variation', () => {
    render(<PrincipalVariation pvNotation={['a', 'b']} />);
    expect(screen.getByLabelText('Principal variation: a, b')).toBeInTheDocument();
  });
});
