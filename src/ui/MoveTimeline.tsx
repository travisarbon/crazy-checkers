/**
 * MoveTimeline — scrollable list of moves with paired (White + Black) rows.
 *
 * Supports optional move-quality indicators from the Analysis tool.
 */

import { memo, useCallback, useEffect, useRef } from 'react';
import type { MoveQuality } from '../cogitate/types';
import styles from './MoveTimeline.module.css';

export interface MoveTimelineProps {
  moves: readonly string[];
  currentPly: number;
  onPlySelect: (ply: number) => void;
  moveQualities?: readonly (MoveQuality | null)[];
  className?: string;
  compact?: boolean;
}

const QUALITY_CLASS: Record<MoveQuality, string> = {
  brilliant: styles.indicatorBrilliant ?? '',
  good: styles.indicatorGood ?? '',
  inaccuracy: styles.indicatorInaccuracy ?? '',
  mistake: styles.indicatorMistake ?? '',
  blunder: styles.indicatorBlunder ?? '',
};

const QUALITY_LABEL: Record<MoveQuality, string> = {
  brilliant: 'Brilliant',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

interface Row {
  moveNumber: number;
  white: { ply: number; notation: string; quality: MoveQuality | null };
  black: { ply: number; notation: string; quality: MoveQuality | null } | null;
}

function buildRows(
  moves: readonly string[],
  qualities: readonly (MoveQuality | null)[] | undefined,
): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const white = moves[i];
    if (white === undefined) continue;
    const black = i + 1 < moves.length ? moves[i + 1] : undefined;
    rows.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: { ply: i, notation: white, quality: qualities?.[i] ?? null },
      black:
        black !== undefined
          ? { ply: i + 1, notation: black, quality: qualities?.[i + 1] ?? null }
          : null,
    });
  }
  return rows;
}

function MoveTimeline({
  moves,
  currentPly,
  onPlySelect,
  moveQualities,
  className,
  compact = false,
}: MoveTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (currentRef.current && typeof currentRef.current.scrollIntoView === 'function') {
      currentRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentPly]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(moves.length - 1, currentPly + 1);
        if (next !== currentPly) onPlySelect(next);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(0, currentPly - 1);
        if (prev !== currentPly) onPlySelect(prev);
        return;
      }
    },
    [currentPly, moves.length, onPlySelect],
  );

  if (moves.length === 0) {
    return (
      <div
        className={[styles.root, styles.empty, className ?? ''].filter(Boolean).join(' ')}
        data-testid="move-timeline-empty"
      >
        No moves yet.
      </div>
    );
  }

  const rows = buildRows(moves, moveQualities);
  const rootClasses = [styles.root, compact ? styles.compact : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={scrollRef}
      className={rootClasses}
      role="listbox"
      aria-label="Move timeline"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="move-timeline"
    >
      {rows.map((row) => (
        <div key={row.moveNumber} className={styles.row}>
          <span className={styles.moveNumber} aria-hidden="true">
            {String(row.moveNumber)}.
          </span>
          <MoveCell
            ply={row.white.ply}
            notation={row.white.notation}
            quality={row.white.quality}
            isCurrent={row.white.ply === currentPly}
            onSelect={onPlySelect}
            currentRef={row.white.ply === currentPly ? currentRef : undefined}
          />
          {row.black ? (
            <MoveCell
              ply={row.black.ply}
              notation={row.black.notation}
              quality={row.black.quality}
              isCurrent={row.black.ply === currentPly}
              onSelect={onPlySelect}
              currentRef={row.black.ply === currentPly ? currentRef : undefined}
            />
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

interface MoveCellProps {
  ply: number;
  notation: string;
  quality: MoveQuality | null;
  isCurrent: boolean;
  onSelect: (ply: number) => void;
  currentRef?: React.RefObject<HTMLButtonElement | null>;
}

function MoveCell({
  ply,
  notation,
  quality,
  isCurrent,
  onSelect,
  currentRef,
}: MoveCellProps) {
  const className = [styles.cell, isCurrent ? styles.cellCurrent : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={className}
      role="option"
      aria-selected={isCurrent}
      data-ply={ply}
      data-current={isCurrent ? 'true' : undefined}
      data-testid={`move-timeline-cell-${String(ply)}`}
      onClick={() => {
        onSelect(ply);
      }}
      ref={(node) => {
        if (currentRef) currentRef.current = node;
      }}
    >
      <span>{notation}</span>
      {quality && (
        <span
          className={[styles.indicator, QUALITY_CLASS[quality]].filter(Boolean).join(' ')}
          aria-label={QUALITY_LABEL[quality]}
          data-testid={`quality-${quality}`}
        />
      )}
    </button>
  );
}

export default memo(MoveTimeline);
