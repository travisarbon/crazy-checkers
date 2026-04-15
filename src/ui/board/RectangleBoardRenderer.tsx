/**
 * RectangleBoardRenderer — thin delegation to SquareBoardRenderer's core.
 *
 * Distinct registry entry (not an alias) so Xiangqi 9×10 intersections and
 * Fanorona 9×5 board claim stable serialized keys without renaming to
 * `square-WxH`. The square core already handles `width ≠ height`.
 */

import { memo } from 'react';
import type { BoardRendererProps } from './types';
import { SquareBoardRenderer } from './SquareBoardRenderer';

function RectangleBoardRendererImpl(props: BoardRendererProps) {
  return <SquareBoardRenderer {...props} />;
}

export const RectangleBoardRenderer = memo(RectangleBoardRendererImpl);
