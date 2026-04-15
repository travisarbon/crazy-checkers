/**
 * BoardRenderer public contract (Task 27.3).
 *
 * Every concrete renderer in the registry accepts the shape defined here.
 * Consumers (GameScreen, CogitateBoard, BoardPreviewLarge, the Classified
 * gallery, Free Play position editor) import this type + the registry; they
 * never import a concrete renderer module.
 */

import type { ReactNode } from 'react';
import type { BoardGeometry, NodeId } from './BoardGeometry';
import type { ClassifiedGameState } from '../../engine/classified/state';
import type { Theme } from '../../themes/theme';

export type InteractionKind =
  | 'click'
  | 'alt-click'
  | 'drag-start'
  | 'drag-end'
  | 'hover-enter'
  | 'hover-leave'
  | 'focus'
  | 'keyboard-activate';

export interface SelectionState {
  readonly selected: NodeId | null;
  readonly legalTargets: ReadonlySet<NodeId>;
  readonly lastMove: { readonly from: NodeId; readonly to: NodeId } | null;
}

export const EMPTY_SELECTION: SelectionState = {
  selected: null,
  legalTargets: new Set(),
  lastMove: null,
};

export type RenderMode = 'interactive' | 'preview' | 'replay';

export interface BoardRendererProps {
  readonly geometry: BoardGeometry;
  readonly state: ClassifiedGameState;
  readonly selection: SelectionState;
  readonly onNodeInteract?: (node: NodeId, kind: InteractionKind) => void;
  readonly overlays?: ReactNode;
  readonly theme: Theme;
  readonly mode: RenderMode;
  readonly size?: number;
  readonly ariaLabel: string;
}
