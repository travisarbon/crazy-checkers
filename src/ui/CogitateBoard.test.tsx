import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CogitateBoard from './CogitateBoard';
import { createInitialBoard } from '../engine/board';
import { square } from '../engine/types';
import type { DiagramOverlayState } from '../cogitate/types';

describe('CogitateBoard', () => {
  it('renders the underlying Board component', () => {
    render(<CogitateBoard board={createInitialBoard()} />);
    expect(screen.getByTestId('cogitate-board')).toBeInTheDocument();
    expect(screen.getByTestId('board')).toBeInTheDocument();
  });

  it('does not render an overlay layer when overlays prop is null', () => {
    render(<CogitateBoard board={createInitialBoard()} />);
    expect(screen.queryByTestId('cogitate-board-overlay')).toBeNull();
  });

  it('renders overlay arrows when overlays.arrows is populated', () => {
    const overlays: DiagramOverlayState = {
      arrows: [{ from: square(11), to: square(15), color: 'green' }],
      highlights: [],
      annotations: [],
    };
    render(<CogitateBoard board={createInitialBoard()} overlays={overlays} />);
    expect(screen.getByTestId('cogitate-board-overlay')).toBeInTheDocument();
    expect(screen.getAllByTestId('cogitate-overlay-arrow').length).toBe(1);
  });

  it('renders highlight rectangles', () => {
    const overlays: DiagramOverlayState = {
      arrows: [],
      highlights: [
        { square: square(14), color: 'red' },
        { square: square(18), color: 'blue' },
      ],
      annotations: [],
    };
    render(<CogitateBoard board={createInitialBoard()} overlays={overlays} />);
    expect(screen.getAllByTestId('cogitate-overlay-highlight').length).toBe(2);
  });

  it('renders annotations', () => {
    const overlays: DiagramOverlayState = {
      arrows: [],
      highlights: [],
      annotations: [{ square: square(14), text: '!' }],
    };
    render(<CogitateBoard board={createInitialBoard()} overlays={overlays} />);
    const text = screen.getByTestId('cogitate-overlay-annotation');
    expect(text.textContent).toBe('!');
  });

  it('overlay SVG uses pointer-events: none via CSS module', () => {
    const overlays: DiagramOverlayState = {
      arrows: [{ from: square(11), to: square(15), color: 'green' }],
      highlights: [],
      annotations: [],
    };
    render(<CogitateBoard board={createInitialBoard()} overlays={overlays} />);
    const overlay = screen.getByTestId('cogitate-board-overlay');
    // CSS modules are class-based, so we verify the class is applied.
    expect(overlay.getAttribute('class') ?? '').toMatch(/overlaySvg/);
  });

  describe('editor mode (Task 21.5)', () => {
    it('sets data-editor-mode attribute', () => {
      render(
        <CogitateBoard
          board={createInitialBoard()}
          editorMode
        />,
      );
      expect(
        screen.getByTestId('cogitate-board').getAttribute('data-editor-mode'),
      ).toBe('true');
    });

    it('routes square clicks to onEditorSquareClick in editor mode', () => {
      const handler = vi.fn();
      render(
        <CogitateBoard
          board={createInitialBoard()}
          editorMode
          onEditorSquareClick={handler}
        />,
      );
      const cells = screen.getByTestId('board').querySelectorAll('[data-square]');
      expect(cells.length).toBeGreaterThan(0);
      const first = cells[0] as SVGElement;
      first.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(handler).toHaveBeenCalled();
    });

    it('renders valid placement indicators when provided', () => {
      const validSquares = new Set<number>([1, 2, 3]);
      render(
        <CogitateBoard
          board={createInitialBoard()}
          editorMode
          validPlacementSquares={validSquares}
        />,
      );
      expect(
        screen.getByTestId('valid-placement-indicators'),
      ).toBeInTheDocument();
    });

    it('does not render editor-mode attr when editorMode is false', () => {
      render(<CogitateBoard board={createInitialBoard()} />);
      expect(
        screen.getByTestId('cogitate-board').getAttribute('data-editor-mode'),
      ).toBeNull();
    });
  });
});
