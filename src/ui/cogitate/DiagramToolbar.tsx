/**
 * DiagramToolbar — tool + color picker, clear, and PNG export actions for the
 * Free Play diagramming subsystem (Task 21.5).
 */

import { memo } from 'react';
import type { DiagramColor } from '../../cogitate/types';
import type { DiagramTool } from './useDiagramState';
import { useToolbarNavigation } from '../hooks/useToolbarNavigation';
import styles from './DiagramToolbar.module.css';

export interface DiagramToolbarProps {
  readonly activeTool: DiagramTool | null;
  readonly onToolChange: (tool: DiagramTool | null) => void;
  readonly activeColor: DiagramColor;
  readonly onColorChange: (color: DiagramColor) => void;
  readonly hasOverlays: boolean;
  readonly onClearAll: () => void;
  readonly onExportPNG: () => void;
  readonly isExporting: boolean;
  readonly className?: string;
}

const TOOLS: ReadonlyArray<{ tool: DiagramTool; label: string }> = [
  { tool: 'arrow', label: 'Arrow' },
  { tool: 'highlight', label: 'Highlight' },
  { tool: 'annotation', label: 'Text' },
];

const COLORS: ReadonlyArray<{ color: DiagramColor; className: string }> = [
  { color: 'green', className: 'colorGreen' },
  { color: 'red', className: 'colorRed' },
  { color: 'blue', className: 'colorBlue' },
];

function DiagramToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  hasOverlays,
  onClearAll,
  onExportPNG,
  isExporting,
  className,
}: DiagramToolbarProps) {
  const cls = [styles.toolbar, className ?? ''].filter(Boolean).join(' ');
  const { setContainer: toolbarRef, onKeyDown: toolbarKeyDown } =
    useToolbarNavigation<HTMLDivElement>();
  return (
    <div
      className={cls}
      role="toolbar"
      aria-label="Diagram tools"
      data-testid="diagram-toolbar"
      ref={toolbarRef}
      onKeyDown={toolbarKeyDown}
    >
      <div className={styles.group}>
        {TOOLS.map(({ tool, label }) => {
          const isActive = activeTool === tool;
          return (
            <button
              key={tool}
              type="button"
              aria-pressed={isActive}
              className={[
                styles.toolButton,
                isActive ? styles.toolButtonActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { onToolChange(isActive ? null : tool); }}
              data-testid={`diagram-tool-${tool}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <span className={styles.divider} aria-hidden="true" />
      <div className={styles.group} role="radiogroup" aria-label="Diagram color">
        {COLORS.map(({ color, className: colorClass }) => {
          const isActive = activeColor === color;
          const colorKey = colorClass as keyof typeof styles;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`${color} color`}
              tabIndex={isActive ? 0 : -1}
              className={[
                styles.colorSwatch,
                styles[colorKey],
                isActive ? styles.colorSwatchActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { onColorChange(color); }}
              data-testid={`diagram-color-${color}`}
            />
          );
        })}
      </div>
      <span className={styles.divider} aria-hidden="true" />
      <div className={styles.group}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onClearAll}
          disabled={!hasOverlays}
          data-testid="diagram-clear"
        >
          Clear
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onExportPNG}
          disabled={isExporting}
          data-testid="diagram-export"
        >
          {isExporting ? 'Exporting…' : 'Export PNG'}
        </button>
      </div>
    </div>
  );
}

export default memo(DiagramToolbar);
