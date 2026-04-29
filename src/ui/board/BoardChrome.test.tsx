/**
 * BoardChrome — geometry-driven ruler tests (Task 28.4 §7.3).
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BoardChrome } from './BoardChrome';
import { squareGeometry, darkSquaresOnly } from '../../engine/boardGeometry';

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

const GEOM_19 = squareGeometry({ size: 19, indexing: 'intersections' });

function fileLabels(container: HTMLElement): (string | null)[] {
  const fileRow = container.querySelectorAll<HTMLElement>('[class*="files"] > span');
  // Skip the spacer span which has class "filesSpacer".
  return Array.from(fileRow)
    .filter((el) => !el.className.includes('filesSpacer'))
    .map((el) => el.textContent);
}

function rankLabels(container: HTMLElement): (string | null)[] {
  const rankCol = container.querySelectorAll<HTMLElement>('[class*="ranks"] > span');
  return Array.from(rankCol).map((el) => el.textContent);
}

describe('BoardChrome rulers', () => {
  it('renders a..h / 8..1 for GEOM_8_DARK', () => {
    const { container } = render(
      <BoardChrome geometry={GEOM_8_DARK}>
        <div />
      </BoardChrome>,
    );
    expect(fileLabels(container)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(rankLabels(container)).toEqual(['8', '7', '6', '5', '4', '3', '2', '1']);
  });

  it('renders a..j / 10..1 for GEOM_10_DARK', () => {
    const { container } = render(
      <BoardChrome geometry={GEOM_10_DARK}>
        <div />
      </BoardChrome>,
    );
    expect(fileLabels(container)).toEqual([
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    ]);
    expect(rankLabels(container)).toEqual([
      '10', '9', '8', '7', '6', '5', '4', '3', '2', '1',
    ]);
  });

  it('renders a..l / 12..1 for GEOM_12_DARK', () => {
    const { container } = render(
      <BoardChrome geometry={GEOM_12_DARK}>
        <div />
      </BoardChrome>,
    );
    expect(fileLabels(container)).toEqual([
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
    ]);
    expect(rankLabels(container)).toEqual([
      '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1',
    ]);
  });

  it('renders a..h / 8..1 for the GEOM_8_FULL (Turkish/Armenian)', () => {
    const { container } = render(
      <BoardChrome geometry={GEOM_8_FULL}>
        <div />
      </BoardChrome>,
    );
    expect(fileLabels(container)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('does not overflow the alphabet at 19×19', () => {
    const { container } = render(
      <BoardChrome geometry={GEOM_19}>
        <div />
      </BoardChrome>,
    );
    const files = fileLabels(container);
    expect(files).toHaveLength(19);
    for (const f of files) {
      expect(f).toMatch(/^[a-s]$/);
    }
  });

  it('respects showRulers={false}', () => {
    const { container } = render(
      <BoardChrome geometry={GEOM_8_DARK} showRulers={false}>
        <div />
      </BoardChrome>,
    );
    expect(fileLabels(container)).toHaveLength(0);
    expect(rankLabels(container)).toHaveLength(0);
  });

  it('sets the ruler font-size custom property based on board cols', () => {
    const { container: c8 } = render(
      <BoardChrome geometry={GEOM_8_DARK}>
        <div />
      </BoardChrome>,
    );
    expect(c8.firstElementChild?.getAttribute('style')).toContain('--ruler-font-size: 0.8rem');

    const { container: c12 } = render(
      <BoardChrome geometry={GEOM_12_DARK}>
        <div />
      </BoardChrome>,
    );
    expect(c12.firstElementChild?.getAttribute('style')).toContain('--ruler-font-size: 0.625rem');
  });
});

describe('BoardChrome — frameDecoration slot (P3.2)', () => {
  it('renders the frameDecoration node inside .boardWrap when supplied', () => {
    const { getByTestId } = render(
      <BoardChrome
        geometry={GEOM_8_DARK}
        frameDecoration={<div data-testid="sentinel">sticky note placeholder</div>}
      >
        <div data-testid="board-content" />
      </BoardChrome>,
    );
    const sentinel = getByTestId('sentinel');
    expect(sentinel).toBeInTheDocument();
    // Sentinel must live inside .frameDecoration which lives inside .boardWrap.
    const decorationDiv = sentinel.parentElement;
    expect(decorationDiv?.className).toContain('frameDecoration');
    expect(decorationDiv?.parentElement?.className).toContain('boardWrap');
  });

  it('omits the .frameDecoration div when frameDecoration prop is undefined', () => {
    const { container } = render(
      <BoardChrome geometry={GEOM_8_DARK}>
        <div data-testid="board-content" />
      </BoardChrome>,
    );
    expect(container.querySelector('[class*="frameDecoration"]')).toBeNull();
  });

  it('marks the frame decoration container aria-hidden so AT does not double-announce', () => {
    const { container } = render(
      <BoardChrome
        geometry={GEOM_8_DARK}
        frameDecoration={<div>placeholder</div>}
      >
        <div />
      </BoardChrome>,
    );
    const decorationDiv = container.querySelector('[class*="frameDecoration"]');
    expect(decorationDiv?.getAttribute('aria-hidden')).toBe('true');
  });
});
