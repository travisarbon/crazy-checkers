/**
 * Theme-pull contract — P3.2 verification gate.
 *
 * Every registered board renderer must consume colors via `theme.*`
 * (React prop) or `var(--…)` (CSS custom property). A renderer that
 * hardcodes a hex literal (e.g. `fill="#b8342a"` in source) would
 * not respond to a theme switch and would silently regress the
 * Margin Notes experience.
 *
 * The test mounts a representative geometry of each registered kind
 * with `marginNotesTheme`, extracts every hex literal that ends up
 * in the rendered DOM, and asserts each one is a value from the
 * Margin Notes palette. Renderers that use `theme.*` JSX-prop
 * access serialize their fills as hex literals (the prop value is
 * substituted at render time), so the assertion is "every literal
 * came from the active theme" — *not* "no literals at all", which
 * would over-flag the legitimate prop pathway. Renderers that use
 * `var(--…)` CSS-custom-property references serialize the literal
 * `var(--…)` string in the DOM (no hex), and pass trivially.
 *
 * A literal that matches no theme field is a hardcoded leakage —
 * exactly the regression this gate exists to catch (e.g. the five
 * `#b8342a` / `#f2c744` / `#4db8c4` / `#6fa661` / `#9879c4` region
 * fills in `TerrainOverlayDecorator`, which is excluded by design;
 * see Open Question 1 in P3.2's plan).
 *
 * New renderers added in Phase 4 Tier 2/3/4/5/6/7 are automatically
 * covered when their geometry kind is added to the GEOMETRIES table
 * below.
 *
 * See: Documentation/UI Overhaul/P3.2-Board-Chrome.md §3.3.5
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { BoardGeometry } from './BoardGeometry';
import { getBoardRenderer } from './BoardRendererRegistry';
import { EMPTY_SELECTION } from './types';
import { marginNotesTheme } from '../../themes/marginnotes';
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
  darkSquaresOnly,
} from '../../engine/boardGeometry';
// Side-effect import: registers every default renderer in the
// `BoardRendererRegistry`. Must come before `getBoardRenderer` is
// invoked below.
import './index';

const HEX_RE = /(?<![\w-])#[0-9A-Fa-f]{3,8}\b/g;

interface GeometryFixture {
  readonly label: string;
  readonly geometry: BoardGeometry;
}

const GEOMETRIES: readonly GeometryFixture[] = [
  {
    label: 'square (8x8 dark)',
    geometry: squareGeometry({
      size: 8,
      indexing: 'squares',
      playableMask: darkSquaresOnly,
      variant: 'pdn-8',
    }),
  },
  {
    label: 'rectangle (8x4)',
    geometry: rectangleGeometry({ width: 8, height: 4, indexing: 'squares' }),
  },
  {
    label: 'hex-rhombus (size 7)',
    geometry: hexRhombusGeometry(7),
  },
  {
    label: 'hex-triangular (size 6)',
    geometry: hexTriangularGeometry(6),
  },
  {
    label: 'ring (Nine Mens Morris)',
    geometry: ringGeometry('nmm'),
  },
  {
    label: 'ring (Morabaraba — predicate-matched)',
    geometry: ringGeometry('morabaraba'),
  },
  {
    label: 'cross (Fox and Geese)',
    geometry: crossGeometry('fox-and-geese'),
  },
  {
    label: 'arc-track (Surakarta)',
    geometry: arcTrackGeometry('surakarta'),
  },
  {
    label: 'dot-grid (Dots and Boxes)',
    geometry: dotGridGeometry({ boxesAcross: 5, boxesDown: 5 }),
  },
  {
    label: 'mancala-pit (Oware 2x6)',
    geometry: mancalaPitGeometry('oware-2x6'),
  },
];

/**
 * Build the set of acceptable hex values from the active theme's
 * fields. Every renderer that consumes `theme.<colorField>` will
 * serialize one of these into the rendered DOM. A literal that's
 * NOT in this set is a hardcoded leakage.
 */
function buildAcceptablePalette(): ReadonlySet<string> {
  const palette = new Set<string>();
  for (const value of Object.values(marginNotesTheme)) {
    if (typeof value === 'string' && HEX_RE.test(value)) {
      palette.add(value.toLowerCase());
    }
    HEX_RE.lastIndex = 0;
  }
  return palette;
}

const ACCEPTABLE_PALETTE = buildAcceptablePalette();

function assertEveryHexIsTheme(html: string, label: string): void {
  HEX_RE.lastIndex = 0;
  const hits = html.match(HEX_RE) ?? [];
  const offenders = hits.filter((hex) => !ACCEPTABLE_PALETTE.has(hex.toLowerCase()));
  const message =
    `${label} produced hardcoded color literals not present in marginNotesTheme — ` +
    `every fill / stroke must flow through theme.* or var(--…). ` +
    `Offending literals: ${offenders.join(', ') || '(none)'}.`;
  expect(offenders, message).toEqual([]);
}

describe('Theme-pull contract — registered renderers (P3.2)', () => {
  for (const fixture of GEOMETRIES) {
    it(`${fixture.label} renders no off-theme color literals`, () => {
      const Renderer = getBoardRenderer(fixture.geometry);
      const { container } = render(
        <Renderer
          geometry={fixture.geometry}
          state={{ pieces: new Map() }}
          selection={EMPTY_SELECTION}
          theme={marginNotesTheme}
          mode="preview"
          size={400}
          ariaLabel={`contract-test-${fixture.label}`}
        />,
      );
      assertEveryHexIsTheme(container.innerHTML, fixture.label);
    });
  }
});
