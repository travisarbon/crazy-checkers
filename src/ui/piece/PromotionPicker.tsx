/**
 * <PromotionPicker> — modal picker for chess/shogi promotion (Task 27.5 §4.4).
 *
 * Presentational only: the caller supplies the allowed candidates (promotion
 * legality is the rule-set's concern, landed by Task 33/34). Escape or
 * click-outside fires `onCancel`. ≤2 keypresses (Tab+Enter) to select.
 */

import { useEffect, useMemo, type ReactElement } from 'react';
import { getPieceVisual } from './PieceRegistry';
import { PiecePalette } from './PiecePalette';
import type { PieceDefinition } from '../../engine/classified/pieceVocabulary';
import type { Theme } from '../../themes/theme';
import styles from './PromotionPicker.module.css';

export interface PromotionPickerProps {
  readonly candidates: readonly string[];
  readonly theme: Theme;
  readonly owner?: 'white' | 'black' | 'either';
  readonly onSelect: (pieceId: string) => void;
  readonly onCancel?: () => void;
  readonly title?: string;
}

export function PromotionPicker(props: PromotionPickerProps): ReactElement {
  const { candidates, theme, owner, onSelect, onCancel, title = 'Choose promotion' } = props;

  if (candidates.length === 0) {
    throw new Error('[PromotionPicker] candidates must be non-empty');
  }

  const entries: PieceDefinition[] = useMemo(
    () =>
      candidates.map((pieceId) => {
        const spec = getPieceVisual(pieceId);
        return {
          pieceId,
          displayName: spec.shortLabel,
          owner: owner ?? 'either',
        };
      }),
    [candidates, owner],
  );

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [onCancel]);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      data-testid="promotion-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && onCancel) onCancel();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="promotion-picker"
      >
        <div className={styles.title}>{title}</div>
        <PiecePalette
          entries={entries}
          theme={theme}
          layout="row"
          owner={owner}
          onSelect={onSelect}
          ariaLabel={title}
        />
      </div>
    </div>
  );
}

export default PromotionPicker;
