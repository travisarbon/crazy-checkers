/**
 * BoardRendererRegistry — Task 27.3 pluggable renderer registry.
 *
 * Keyed by BoardGeometryKind with an optional `matchesGeometry` predicate for
 * narrower specificity (used by Morabaraba to claim the `ring` kind when
 * `dimensions.ring.hasCornerDiagonals` is true). Resolution order inside
 * `getBoardRenderer`:
 *
 *   1. First entry whose `kind` matches the geometry AND whose
 *      `matchesGeometry(geometry)` returns true (first predicate wins).
 *   2. Else, first entry whose `kind` matches with no predicate.
 *   3. Else, throw `BoardRendererMissingError`.
 */

import type { ComponentType } from 'react';
import type { BoardGeometry, BoardGeometryKind } from './BoardGeometry';
import type { BoardRendererProps } from './types';

export type RendererKey = string & { readonly __brand: 'RendererKey' };

export const asRendererKey = (s: string): RendererKey => s as RendererKey;

export interface BoardRendererRegistryEntry {
  readonly key: RendererKey;
  readonly kind: BoardGeometryKind;
  readonly component: ComponentType<BoardRendererProps>;
  readonly supportsPreview: boolean;
  readonly matchesGeometry?: (geometry: BoardGeometry) => boolean;
}

export class BoardRendererMissingError extends Error {
  readonly kind: BoardGeometryKind;
  readonly serializedKey: string;
  constructor(geometry: BoardGeometry) {
    super(
      `No BoardRenderer registered for kind="${geometry.kind}" (serializedKey="${geometry.serializedKey}"). ` +
        `Register one via registerBoardRenderer().`,
    );
    this.name = 'BoardRendererMissingError';
    this.kind = geometry.kind;
    this.serializedKey = geometry.serializedKey;
  }
}

const entries: BoardRendererRegistryEntry[] = [];

export function registerBoardRenderer(entry: BoardRendererRegistryEntry): void {
  const existing = entries.findIndex((e) => e.key === entry.key);
  if (existing >= 0) {
    entries[existing] = entry;
    return;
  }
  entries.push(entry);
}

export function getBoardRenderer(
  geometry: BoardGeometry,
): ComponentType<BoardRendererProps> {
  const predicated = entries.find(
    (e) => e.kind === geometry.kind && e.matchesGeometry?.(geometry) === true,
  );
  if (predicated) return predicated.component;
  const fallback = entries.find(
    (e) => e.kind === geometry.kind && !e.matchesGeometry,
  );
  if (fallback) return fallback.component;
  throw new BoardRendererMissingError(geometry);
}

export function tryGetBoardRenderer(
  geometry: BoardGeometry,
): ComponentType<BoardRendererProps> | null {
  try {
    return getBoardRenderer(geometry);
  } catch {
    return null;
  }
}

export function listRegisteredRenderers(): readonly BoardRendererRegistryEntry[] {
  return entries.slice();
}

/** Test-only utility. Production callers must not clear the registry. */
export function __resetBoardRendererRegistryForTests(): void {
  entries.length = 0;
}
