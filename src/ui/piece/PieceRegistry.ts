/**
 * PieceRegistry — module-level visual-spec registry keyed by pieceId (Task 27.5).
 *
 * Mirrors the Task 27.3 BoardRendererRegistry pattern: side-effectful imports
 * from `src/ui/piece/assets/{family}/index.ts` populate the registry. Loud
 * failure on miss (PieceVisualMissingError) and on conflict
 * (PieceVisualCollisionError); bit-identical re-registration is a no-op (HMR).
 */

import type { PieceVocabularyId } from '../../engine/classified/pieceVocabulary';
import type { Theme } from '../../themes/theme';
import {
  PieceVisualCollisionError,
  PieceVisualMissingError,
  type PieceSvgPart,
  type PieceVisualSpec,
} from './PieceVisualSpec';

const registry = new Map<string, PieceVisualSpec>();
const registrationOrder: string[] = [];

/** Registers a PieceVisualSpec. Idempotent on bit-identical re-registration. */
export function registerPieceVisual(spec: PieceVisualSpec): void {
  const existing = registry.get(spec.pieceId);
  if (existing !== undefined) {
    if (existing === spec) return; // HMR no-op
    throw new PieceVisualCollisionError(spec.pieceId);
  }
  if (import.meta.env.DEV) {
    validatePieceVisualSpec(spec);
  }
  registry.set(spec.pieceId, spec);
  registrationOrder.push(spec.pieceId);
}

/** Returns the registered spec or throws PieceVisualMissingError on miss. */
export function getPieceVisual(pieceId: string): PieceVisualSpec {
  const spec = registry.get(pieceId);
  if (spec === undefined) {
    throw new PieceVisualMissingError(pieceId, [...registry.keys()]);
  }
  return spec;
}

/** Non-throwing variant; returns undefined on miss. */
export function tryGetPieceVisual(pieceId: string): PieceVisualSpec | undefined {
  return registry.get(pieceId);
}

/** Returns all specs belonging to a vocabulary in stable registration order. */
export function listVocabularyVisuals(
  vocabularyId: PieceVocabularyId,
): readonly PieceVisualSpec[] {
  const out: PieceVisualSpec[] = [];
  for (const id of registrationOrder) {
    const s = registry.get(id);
    if (s !== undefined && s.vocabularyId === vocabularyId) out.push(s);
  }
  return out;
}

/** Resolves the fill/stroke/accent colour for a single SVG part. */
export function resolvePieceFill(
  spec: PieceVisualSpec,
  theme: Theme,
  owner: 'white' | 'black' | 'either',
  part: PieceSvgPart,
): string {
  const policy = spec.colorPolicy;
  const themed = owner === 'black' ? themeColor(theme, part, 'black') : themeColor(theme, part, 'white');

  if (policy.kind === 'theme-driven') return themed;
  if (policy.kind === 'absolute') {
    if (part === 'halo') return themed;
    return owner === 'black' ? policy.dark : policy.light;
  }
  // hybrid
  if (policy.themeParts.includes(part)) return themed;
  if (policy.absoluteParts.includes(part)) {
    return owner === 'black' ? policy.dark : policy.light;
  }
  return themed;
}

function themeColor(theme: Theme, part: PieceSvgPart, side: 'white' | 'black'): string {
  if (part === 'stroke') {
    return side === 'white' ? theme.pieceWhiteStroke : theme.pieceBlackStroke;
  }
  if (part === 'accent') return theme.uiAccent;
  if (part === 'halo') return theme.highlightSelected;
  return side === 'white' ? theme.pieceWhite : theme.pieceBlack;
}

/** Test-only: resets module state so tests get isolated registries. */
export function _clearPieceRegistry(): void {
  registry.clear();
  registrationOrder.length = 0;
}

/** Lists all registered pieceIds in registration order. */
export function listRegisteredPieceIds(): readonly string[] {
  return [...registrationOrder];
}

/** Returns true when any registered spec carries the __PIECE_STUB__ flag. */
export function hasStubbedPieces(): boolean {
  for (const s of registry.values()) if (s.__PIECE_STUB__) return true;
  return false;
}

/** Dev-mode runtime validator. Warns on common authoring mistakes. */
export function validatePieceVisualSpec(spec: PieceVisualSpec): void {
  if (spec.flippedPieceId !== undefined && spec.flippedPieceId === spec.pieceId) {
    console.warn(
      `[PieceRegistry] ${spec.pieceId} has flippedPieceId pointing at itself; ` +
        `two-sided pieces must flip to a different pieceId.`,
    );
  }
  if (spec.colorPolicy.kind === 'hybrid') {
    const overlap = spec.colorPolicy.themeParts.find((p) =>
      spec.colorPolicy.kind === 'hybrid' && spec.colorPolicy.absoluteParts.includes(p),
    );
    if (overlap !== undefined) {
      console.warn(
        `[PieceRegistry] ${spec.pieceId} hybrid policy lists "${overlap}" in both ` +
          `themeParts and absoluteParts — absoluteParts wins; remove the duplicate.`,
      );
    }
  }
}
