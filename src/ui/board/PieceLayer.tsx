/**
 * PieceLayer — shared slot every renderer composes with. Task 27.5 replaces
 * the Task 27.3 stub body with a registry-driven dispatch: each NodePosition
 * reads the engine-layer piece-at-node from ClassifiedGameState, then hands
 * off to <Piece> or <StackPiece> based on the presence of a `stack` field
 * on the piece descriptor. The frozen `BoardRendererProps` contract at
 * `src/ui/board/types.ts:39` is preserved and the surrounding imports +
 * `NodePosition`/`PieceLayerProps` interfaces + `memo` export are byte-
 * identical to Task 27.3.
 */

import { memo } from 'react';
import type { BoardGeometry, NodeId } from './BoardGeometry';
import type { ClassifiedGameState, ClassifiedPiece } from '../../engine/classified/state';
import type { Theme } from '../../themes/theme';
import { Piece } from '../piece/Piece';
import { StackPiece } from '../piece/StackPiece';
import { tryGetPieceVisual } from '../piece/PieceRegistry';
import { registerAllPieceFamilies } from '../piece/assets';

// Ensure every scaffold family is registered the first time this layer mounts.
// Tier tasks that supply real art re-register the same pieceIds with their
// final specs (bit-identical HMR re-registration is a no-op).
registerAllPieceFamilies();

export interface NodePosition {
  readonly node: NodeId;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface PieceLayerProps {
  readonly geometry: BoardGeometry;
  readonly state: ClassifiedGameState;
  readonly positions: readonly NodePosition[];
  readonly theme: Theme;
  readonly showSeedCounts?: boolean;
}

function ownerOf(piece: ClassifiedPiece): 'white' | 'black' | 'either' {
  const owner = piece.owner.toLowerCase();
  if (owner === 'white' || owner === 'w' || owner === 'player-1') return 'white';
  if (owner === 'black' || owner === 'b' || owner === 'player-2') return 'black';
  return 'either';
}

/** Derives the canonical registered pieceId from the engine ClassifiedPiece. */
function resolvePieceId(piece: ClassifiedPiece, owner: 'white' | 'black' | 'either'): string {
  const kind = piece.kind.toLowerCase();
  const suffix = owner === 'either' ? '' : `-${owner}`;
  // Preferred: explicit `{kind}{-owner}` (e.g. "pawn-white").
  const explicit = `${kind}${suffix}`;
  if (tryGetPieceVisual(explicit) !== undefined) return explicit;
  // Legacy draughts: `promoted` maps `man` → `king`.
  if (piece.promoted && kind === 'man') {
    const promoted = `king${suffix}`;
    if (tryGetPieceVisual(promoted) !== undefined) return promoted;
  }
  if (kind === 'man') {
    const pawn = `pawn${suffix}`;
    if (tryGetPieceVisual(pawn) !== undefined) return pawn;
  }
  return explicit;
}

function PieceLayerImpl({ state, positions, theme, showSeedCounts }: PieceLayerProps) {
  return (
    <g data-testid="piece-layer">
      {positions.map(({ node, x, y, radius }) => {
        const piece = state.pieces.get(node);
        if (!piece) return null;
        const owner = ownerOf(piece);

        if (showSeedCounts && typeof piece.count === 'number') {
          const seedFill = owner === 'black' ? theme.pieceBlack : theme.pieceWhite;
          const seedText = owner === 'black' ? theme.pieceWhite : theme.pieceBlack;
          return (
            <g key={String(node)} transform={`translate(${String(x)}, ${String(y)})`}>
              <circle r={radius} fill={seedFill} stroke={theme.pieceBlackStroke} strokeWidth={1.5} opacity={0.15} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill={seedText}
                fontSize={radius * 0.8}
                fontFamily="sans-serif"
                fontWeight="bold"
                pointerEvents="none"
              >
                {String(piece.count)}
              </text>
            </g>
          );
        }

        if (piece.stack !== undefined && piece.stack.length > 0) {
          const stackIds = piece.stack.map((p) => resolvePieceId(p, ownerOf(p)));
          const visualsResolved = stackIds.every((id) => tryGetPieceVisual(id) !== undefined);
          if (visualsResolved) {
            return (
              <StackPiece
                key={String(node)}
                stack={stackIds}
                position={{ x, y }}
                owner={owner}
                theme={theme}
                radius={radius}
                squareLabel={String(node)}
              />
            );
          }
        }

        const pieceId = resolvePieceId(piece, owner);
        const spec = tryGetPieceVisual(pieceId);
        if (!spec) return null;
        return (
          <Piece
            key={String(node)}
            pieceId={pieceId}
            owner={owner}
            position={{ x, y }}
            theme={theme}
            radius={radius}
            promotionState={piece.promoted ? 'promoted' : undefined}
            squareLabel={String(node)}
          />
        );
      })}
    </g>
  );
}

export const PieceLayer = memo(PieceLayerImpl);
