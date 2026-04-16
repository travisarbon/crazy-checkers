import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SquareBoardRenderer } from './SquareBoardRenderer';
import { squareGeometry, asNodeId, darkSquaresOnly } from '../../engine/boardGeometry';
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

describe('SquareBoardRenderer — Tier 1 sizes (Task 28.4)', () => {
  const emptyState: ClassifiedGameState = { pieces: new Map() };
  const GEOM_8_DARK = squareGeometry({
    size: 8,
    indexing: 'squares',
    playableMask: darkSquaresOnly,
    variant: 'pdn-8',
  });
  const GEOM_10_DARK = squareGeometry({
    size: 10,
    indexing: 'squares',
    playableMask: darkSquaresOnly,
    variant: 'pdn-10',
  });
  const GEOM_12_DARK = squareGeometry({
    size: 12,
    indexing: 'squares',
    playableMask: darkSquaresOnly,
    variant: 'pdn-12',
  });
  const GEOM_8_FULL = squareGeometry({ size: 8, indexing: 'squares' });

  it.each([
    [GEOM_8_DARK, 8],
    [GEOM_10_DARK, 10],
    [GEOM_12_DARK, 12],
    [GEOM_8_FULL, 8],
  ] as const)('renders the expected number of cells for size %p', (geom, size) => {
    const { container } = render(
      <SquareBoardRenderer
        geometry={geom}
        state={emptyState}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="interactive"
        ariaLabel="sized"
      />,
    );
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(size * size);
  });

  it('emits a data-board-size attribute reflecting cols×rows', () => {
    const { getByTestId } = render(
      <SquareBoardRenderer
        geometry={GEOM_10_DARK}
        state={emptyState}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="interactive"
        ariaLabel="sized"
      />,
    );
    expect(getByTestId('square-board-renderer').getAttribute('data-board-size')).toBe('10x10');
  });

  it('renders PDN glyphs only on the 32 dark squares for GEOM_8_DARK', () => {
    const { container } = render(
      <SquareBoardRenderer
        geometry={GEOM_8_DARK}
        state={emptyState}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="interactive"
        ariaLabel="dark"
      />,
    );
    expect(container.querySelectorAll('[data-coord-node]')).toHaveLength(32);
  });

  it('renders 50 PDN glyphs at 10×10 dark', () => {
    const { container } = render(
      <SquareBoardRenderer
        geometry={GEOM_10_DARK}
        state={emptyState}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="interactive"
        ariaLabel="ten"
      />,
    );
    expect(container.querySelectorAll('[data-coord-node]')).toHaveLength(50);
  });

  it('renders 72 PDN glyphs at 12×12 dark', () => {
    const { container } = render(
      <SquareBoardRenderer
        geometry={GEOM_12_DARK}
        state={emptyState}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="interactive"
        ariaLabel="twelve"
      />,
    );
    expect(container.querySelectorAll('[data-coord-node]')).toHaveLength(72);
  });

  it('renders algebraic glyphs on all 64 squares for GEOM_8_FULL', () => {
    const { container } = render(
      <SquareBoardRenderer
        geometry={GEOM_8_FULL}
        state={emptyState}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="interactive"
        ariaLabel="full"
      />,
    );
    expect(container.querySelectorAll('[data-coord-node]')).toHaveLength(64);
  });

  it('omits the coordinate-glyph layer in preview mode', () => {
    const { container } = render(
      <SquareBoardRenderer
        geometry={GEOM_8_DARK}
        state={emptyState}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="preview"
        ariaLabel="preview"
      />,
    );
    expect(container.querySelectorAll('[data-coord-node]')).toHaveLength(0);
  });

  it('swaps PDN glyph to algebraic on hover-enter', () => {
    const { container } = render(
      <SquareBoardRenderer
        geometry={GEOM_8_DARK}
        state={emptyState}
        selection={EMPTY_SELECTION}
        theme={CURRENT_THEME}
        mode="interactive"
        ariaLabel="hover"
      />,
    );
    // Pre-hover: PDN "1" appears at the first dark square (node id 1).
    const glyph = container.querySelector('[data-coord-node="1"]');
    expect(glyph?.textContent).toBe('1');

    // Trigger hover-enter on the matching hit target.
    const hit = container.querySelector('[data-node="1"]');
    if (!hit) throw new Error('no hit target for node 1');
    fireEvent.mouseEnter(hit);

    expect(container.querySelector('[data-coord-node="1"]')?.textContent).toBe('b8');
  });
});
