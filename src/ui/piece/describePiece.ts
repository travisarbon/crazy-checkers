/**
 * describePiece — registry-dispatched a11y label generator (Task 27.5 §4.6).
 *
 * Generalises the Phase 2/3 private `describePiece(piece, sq)` helper
 * (src/ui/Piece.tsx:59) into a registry-driven public API. Default format:
 *   "{Colour} {kind}{, promoted | , unpromoted}{ on {square} | in hand (×{n})}
 *    { — selected | last moved | capturing}{, stack of {n}}"
 *
 * Per-vocabulary overrides via `PieceVisualSpec.describe`.
 */

import { tryGetPieceVisual } from './PieceRegistry';
import type { PieceA11yContext } from './PieceVisualSpec';

function inferOwnerFromId(pieceId: string): 'white' | 'black' | 'either' {
  const lower = pieceId.toLowerCase();
  if (lower.endsWith('-white')) return 'white';
  if (lower.endsWith('-black')) return 'black';
  return 'either';
}

function capitalise(word: string): string {
  if (word.length === 0) return word;
  return (word.charAt(0).toUpperCase()) + word.slice(1);
}

export function describePiece(pieceId: string, ctx: PieceA11yContext): string {
  const spec = tryGetPieceVisual(pieceId);
  if (spec?.describe !== undefined) {
    return spec.describe(ctx);
  }
  const short = spec?.shortLabel ?? pieceId;
  const owner = inferOwnerFromId(pieceId);

  const colorPart = owner === 'either' ? '' : `${capitalise(owner)} `;
  const kind = owner === 'either' ? capitalise(short) : short.toLowerCase();

  const promoWord =
    ctx.promotionState === 'promoted'
      ? ', promoted'
      : ctx.promotionState === 'unpromoted'
        ? ', unpromoted'
        : '';

  let locPart = '';
  if (ctx.location.kind === 'board') {
    locPart = ` on square ${ctx.location.square}`;
  } else if (ctx.location.kind === 'hand') {
    locPart = ` in hand (×${String(ctx.location.count)})`;
  }

  const stateParts: string[] = [];
  if (ctx.selected) stateParts.push('selected');
  if (ctx.lastMoved) stateParts.push('last moved');
  if (ctx.capturing) stateParts.push('capturing');
  const statePart = stateParts.length > 0 ? ` — ${stateParts.join(', ')}` : '';

  const stackPart =
    ctx.stackDepth !== undefined && ctx.stackDepth > 1
      ? `, stack of ${String(ctx.stackDepth)}`
      : '';

  return `${colorPart}${kind}${promoWord}${locPart}${statePart}${stackPart}`.trim();
}
