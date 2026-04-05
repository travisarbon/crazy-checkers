import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GameClock from './GameClock';
import { PieceColor } from '../engine/types';

describe('GameClock', () => {
  const defaultProps = {
    color: PieceColor.White,
    timeDisplay: '05:00',
    isActive: false,
    isLowTime: false,
    modeIndicator: null,
  };

  it('renders formatted time for White', () => {
    render(<GameClock {...defaultProps} />);
    const clock = screen.getByTestId('game-clock-white');
    expect(clock).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('renders formatted time for Black', () => {
    render(<GameClock {...defaultProps} color={PieceColor.Black} timeDisplay="04:32" />);
    const clock = screen.getByTestId('game-clock-black');
    expect(clock).toBeInTheDocument();
    expect(screen.getByText('04:32')).toBeInTheDocument();
  });

  it('active player clock has active styling', () => {
    render(<GameClock {...defaultProps} isActive={true} />);
    const clock = screen.getByTestId('game-clock-white');
    expect(clock).toHaveAttribute('data-active', 'true');
  });

  it('inactive player clock does not have active attribute', () => {
    render(<GameClock {...defaultProps} isActive={false} />);
    const clock = screen.getByTestId('game-clock-white');
    expect(clock).not.toHaveAttribute('data-active');
  });

  it('low-time triggers warning data attribute', () => {
    render(<GameClock {...defaultProps} isLowTime={true} timeDisplay="15.3" />);
    const clock = screen.getByTestId('game-clock-white');
    expect(clock).toHaveAttribute('data-low-time', 'true');
  });

  it('mode indicator shows "+Ns" for increment', () => {
    render(<GameClock {...defaultProps} modeIndicator="+2s" />);
    expect(screen.getByText('+2s')).toBeInTheDocument();
  });

  it('mode indicator shows "delay Ns" for delay', () => {
    render(<GameClock {...defaultProps} modeIndicator="delay 5s" />);
    expect(screen.getByText('delay 5s')).toBeInTheDocument();
  });

  it('no mode indicator rendered when null', () => {
    render(<GameClock {...defaultProps} modeIndicator={null} />);
    expect(screen.queryByText(/\+\d+s/)).not.toBeInTheDocument();
    expect(screen.queryByText(/delay/)).not.toBeInTheDocument();
  });

  it('hidden prop renders nothing', () => {
    const { container } = render(<GameClock {...defaultProps} hidden={true} />);
    expect(container.innerHTML).toBe('');
  });

  it('expired clock shows "0.0"', () => {
    render(<GameClock {...defaultProps} timeDisplay="0.0" isLowTime={false} />);
    expect(screen.getByText('0.0')).toBeInTheDocument();
  });

  it('has aria-label with player name and time', () => {
    render(<GameClock {...defaultProps} timeDisplay="05:00" />);
    const clock = screen.getByTestId('game-clock-white');
    expect(clock).toHaveAttribute('aria-label', expect.stringContaining("White's remaining time"));
    expect(clock).toHaveAttribute('aria-label', expect.stringContaining('5 minutes'));
  });

  it('has role="timer" on the time display', () => {
    render(<GameClock {...defaultProps} />);
    const timer = screen.getByRole('timer');
    expect(timer).toBeInTheDocument();
    expect(timer).toHaveTextContent('05:00');
  });

  it('displays player label', () => {
    render(<GameClock {...defaultProps} />);
    expect(screen.getByText('White')).toBeInTheDocument();
  });

  it('displays Black player label', () => {
    render(<GameClock {...defaultProps} color={PieceColor.Black} />);
    expect(screen.getByText('Black')).toBeInTheDocument();
  });

  it('renders an SVG color swatch', () => {
    const { container } = render(<GameClock {...defaultProps} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });
});
