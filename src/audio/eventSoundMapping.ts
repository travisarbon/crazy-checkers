/**
 * Event sound mapping.
 *
 * Previously each CrazyEvent had its own trigger SFX. We now route every
 * event activation through the single `SoundEvent.EventTrigger` sound, so
 * this module only exposes a trivial lookup that always returns null
 * (kept for type-backwards compatibility with call sites that still
 * consult it).
 */

export interface EventSound {
  readonly url: string;
  readonly volume: number;
}

/** Returns null for every event — the call site falls back to the unified EventTrigger SFX. */
export function getEventSound(): EventSound | null {
  return null;
}
