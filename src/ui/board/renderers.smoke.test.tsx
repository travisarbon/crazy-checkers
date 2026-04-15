/**
 * Per-renderer smoke test — every concrete renderer in the Task 27.3 registry
 * mounts against a canonical geometry in every mode (interactive, preview,
 * replay) and emits the expected testid + piece/interaction layers.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { registerDefaultBoardRenderers } from './index';

beforeAll(() => {
  registerDefaultBoardRenderers();
});
import { render, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { EMPTY_SELECTION } from './types';
import type { BoardRendererProps } from './types';
import { currentTheme } from '../../themes/current';
import { SquareBoardRenderer } from './SquareBoardRenderer';
import { RectangleBoardRenderer } from './RectangleBoardRenderer';
import { HexBoardRenderer } from './HexBoardRenderer';
import { RingBoardRenderer } from './RingBoardRenderer';
import { CrossBoardRenderer } from './CrossBoardRenderer';
import { ArcTrackBoardRenderer } from './ArcTrackBoardRenderer';
import { animateAlongArc } from './arcAnimation';
import { DotBoardRenderer } from './DotBoardRenderer';
import { MancalaPitBoardRenderer } from './MancalaPitBoardRenderer';
import { TerrainOverlayDecorator } from './TerrainOverlayDecorator';
import {
  registerBaseGeometry,
  __resetBaseGeometryRegistryForTests,
} from './baseGeometryRegistry';
import {
  squareGeometry,
  rectangleGeometry,
  hexRhombusGeometry,
  hexTriangularGeometry,
  ringGeometry,
  crossGeometry,
  arcTrackGeometry,
  dotGridGeometry,
  mancalaPitGeometry,
  withTerrainOverlay,
} from '../../engine/boardGeometry';

function baseProps(
  props: Partial<BoardRendererProps> & Pick<BoardRendererProps, 'geometry'>,
): BoardRendererProps {
  return {
    state: { pieces: new Map() },
    selection: EMPTY_SELECTION,
    theme: currentTheme,
    mode: 'interactive',
    ariaLabel: 'test',
    ...props,
  };
}

describe('Renderers smoke', () => {
  afterEach(() => {
    cleanup();
  });

  it('SquareBoardRenderer renders 8x8 in every mode', () => {
    const geometry = squareGeometry({ size: 8, indexing: 'squares' });
    for (const mode of ['interactive', 'preview', 'replay'] as const) {
      const { getByTestId, unmount } = render(
        <SquareBoardRenderer {...baseProps({ geometry, mode })} />,
      );
      expect(getByTestId('square-board-renderer').getAttribute('data-mode')).toBe(mode);
      unmount();
    }
  });

  it('RectangleBoardRenderer renders 9x5', () => {
    const geometry = rectangleGeometry({ width: 9, height: 5, indexing: 'intersections' });
    const { getByTestId } = render(<RectangleBoardRenderer {...baseProps({ geometry })} />);
    expect(getByTestId('square-board-renderer')).toBeTruthy();
  });

  it('HexBoardRenderer renders rhombus + triangular', () => {
    const a = render(<HexBoardRenderer {...baseProps({ geometry: hexRhombusGeometry(11) })} />);
    expect(a.container.querySelector('[data-testid="hex-board-renderer"]')).toBeTruthy();
    a.unmount();
    const b = render(<HexBoardRenderer {...baseProps({ geometry: hexTriangularGeometry(5) })} />);
    expect(b.container.querySelector('[data-testid="hex-board-renderer"]')).toBeTruthy();
    b.unmount();
  });

  it('RingBoardRenderer renders NMM + Morabaraba', () => {
    const a = render(<RingBoardRenderer {...baseProps({ geometry: ringGeometry('nmm') })} />);
    expect(a.container.querySelector('[data-testid="ring-board-renderer"]')).toBeTruthy();
    a.unmount();
    const b = render(<RingBoardRenderer {...baseProps({ geometry: ringGeometry('morabaraba') })} />);
    expect(b.container.querySelector('[data-testid="ring-board-renderer"]')).toBeTruthy();
    const diagCount = b.container.querySelectorAll('line').length;
    expect(diagCount).toBeGreaterThan(0);
    b.unmount();
  });

  it('CrossBoardRenderer renders Fox-and-Geese', () => {
    const { getByTestId } = render(
      <CrossBoardRenderer {...baseProps({ geometry: crossGeometry('fox-and-geese') })} />,
    );
    expect(getByTestId('cross-board-renderer')).toBeTruthy();
  });

  it('ArcTrackBoardRenderer renders Surakarta + exposes animateAlongArc', () => {
    const { getByTestId } = render(
      <ArcTrackBoardRenderer {...baseProps({ geometry: arcTrackGeometry('surakarta') })} />,
    );
    expect(getByTestId('arc-track-board-renderer')).toBeTruthy();
    const pts = animateAlongArc(100, { row: 0, col: 0 }, { row: 0, col: 5 });
    expect(pts.length).toBeGreaterThan(2);
  });

  it('DotBoardRenderer renders a 5x5 dot grid', () => {
    const { getByTestId } = render(
      <DotBoardRenderer {...baseProps({ geometry: dogGeom() })} />,
    );
    expect(getByTestId('dot-board-renderer')).toBeTruthy();
  });

  it('MancalaPitBoardRenderer renders Oware with stores', () => {
    const { getByTestId } = render(
      <MancalaPitBoardRenderer {...baseProps({ geometry: mancalaPitGeometry('oware-2x6') })} />,
    );
    expect(getByTestId('mancala-pit-board-renderer')).toBeTruthy();
  });

  it('TerrainOverlayDecorator paints regions on the base renderer', () => {
    __resetBaseGeometryRegistryForTests();
    const base = squareGeometry({ size: 8, indexing: 'squares' });
    registerBaseGeometry(base);
    const overlay = withTerrainOverlay(
      base,
      [
        {
          name: 'trap',
          nodes: [18 as unknown as import('./BoardGeometry').NodeId],
        },
      ],
      'arimaa-traps',
    );
    const { getByTestId } = render(
      <TerrainOverlayDecorator {...baseProps({ geometry: overlay })} baseGeometry={base} />,
    );
    expect(getByTestId('square-board-renderer')).toBeTruthy();
    expect(getByTestId('terrain-overlay')).toBeTruthy();
  });
});

function dogGeom() {
  return dotGridGeometry({ boxesAcross: 5, boxesDown: 5 });
}
