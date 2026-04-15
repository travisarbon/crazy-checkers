/**
 * <HandReserve> — Shogi/Crazyhouse hand-reserve panel (Task 27.5 §4.4).
 *
 * Consumes `PieceVocabulary.inHand` and `Record<pieceId, count>` per side.
 * Two columns (own / opponent) with count badges and click-to-select.
 * Responsive collapse via container query (`@container (max-width: 768px)`)
 * so nested layouts also collapse correctly. Legality is never checked here —
 * the caller wires `onDropRequest` into `ClassifiedRuleSet.applyMove`.
 */

import type { ReactElement } from 'react';
import { getPieceVisual } from './PieceRegistry';
import { describePiece } from './describePiece';
import type { PieceVocabulary } from '../../engine/classified/pieceVocabulary';
import type { Theme } from '../../themes/theme';
import styles from './HandReserve.module.css';

export type HandReserveLayout = 'panel' | 'drawer' | 'auto';

export interface HandReserveProps {
  readonly vocabulary: PieceVocabulary;
  readonly ownHandCounts: Readonly<Record<string, number>>;
  readonly opponentHandCounts: Readonly<Record<string, number>>;
  readonly theme: Theme;
  readonly selectedPieceId?: string;
  readonly onDropRequest?: (pieceId: string) => void;
  readonly layout?: HandReserveLayout;
  readonly ownLabel?: string;
  readonly opponentLabel?: string;
}

function validateCounts(
  vocabulary: PieceVocabulary,
  counts: Readonly<Record<string, number>>,
  side: string,
): void {
  const valid = new Set(vocabulary.inHand.map((p) => p.pieceId));
  for (const [key, value] of Object.entries(counts)) {
    if (!valid.has(key)) {
      throw new Error(
        `[HandReserve] unknown pieceId "${key}" in ${side} hand; ` +
          `must be in vocabulary.inHand (${[...valid].join(', ')}).`,
      );
    }
    if (value < 0) {
      throw new Error(`[HandReserve] negative count ${String(value)} for "${key}".`);
    }
  }
}

function HandColumn(props: {
  readonly vocabulary: PieceVocabulary;
  readonly counts: Readonly<Record<string, number>>;
  readonly theme: Theme;
  readonly owner: 'white' | 'black';
  readonly label: string;
  readonly selectedPieceId?: string;
  readonly onDropRequest?: (pieceId: string) => void;
  readonly hideZero: boolean;
}): ReactElement {
  const { vocabulary, counts, theme, owner, label, selectedPieceId, onDropRequest, hideZero } =
    props;

  const groups = vocabulary.inHand.filter((p) => {
    if (!hideZero) return true;
    return (counts[p.pieceId] ?? 0) > 0;
  });

  return (
    <div className={styles.column}>
      <div className={styles.columnLabel}>{label}</div>
      {groups.length === 0 ? (
        <div className={styles.empty} data-testid="hand-reserve-empty">
          No pieces in hand
        </div>
      ) : (
        <div className={styles.groupList} role="list">
          {groups.map((piece) => {
            const count = counts[piece.pieceId] ?? 0;
            const spec = getPieceVisual(piece.pieceId);
            const selected = selectedPieceId === piece.pieceId;
            const disabled = count === 0 || !onDropRequest;
            const [vx, vy, vw, vh] = spec.viewBox;
            const label = describePiece(piece.pieceId, {
              location: { kind: 'hand', count },
              selected,
            });
            return (
              <button
                key={piece.pieceId}
                type="button"
                role="listitem"
                aria-label={label}
                disabled={disabled}
                aria-pressed={selected}
                data-piece-id={piece.pieceId}
                data-count={String(count)}
                className={`${styles.group ?? ''} ${selected ? (styles.groupSelected ?? '') : ''}`}
                onClick={() => {
                  if (onDropRequest && !disabled) onDropRequest(piece.pieceId);
                }}
              >
                <svg viewBox={`${String(vx)} ${String(vy)} ${String(vw)} ${String(vh)}`} width={36} height={36}>
                  {spec.render({ theme, owner, radius: 34 })}
                </svg>
                {count > 0 ? <span className={styles.countBadge ?? ''}>{String(count)}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function HandReserve(props: HandReserveProps): ReactElement {
  const {
    vocabulary,
    ownHandCounts,
    opponentHandCounts,
    theme,
    selectedPieceId,
    onDropRequest,
    layout = 'auto',
    ownLabel = 'Your hand',
    opponentLabel = 'Opponent hand',
  } = props;

  validateCounts(vocabulary, ownHandCounts, 'own');
  validateCounts(vocabulary, opponentHandCounts, 'opponent');

  const hideZero = layout === 'drawer';

  return (
    <div
      className={`${styles.reserve ?? ''} ${layout === 'drawer' ? (styles.drawer ?? '') : ''}`}
      data-testid="hand-reserve"
      data-layout={layout}
      aria-label="Hand reserve"
    >
      <HandColumn
        vocabulary={vocabulary}
        counts={ownHandCounts}
        theme={theme}
        owner="white"
        label={ownLabel}
        selectedPieceId={selectedPieceId}
        onDropRequest={onDropRequest}
        hideZero={hideZero}
      />
      <HandColumn
        vocabulary={vocabulary}
        counts={opponentHandCounts}
        theme={theme}
        owner="black"
        label={opponentLabel}
        hideZero={hideZero}
      />
    </div>
  );
}

export default HandReserve;
