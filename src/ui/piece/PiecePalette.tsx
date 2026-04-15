/**
 * <PiecePalette> — keyboard-navigable piece selector (Task 27.5 §4.4).
 *
 * Filters by `owner` + implicit `location` (derived from the entries list).
 * Roving tabindex + `aria-activedescendant`; arrow keys navigate; Enter/Space
 * activate. Consumed by the Free Play editor (Task 35) and by
 * <PromotionPicker> internally.
 */

import { useMemo, useRef, useState, type ReactElement, type KeyboardEvent } from 'react';
import type { PieceDefinition } from '../../engine/classified/pieceVocabulary';
import { getPieceVisual } from './PieceRegistry';
import { describePiece } from './describePiece';
import type { Theme } from '../../themes/theme';
import styles from './PiecePalette.module.css';

export interface PiecePaletteProps {
  readonly entries: readonly PieceDefinition[];
  readonly theme: Theme;
  readonly selectedId?: string;
  readonly onSelect: (pieceId: string) => void;
  readonly layout?: 'grid' | 'row';
  readonly owner?: 'white' | 'black' | 'either';
  readonly id?: string;
  readonly ariaLabel?: string;
}

export function PiecePalette(props: PiecePaletteProps): ReactElement {
  const {
    entries,
    theme,
    selectedId,
    onSelect,
    layout = 'row',
    owner,
    id,
    ariaLabel = 'Piece palette',
  } = props;

  const filtered = useMemo(() => {
    if (owner === undefined || owner === 'either') return entries;
    return entries.filter((e) => (e.owner ?? 'either') === owner || e.owner === 'either');
  }, [entries, owner]);

  const firstFocusable = filtered[0]?.pieceId;
  const [focusedId, setFocusedId] = useState(selectedId ?? firstFocusable);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = filtered.findIndex((p) => p.pieceId === focusedId);
    if (currentIndex === -1) return;
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight' || (layout === 'grid' && e.key === 'ArrowDown')) {
      nextIndex = Math.min(filtered.length - 1, currentIndex + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || (layout === 'grid' && e.key === 'ArrowUp')) {
      nextIndex = Math.max(0, currentIndex - 1);
      e.preventDefault();
    } else if (e.key === 'Home') {
      nextIndex = 0;
      e.preventDefault();
    } else if (e.key === 'End') {
      nextIndex = filtered.length - 1;
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const current = filtered[currentIndex];
      if (current) onSelect(current.pieceId);
      return;
    }
    const next = filtered[nextIndex];
    if (next) setFocusedId(next.pieceId);
  };

  const radius = 22;

  return (
    <div
      ref={containerRef}
      id={id}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={focusedId ? `${id ?? 'palette'}-${focusedId}` : undefined}
      tabIndex={0}
      className={`${styles.palette ?? ''} ${layout === 'grid' ? (styles.paletteGrid ?? '') : ''}`}
      onKeyDown={handleKeyDown}
      data-testid="piece-palette"
    >
      {filtered.map((entry) => {
        const isSelected = entry.pieceId === selectedId;
        const spec = getPieceVisual(entry.pieceId);
        const label = describePiece(entry.pieceId, { location: { kind: 'palette' } });
        const itemOwner = entry.owner ?? owner ?? 'either';
        const [vx, vy, vw, vh] = spec.viewBox;
        return (
          <button
            key={entry.pieceId}
            id={`${id ?? 'palette'}-${entry.pieceId}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            aria-label={label}
            data-piece-id={entry.pieceId}
            className={`${styles.option ?? ''} ${isSelected ? (styles.optionSelected ?? '') : ''}`}
            onClick={() => {
              onSelect(entry.pieceId);
              setFocusedId(entry.pieceId);
            }}
            onFocus={() => {
              setFocusedId(entry.pieceId);
            }}
          >
            <svg viewBox={`${String(vx)} ${String(vy)} ${String(vw)} ${String(vh)}`} width={radius * 2} height={radius * 2}>
              {spec.render({ theme, owner: itemOwner, radius: radius * 1.6 })}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export default PiecePalette;
