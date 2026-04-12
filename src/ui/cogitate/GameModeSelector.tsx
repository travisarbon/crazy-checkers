/**
 * GameModeSelector — dropdown that lists all Cogitate-registered game modes,
 * grouped by category, for the Free Play tool (Task 21.5).
 *
 * For Phase 3, the selector displays every adapter registered via
 * `listRegisteredAdapterIds()`. Unlock filtering is handled at the registry
 * level (modes without an adapter are already excluded). Classic is always
 * first, followed by Crazy, Chaos, and Choice variants.
 */

import { memo, useMemo } from 'react';
import { listRegisteredAdapterIds } from '../../cogitate/CogitateGameAdapter';
import { getMode } from '../../persistence/gameModeRegistry';

export interface GameModeSelectorProps {
  readonly selectedModeId: string;
  readonly onModeSelect: (modeId: string) => void;
  readonly className?: string;
  /** Optional override for the registered adapters (tests). */
  readonly availableModeIds?: readonly string[];
}

interface ModeOption {
  readonly id: string;
  readonly displayName: string;
  readonly group: 'Standard' | 'Choice' | 'Classified' | 'Other';
}

function classifyMode(id: string, displayName: string): ModeOption['group'] {
  if (id === 'classic' || id === 'crazy' || id === 'chaos') return 'Standard';
  if (id.startsWith('choice')) return 'Choice';
  if (id.startsWith('classified')) return 'Classified';
  void displayName;
  return 'Other';
}

const GROUP_ORDER: ModeOption['group'][] = [
  'Standard',
  'Choice',
  'Classified',
  'Other',
];

function GameModeSelector({
  selectedModeId,
  onModeSelect,
  className,
  availableModeIds,
}: GameModeSelectorProps) {
  const options = useMemo<readonly ModeOption[]>(() => {
    const ids = availableModeIds ?? listRegisteredAdapterIds();
    const list: ModeOption[] = [];
    for (const id of ids) {
      const entry = getMode(id);
      const displayName = entry?.displayName ?? id;
      list.push({ id, displayName, group: classifyMode(id, displayName) });
    }
    // Sort: group order, then numeric/alphabetical by displayName.
    list.sort((a, b) => {
      const ga = GROUP_ORDER.indexOf(a.group);
      const gb = GROUP_ORDER.indexOf(b.group);
      if (ga !== gb) return ga - gb;
      return a.displayName.localeCompare(b.displayName);
    });
    return list;
  }, [availableModeIds]);

  const grouped = useMemo(() => {
    const map = new Map<ModeOption['group'], ModeOption[]>();
    for (const opt of options) {
      const bucket = map.get(opt.group) ?? [];
      bucket.push(opt);
      map.set(opt.group, bucket);
    }
    return map;
  }, [options]);

  return (
    <label className={className} data-testid="game-mode-selector">
      <span style={{ marginRight: '0.5rem' }}>Mode:</span>
      <select
        value={selectedModeId}
        onChange={(e) => { onModeSelect(e.target.value); }}
        data-testid="game-mode-selector-select"
      >
        {GROUP_ORDER.map((group) => {
          const items = grouped.get(group);
          if (!items || items.length === 0) return null;
          return (
            <optgroup key={group} label={group}>
              {items.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.displayName}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </label>
  );
}

export default memo(GameModeSelector);
