/**
 * Board renderer barrel — import once at module load to register every
 * default renderer in the Task 27.3 registry.
 *
 * Tier tasks (28–34) import their specialised renderers (Morabaraba
 * specialisation, alquerque line-graph overlay, etc.) into their tier module
 * and call `registerBoardRenderer(...)` at import-time per the Task 27.4
 * tier loader.
 */

import type { ComponentType } from 'react';
import type { BoardRendererProps } from './types';
import {
  registerBoardRenderer,
  asRendererKey,
} from './BoardRendererRegistry';
import { SquareBoardRenderer } from './SquareBoardRenderer';
import { RectangleBoardRenderer } from './RectangleBoardRenderer';
import { HexBoardRenderer } from './HexBoardRenderer';
import { RingBoardRenderer } from './RingBoardRenderer';
import { CrossBoardRenderer } from './CrossBoardRenderer';
import { ArcTrackBoardRenderer } from './ArcTrackBoardRenderer';
import { DotBoardRenderer } from './DotBoardRenderer';
import { MancalaPitBoardRenderer } from './MancalaPitBoardRenderer';
import { TerrainOverlayDecorator } from './TerrainOverlayDecorator';

export function registerDefaultBoardRenderers(): void {
  registerBoardRenderer({
    key: asRendererKey('square'),
    kind: 'square',
    component: SquareBoardRenderer,
    supportsPreview: true,
  });
  registerBoardRenderer({
    key: asRendererKey('rectangle'),
    kind: 'rectangle',
    component: RectangleBoardRenderer,
    supportsPreview: true,
  });
  registerBoardRenderer({
    key: asRendererKey('hex-rhombus'),
    kind: 'hex-rhombus',
    component: HexBoardRenderer,
    supportsPreview: true,
  });
  registerBoardRenderer({
    key: asRendererKey('hex-triangular'),
    kind: 'hex-triangular',
    component: HexBoardRenderer,
    supportsPreview: true,
  });
  registerBoardRenderer({
    key: asRendererKey('ring-nmm'),
    kind: 'ring',
    component: RingBoardRenderer,
    supportsPreview: true,
  });
  registerBoardRenderer({
    key: asRendererKey('ring-morabaraba'),
    kind: 'ring',
    component: RingBoardRenderer,
    supportsPreview: true,
    matchesGeometry: (geometry) =>
      geometry.dimensions.ring?.hasCornerDiagonals === true,
  });
  registerBoardRenderer({
    key: asRendererKey('cross'),
    kind: 'cross',
    component: CrossBoardRenderer,
    supportsPreview: true,
  });
  registerBoardRenderer({
    key: asRendererKey('arc-track'),
    kind: 'arc-track',
    component: ArcTrackBoardRenderer,
    supportsPreview: true,
  });
  registerBoardRenderer({
    key: asRendererKey('dot-grid'),
    kind: 'dot-grid',
    component: DotBoardRenderer,
    supportsPreview: true,
  });
  registerBoardRenderer({
    key: asRendererKey('mancala-pit'),
    kind: 'mancala-pit',
    component: MancalaPitBoardRenderer,
    supportsPreview: true,
  });
  registerBoardRenderer({
    key: asRendererKey('terrain-overlay'),
    kind: 'terrain-overlay',
    component: TerrainOverlayDecorator as ComponentType<BoardRendererProps>,
    supportsPreview: true,
  });
}

registerDefaultBoardRenderers();

export * from './BoardRendererRegistry';
export * from './types';
export { BoardChrome } from './BoardChrome';
export { InteractionLayer } from './InteractionLayer';
export { PieceLayer } from './PieceLayer';
export { usePreviewMode } from './usePreviewMode';
export { SquareBoardRenderer } from './SquareBoardRenderer';
export { RectangleBoardRenderer } from './RectangleBoardRenderer';
export { HexBoardRenderer } from './HexBoardRenderer';
export { RingBoardRenderer } from './RingBoardRenderer';
export { CrossBoardRenderer } from './CrossBoardRenderer';
export { ArcTrackBoardRenderer } from './ArcTrackBoardRenderer';
export { animateAlongArc } from './arcAnimation';
export type { ArcAnimationPoint } from './arcAnimation';
export { DotBoardRenderer } from './DotBoardRenderer';
export { MancalaPitBoardRenderer } from './MancalaPitBoardRenderer';
export { TerrainOverlayDecorator } from './TerrainOverlayDecorator';
export {
  registerBaseGeometry,
  getRegisteredBaseGeometry,
} from './baseGeometryRegistry';
