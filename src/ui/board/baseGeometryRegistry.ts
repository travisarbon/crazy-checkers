/**
 * Base-geometry registry used by TerrainOverlayDecorator.
 *
 * Overlay geometries only store the base `serializedKey`; reconstructing the
 * base geometry descriptor at render time requires that the base has been
 * registered. Task 27.4's `registerClassifiedGame` will call
 * `registerBaseGeometry(base)` for every Arimaa/Hnefatafl/Halma variant.
 */

import type { BoardGeometry } from './BoardGeometry';

const baseGeometryRegistry = new Map<string, BoardGeometry>();

export function registerBaseGeometry(base: BoardGeometry): void {
  baseGeometryRegistry.set(base.serializedKey, base);
}

export function getRegisteredBaseGeometry(baseKey: string): BoardGeometry | null {
  return baseGeometryRegistry.get(baseKey) ?? null;
}

/** Test-only utility. Production callers must not clear the registry. */
export function __resetBaseGeometryRegistryForTests(): void {
  baseGeometryRegistry.clear();
}
