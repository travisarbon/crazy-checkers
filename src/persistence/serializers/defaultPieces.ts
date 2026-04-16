/**
 * Task 27.6 — recursive `ClassifiedPiece` ↔ JSON walker.
 *
 * Shared by the default serializer (§2.4) and by Tier 2 stacking games
 * (Task 36.2) so stack composition round-trips through a single, tested
 * encoder. The walker is recursive because `ClassifiedPiece.stack` itself
 * holds `ClassifiedPiece[]` to arbitrary depth.
 */

import type { ClassifiedPiece } from '../../engine/classified/state';
import type { JsonValue } from './types';

/** Encodes a piece into a stable, JSON-safe object literal. */
export function encodePiece(piece: ClassifiedPiece): JsonValue {
  const out: Record<string, JsonValue> = {
    owner: piece.owner,
    kind: piece.kind,
  };
  if (piece.promoted !== undefined) out.promoted = piece.promoted;
  if (piece.orientation !== undefined) out.orientation = piece.orientation;
  if (piece.count !== undefined) out.count = piece.count;
  if (piece.stack !== undefined) {
    out.stack = piece.stack.map((child) => encodePiece(child));
  }
  return out;
}

/** Decodes a JSON literal back into a structural `ClassifiedPiece`. */
export function decodePiece(json: JsonValue): ClassifiedPiece {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError(`expected piece object, got ${typeof json}`);
  }
  const obj = json as Record<string, JsonValue>;
  if (typeof obj.owner !== 'string' || typeof obj.kind !== 'string') {
    throw new TypeError('piece JSON missing required owner/kind strings');
  }

  const piece: {
    owner: string;
    kind: string;
    promoted?: boolean;
    orientation?: 0 | 90 | 180 | 270;
    stack?: readonly ClassifiedPiece[];
    count?: number;
  } = { owner: obj.owner, kind: obj.kind };

  if (obj.promoted !== undefined) {
    if (typeof obj.promoted !== 'boolean') {
      throw new TypeError('piece.promoted must be boolean');
    }
    piece.promoted = obj.promoted;
  }
  if (obj.orientation !== undefined) {
    const o = obj.orientation;
    if (o !== 0 && o !== 90 && o !== 180 && o !== 270) {
      const repr = typeof o === 'number' ? String(o) : JSON.stringify(o);
      throw new TypeError(`piece.orientation must be 0/90/180/270, got ${repr}`);
    }
    piece.orientation = o;
  }
  if (obj.count !== undefined) {
    if (typeof obj.count !== 'number' || !Number.isFinite(obj.count)) {
      throw new TypeError('piece.count must be a finite number');
    }
    piece.count = obj.count;
  }
  if (obj.stack !== undefined) {
    if (!Array.isArray(obj.stack)) {
      throw new TypeError('piece.stack must be an array');
    }
    piece.stack = (obj.stack as readonly JsonValue[]).map((child) => decodePiece(child));
  }
  return piece;
}
