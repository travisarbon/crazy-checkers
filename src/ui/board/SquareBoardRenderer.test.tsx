import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SquareBoardRenderer } from './SquareBoardRenderer';
import { squareGeometry, asNodeId } from '../../engine/boardGeometry';
import type { ClassifiedGameState } from '../../engine/classified/state';
import { EMPTY_SELECTION } from './types';
import { currentTheme as CURRENT_THEME } from '../../themes/current';

describe('SquareBoardRenderer', () => {
  const geometry = squareGeometry({ size: 8, indexing: 'squares' });
  const emptyState: ClassifiedGameState = { pieces: new Map() };

  it('renders an interactive 8x8 board with pieces', () => {
    const pieces = new Map();
    pieces.set(asNodeId(0), { owner: 'black', kind: 'man' });
    pieces.set(asNodeId(63), { owner: 'white', kind: 'man' });
    const { getByTestId } = render(
      <SquareBoardRenderer
        geometry={geometry}
        state={{ pieces }}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="interactive"
        ariaLabel="test-board"
      />,
    );
    expect(getByTestId('square-board-renderer')).toBeTruthy();
    expect(getByTestId('piece-layer')).toBeTruthy();
    expect(getByTestId('interaction-layer')).toBeTruthy();
  });

  it('suppresses interaction layer in preview mode', () => {
    const { queryByTestId } = render(
      <SquareBoardRenderer
        geometry={geometry}
        state={emptyState}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="preview"
        ariaLabel="preview-board"
      />,
    );
    expect(queryByTestId('interaction-layer')).toBeNull();
  });

  it('dispatches click on node', () => {
    const handler = vi.fn();
    const { container } = render(
      <SquareBoardRenderer
        geometry={geometry}
        state={emptyState}
        selection={EMPTY_SELECTION}
        onNodeInteract={handler}
        theme={CURRENT_THEME}
        mode="interactive"
        ariaLabel="clickable-board"
      />,
    );
    const rects = container.querySelectorAll('[data-node]');
    expect(rects.length).toBeGreaterThan(0);
    const first = rects[0];
    if (!first) throw new Error('no hit targets');
    fireEvent.click(first);
    expect(handler).toHaveBeenCalledWith(expect.anything(), 'click');
  });
});
