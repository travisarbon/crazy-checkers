import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GalleryDialogBox from './GalleryDialogBox';

function renderDialog(overrides?: Partial<{
  title: string;
  description: string;
  onPlay: () => void;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}>) {
  const onPlay = overrides?.onPlay ?? vi.fn();
  const onClose = overrides?.onClose ?? vi.fn();
  return {
    onPlay,
    onClose,
    ...render(
      <GalleryDialogBox
        title={overrides?.title ?? 'Test Dialog'}
        visualization={<div data-testid="test-viz">Viz</div>}
        description={overrides?.description ?? 'Test description'}
        onPlay={onPlay}
        onClose={onClose}
        onNext={overrides?.onNext}
        onPrevious={overrides?.onPrevious}
        ariaLabel="Test gallery dialog"
      />,
    ),
  };
}

describe('GalleryDialogBox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title and description', () => {
    renderDialog({ title: 'My Title', description: 'My description' });
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My description')).toBeInTheDocument();
  });

  it('renders visualization', () => {
    renderDialog();
    expect(screen.getByTestId('test-viz')).toBeInTheDocument();
  });

  it('play button calls onPlay', () => {
    const onPlay = vi.fn();
    renderDialog({ onPlay });
    fireEvent.click(screen.getByTestId('gallery-play'));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('overlay click calls onClose', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByTestId('gallery-overlay'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('escape calls onClose', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('previous button shown when onPrevious provided', () => {
    renderDialog({ onPrevious: vi.fn() });
    expect(screen.getByRole('button', { name: 'Previous item' })).toBeInTheDocument();
  });

  it('previous button hidden when onPrevious undefined', () => {
    renderDialog();
    expect(screen.queryByRole('button', { name: 'Previous item' })).not.toBeInTheDocument();
  });

  it('next button shown when onNext provided', () => {
    renderDialog({ onNext: vi.fn() });
    expect(screen.getByRole('button', { name: 'Next item' })).toBeInTheDocument();
  });

  it('next button hidden when onNext undefined', () => {
    renderDialog();
    expect(screen.queryByRole('button', { name: 'Next item' })).not.toBeInTheDocument();
  });

  it('left arrow calls onPrevious', () => {
    const onPrevious = vi.fn();
    renderDialog({ onPrevious });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it('right arrow calls onNext', () => {
    const onNext = vi.fn();
    renderDialog({ onNext });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('dialog has correct ARIA', () => {
    renderDialog();
    const dialog = screen.getByTestId('gallery-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Test gallery dialog');
  });

  it('scroll lock applied on mount', () => {
    renderDialog();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('focus on Play after mount', () => {
    renderDialog();
    act(() => { vi.advanceTimersByTime(100); });
    expect(document.activeElement).toBe(screen.getByTestId('gallery-play'));
  });
});
