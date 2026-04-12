import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DiagramToolbar from './DiagramToolbar';

function renderToolbar(overrides: Partial<React.ComponentProps<typeof DiagramToolbar>> = {}) {
  const props: React.ComponentProps<typeof DiagramToolbar> = {
    activeTool: null,
    onToolChange: vi.fn(),
    activeColor: 'green',
    onColorChange: vi.fn(),
    hasOverlays: false,
    onClearAll: vi.fn(),
    onExportPNG: vi.fn(),
    isExporting: false,
    ...overrides,
  };
  render(<DiagramToolbar {...props} />);
  return props;
}

describe('DiagramToolbar', () => {
  it('renders tool, color, clear, and export buttons', () => {
    renderToolbar();
    expect(screen.getByTestId('diagram-tool-arrow')).toBeInTheDocument();
    expect(screen.getByTestId('diagram-tool-highlight')).toBeInTheDocument();
    expect(screen.getByTestId('diagram-tool-annotation')).toBeInTheDocument();
    expect(screen.getByTestId('diagram-color-green')).toBeInTheDocument();
    expect(screen.getByTestId('diagram-clear')).toBeInTheDocument();
    expect(screen.getByTestId('diagram-export')).toBeInTheDocument();
  });

  it('fires onToolChange with the selected tool', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByTestId('diagram-tool-arrow'));
    expect(props.onToolChange).toHaveBeenCalledWith('arrow');
  });

  it('fires onToolChange(null) when clicking an active tool', () => {
    const props = renderToolbar({ activeTool: 'arrow' });
    fireEvent.click(screen.getByTestId('diagram-tool-arrow'));
    expect(props.onToolChange).toHaveBeenCalledWith(null);
  });

  it('fires onColorChange on color swatch click', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByTestId('diagram-color-red'));
    expect(props.onColorChange).toHaveBeenCalledWith('red');
  });

  it('disables clear when hasOverlays is false', () => {
    renderToolbar();
    const btn = screen.getByTestId('diagram-clear');
    expect(btn).toBeDisabled();
  });

  it('enables clear when hasOverlays is true', () => {
    renderToolbar({ hasOverlays: true });
    const btn = screen.getByTestId('diagram-clear');
    expect(btn).not.toBeDisabled();
  });

  it('fires onExportPNG when export button clicked', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByTestId('diagram-export'));
    expect(props.onExportPNG).toHaveBeenCalledTimes(1);
  });

  it('shows exporting state when isExporting is true', () => {
    renderToolbar({ isExporting: true });
    const btn = screen.getByTestId('diagram-export');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toContain('Exporting');
  });
});
