/**
 * Scrollable list of moves in standard checkers notation.
 *
 * Displays moves in paired rows (White + Black per row) with the current
 * move highlighted. Collapsible on mobile via <details>/<summary>.
 */

import { useRef, useEffect } from 'react';
import type { Move } from '../engine/types';
import { moveToString } from '../utils/notation';
import styles from './MoveHistory.module.css';

interface MoveHistoryProps {
  moveHistory: readonly Move[];
  currentMoveIndex: number;
  collapsible?: boolean;
  onMoveClick?: (plyIndex: number) => void;
}

interface MoveRow {
  moveNumber: number;
  whiteNotation: string;
  whitePlyIndex: number;
  blackNotation: string | null;
  blackPlyIndex: number | null;
}

function buildMoveRows(moveHistory: readonly Move[]): MoveRow[] {
  const rows: MoveRow[] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    const whiteMove = moveHistory[i];
    if (!whiteMove) continue;
    const blackMove = i + 1 < moveHistory.length ? (moveHistory[i + 1] ?? null) : null;
    rows.push({
      moveNumber: Math.floor(i / 2) + 1,
      whiteNotation: moveToString(whiteMove),
      whitePlyIndex: i,
      blackNotation: blackMove ? moveToString(blackMove) : null,
      blackPlyIndex: blackMove ? i + 1 : null,
    });
  }
  return rows;
}

function MoveList({
  moveHistory,
  currentMoveIndex,
}: {
  moveHistory: readonly Move[];
  currentMoveIndex: number;
}) {
  const currentMoveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (currentMoveRef.current && typeof currentMoveRef.current.scrollIntoView === 'function') {
      currentMoveRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [currentMoveIndex]);

  if (moveHistory.length === 0) {
    return (
      <div className={styles.placeholder} data-testid="move-history-empty">
        No moves yet.
      </div>
    );
  }

  const rows = buildMoveRows(moveHistory);

  return (
    <div className={styles.scrollable} data-testid="move-history-list">
      {rows.map((row) => (
        <div key={row.moveNumber} className={styles.moveRow}>
          <span className={styles.moveNumber}>{row.moveNumber}.</span>
          <span
            className={`${styles.moveCell ?? ''} ${row.whitePlyIndex === currentMoveIndex ? (styles.moveCurrent ?? '') : ''}`}
            ref={row.whitePlyIndex === currentMoveIndex ? currentMoveRef : undefined}
            data-ply={row.whitePlyIndex}
          >
            {row.whiteNotation}
          </span>
          <span
            className={`${styles.moveCell ?? ''} ${row.blackPlyIndex === currentMoveIndex ? (styles.moveCurrent ?? '') : ''}`}
            ref={row.blackPlyIndex === currentMoveIndex ? currentMoveRef : undefined}
            data-ply={row.blackPlyIndex ?? undefined}
          >
            {row.blackNotation ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MoveHistory({
  moveHistory,
  currentMoveIndex,
  collapsible = false,
}: MoveHistoryProps) {
  const content = (
    <MoveList moveHistory={moveHistory} currentMoveIndex={currentMoveIndex} />
  );

  if (collapsible) {
    return (
      <details className={styles.collapsible} data-testid="move-history">
        <summary className={styles.summary}>
          Move History ({moveHistory.length} moves)
        </summary>
        {content}
      </details>
    );
  }

  return (
    <div data-testid="move-history">
      <div className={styles.heading}>Move History</div>
      {content}
    </div>
  );
}
