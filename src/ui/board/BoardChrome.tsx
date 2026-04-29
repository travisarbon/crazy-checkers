/**
 * BoardChrome — shared ruler + captured-piece-bar + hand/reserve-slot wrapper.
 *
 * Rendered at the game-screen level around a <BoardRenderer />. Rulers read
 * labels from `geometry.coordinateLabels.displayOf` (Task 28.4) so that any
 * board size — 8×8, 10×10, 12×12, up to Go's 19×19 — produces the correct
 * file/rank ruler without overflowing the alphabet by hand. The side-panel
 * slot is the Task 27.5 HandReserve attachment point.
 */

import type { ReactNode } from 'react';
import type { BoardGeometry } from './BoardGeometry';
import { asNodeId } from './BoardGeometry';
import styles from './BoardChrome.module.css';

export interface BoardChromeProps {
  readonly geometry: BoardGeometry;
  readonly children: ReactNode;
  readonly capturedBar?: ReactNode;
  readonly sidePanel?: ReactNode;
  readonly ariaLabel?: string;
  readonly showRulers?: boolean;
  /**
   * Pass-through indicator threaded to the GameScreen shell so renderer +
   * chrome can coordinate per-cell coordinate-glyph visibility. Not
   * consumed by `BoardChrome` itself — the renderer reads it via props.
   */
  readonly showCoordinates?: boolean;
  /**
   * Optional decoration anchored above the board's top edge. P3.4 will
   * use this slot to render the Margin-Notes "sticky-note rule" carrying
   * the active event's flavor text. The slot is theme-gated via
   * `body[data-theme='margin-notes'] .frameDecoration` in the companion
   * CSS module — non-Margin-Notes themes never see it. The slot wrapper
   * is `aria-hidden="true"` so the decoration doesn't double-announce
   * content already exposed by `ActiveEventsIndicator` and
   * `EventAnnouncement`. `pointer-events: none` keeps the slot out of
   * hit-testing so a click on the sticker passes through to the board.
   * P3.2 only exposes the slot; P3.4 fills it.
   * See Documentation/UI Overhaul/P3.2-Board-Chrome.md.
   */
  readonly frameDecoration?: ReactNode;
}

interface RulerLabels {
  readonly files: readonly string[];
  readonly ranks: readonly string[];
}

const FILE_RE = /^([a-z]+)(\d+)$/;

function extractFile(display: string): string {
  const m = FILE_RE.exec(display);
  return m && m[1] !== undefined ? m[1] : display;
}

function extractRank(display: string): string {
  const m = FILE_RE.exec(display);
  return m && m[2] !== undefined ? m[2] : display;
}

function rulerLabels(geometry: BoardGeometry): RulerLabels {
  const dim = geometry.dimensions;
  const sq = dim.square;
  const rc = dim.rectangle;
  const cols = sq?.size ?? rc?.width ?? 0;
  const rows = sq?.size ?? rc?.height ?? 0;
  if (!cols || !rows) return { files: [], ranks: [] };
  const labeler = geometry.coordinateLabels;

  const files: string[] = [];
  for (let c = 0; c < cols; c += 1) {
    const node = asNodeId(0 * cols + c);
    files.push(extractFile(labeler.displayOf(node)));
  }

  const ranks: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    const node = asNodeId(r * cols + 0);
    ranks.push(extractRank(labeler.displayOf(node)));
  }

  return { files, ranks };
}

function rulerFontSizeRem(cols: number): number {
  // Heuristic: smaller boards have larger cells, so larger ruler text.
  // 8×8  → 0.8 rem; 10×10 → 0.7 rem; 12×12+ → 0.625 rem.
  if (cols <= 8) return 0.8;
  if (cols <= 10) return 0.7;
  return 0.625;
}

export function BoardChrome({
  geometry,
  children,
  capturedBar,
  sidePanel,
  ariaLabel,
  showRulers = true,
  showCoordinates: _showCoordinates,
  frameDecoration,
}: BoardChromeProps) {
  void _showCoordinates;
  const { files, ranks } = rulerLabels(geometry);
  const hasRulers = showRulers && (files.length > 0 || ranks.length > 0);
  const cols = files.length > 0 ? files.length : (ranks.length > 0 ? ranks.length : 8);

  return (
    <div
      className={styles.chrome}
      aria-label={ariaLabel}
      role="group"
      style={{
        ['--ruler-font-size' as string]: `${String(rulerFontSizeRem(cols))}rem`,
      }}
    >
      {capturedBar ? <div className={styles.capturedBar}>{capturedBar}</div> : null}
      <div className={styles.body}>
        <div className={styles.boardArea}>
          {hasRulers && ranks.length > 0 ? (
            <div className={styles.ranks} aria-hidden="true">
              {ranks.map((r, i) => (
                <span key={`${r}-${String(i)}`}>{r}</span>
              ))}
            </div>
          ) : null}
          <div className={styles.boardWrap}>
            {frameDecoration ? (
              <div className={styles.frameDecoration} aria-hidden="true">
                {frameDecoration}
              </div>
            ) : null}
            {children}
          </div>
        </div>
        {sidePanel ? <div className={styles.sidePanel}>{sidePanel}</div> : null}
      </div>
      {hasRulers && files.length > 0 ? (
        <div className={styles.files} aria-hidden="true">
          <span className={styles.filesSpacer} />
          {files.map((f, i) => (
            <span key={`${f}-${String(i)}`}>{f}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
