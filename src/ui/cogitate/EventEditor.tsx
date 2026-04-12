/**
 * EventEditor — toggle list of Crazy events for the Free Play position editor
 * (Task 21.5).
 *
 * Visible only for Crazy and Chaos modes. Lists all Crazy events (excluding
 * the DoubleTrouble meta-event). Toggling an event on adds an ActiveEvent to
 * the list with remainingPlies = -1; toggling off removes it.
 */

import { memo, useMemo, useState } from 'react';
import type { ActiveEvent, CrazyEvent as CrazyEventType } from '../../engine/types';
import { CrazyEvent, PieceColor } from '../../engine/types';

export interface EventEditorProps {
  readonly activeEvents: readonly ActiveEvent[];
  readonly onEventsChange: (events: readonly ActiveEvent[]) => void;
  readonly modeId: string;
  readonly className?: string;
}

function isVisibleFor(modeId: string): boolean {
  return modeId === 'crazy' || modeId === 'chaos';
}

/** All selectable events — all CrazyEvent values except DoubleTrouble. */
function getSelectableEventTypes(): readonly CrazyEventType[] {
  return Object.values(CrazyEvent).filter(
    (e) => e !== CrazyEvent.DoubleTrouble,
  );
}

function prettyName(event: CrazyEventType): string {
  // Convert e.g. "KING_FOR_A_DAY" → "King For A Day"
  return event
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function createActiveEvent(type: CrazyEventType): ActiveEvent {
  return {
    type,
    remainingPlies: -1,
    triggeredBy: PieceColor.White,
    triggeredAtPly: 0,
  };
}

function EventEditor({
  activeEvents,
  onEventsChange,
  modeId,
  className,
}: EventEditorProps) {
  const [query, setQuery] = useState('');

  const selectableTypes = useMemo(() => getSelectableEventTypes(), []);

  const activeSet = useMemo(
    () => new Set(activeEvents.map((e) => e.type)),
    [activeEvents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return selectableTypes;
    return selectableTypes.filter((t) => prettyName(t).toLowerCase().includes(q));
  }, [query, selectableTypes]);

  if (!isVisibleFor(modeId)) return null;

  function toggle(type: CrazyEventType): void {
    if (activeSet.has(type)) {
      onEventsChange(activeEvents.filter((e) => e.type !== type));
    } else {
      onEventsChange([...activeEvents, createActiveEvent(type)]);
    }
  }

  function clearAll(): void {
    onEventsChange([]);
  }

  return (
    <div
      className={className}
      data-testid="event-editor"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        padding: '0.5rem',
        border: '1px solid var(--ui-border, #555)',
        borderRadius: '0.35rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <strong>Active Events ({String(activeEvents.length)})</strong>
        <button
          type="button"
          onClick={clearAll}
          disabled={activeEvents.length === 0}
          data-testid="event-editor-clear-all"
        >
          Clear All
        </button>
      </div>
      <input
        type="search"
        placeholder="Filter events"
        value={query}
        onChange={(e) => { setQuery(e.target.value); }}
        data-testid="event-editor-filter"
      />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          maxHeight: '9rem',
          overflow: 'auto',
        }}
      >
        {filtered.map((type) => {
          const active = activeSet.has(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => { toggle(type); }}
              data-testid={`event-toggle-${type}`}
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.4rem',
                borderRadius: '999px',
                border: '1px solid var(--ui-border, #555)',
                background: active ? 'var(--quality-good, #4caf50)' : 'transparent',
                color: active ? '#000' : 'inherit',
                cursor: 'pointer',
              }}
            >
              {prettyName(type)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(EventEditor);
