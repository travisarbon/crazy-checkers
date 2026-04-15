/**
 * BoardChrome — shared ruler + captured-piece-bar + hand/reserve-slot wrapper.
 *
 * Rendered at the game-screen level around a <BoardRenderer />. Rulers read
 * labels from `geometry.coordinateLabels.displayOf`; side-panel slot is the
 * Task 27.5 HandReserve attachment point.
 */

import type { ReactNode } from 'react';
import type { BoardGeometry } from './BoardGeometry';
import styles from './BoardChrome.module.css';

export interface BoardChromeProps {
  readonly geometry: BoardGeometry;
  readonly children: ReactNode;
  readonly capturedBar?: ReactNode;
  readonly sidePanel?: ReactNode;
  readonly ariaLabel?: string;
  readonly showRulers?: boolean;
}

function fileLabels(geometry: BoardGeometry): readonly string[] {
  const dim = geometry.dimensions;
  if (dim.square) {
    const labels: string[] = [];
    for (let i = 0; i < dim.square.size; i += 1) {
      labels.push(String.fromCharCode('a'.charCodeAt(0) + i));
    }
    return labels;
  }
  if (dim.rectangle) {
    const labels: string[] = [];
    for (let i = 0; i < dim.rectangle.width; i += 1) {
      labels.push(String.fromCharCode('a'.charCodeAt(0) + i));
    }
    return labels;
  }
  return [];
}

function rankLabels(geometry: BoardGeometry): readonly string[] {
  const dim = geometry.dimensions;
  if (dim.square) {
    const sq = dim.square;
    return Array.from({ length: sq.size }, (_, i) => String(sq.size - i));
  }
  if (dim.rectangle) {
    const rc = dim.rectangle;
    return Array.from({ length: rc.height }, (_, i) => String(rc.height - i));
  }
  return [];
}

export function BoardChrome({
  geometry,
  children,
  capturedBar,
  sidePanel,
  ariaLabel,
  showRulers = true,
}: BoardChromeProps) {
  const files = fileLabels(geometry);
  const ranks = rankLabels(geometry);
  const hasRulers = showRulers && (files.length > 0 || ranks.length > 0);

  return (
    <div className={styles.chrome} aria-label={ariaLabel} role="group">
      {capturedBar ? <div className={styles.capturedBar}>{capturedBar}</div> : null}
      <div className={styles.body}>
        <div className={styles.boardArea}>
          {hasRulers && ranks.length > 0 ? (
            <div className={styles.ranks} aria-hidden>
              {ranks.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>
          ) : null}
          <div className={styles.boardWrap}>{children}</div>
        </div>
        {sidePanel ? <div className={styles.sidePanel}>{sidePanel}</div> : null}
      </div>
      {hasRulers && files.length > 0 ? (
        <div className={styles.files} aria-hidden>
          <span className={styles.filesSpacer} />
          {files.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
