/**
 * Shared display-formatting helpers for user-facing labels.
 */

const PLAYER_LABEL_MAP: Record<string, string> = {
  HUMAN: 'Human',
  CPU_EASY: 'CPU (Easy)',
  CPU_HARD: 'CPU (Hard)',
};

export function formatPlayerLabel(player: string): string {
  return PLAYER_LABEL_MAP[player] ?? player;
}

const MODE_ALIASES: Record<string, string> = {
  CLASSIC: 'classic',
  CRAZY: 'crazy',
  CHAOS: 'chaos',
  CHOICE: 'choice',
};

/** Normalizes a GameRecord.mode value to the registry ID format. */
export function normalizeModeId(mode: string): string {
  return MODE_ALIASES[mode] ?? mode;
}

/**
 * Friendly display label for a game record's `mode` field. Handles:
 *  - legacy uppercase engine enum values (CLASSIC -> Classic)
 *  - free-play synthetic ids (freeplay-classic -> Free Play · Classic)
 *  - registered mode ids (looked up via `getDisplayName`)
 *  - unknown raw strings (kebab-case -> Title Case)
 *
 * `getDisplayName` should return the registry entry's displayName for a
 * normalized mode id, or undefined/null when no registry entry exists.
 */
function titleCaseKebab(value: string): string {
  return value
    .split(/[-_]/)
    .map((p) => (p.length === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

export function formatModeLabel(
  mode: string,
  getDisplayName: (normalizedId: string) => string | null | undefined,
): string {
  if (mode.length === 0) return mode;

  // Free Play synthetic mode: "freeplay-<modeId>"
  if (mode.startsWith('freeplay-')) {
    const inner = mode.slice('freeplay-'.length);
    const innerLabel = formatModeLabel(inner, getDisplayName);
    return `Free Play \u00b7 ${innerLabel}`;
  }

  // Classified variants: "classified-<id>" -> "Classified <Name>".
  if (mode.startsWith('classified-')) {
    const entryName = getDisplayName(mode);
    const inner = entryName ?? titleCaseKebab(mode.slice('classified-'.length));
    return `Classified \u2014 ${inner}`;
  }

  // Choice variants: "choice-<id>" -> "Choice <Name>". Use the registry's
  // displayName for the inner label when present; otherwise title-case
  // the kebab-cased remainder.
  if (mode.startsWith('choice-')) {
    const entryName = getDisplayName(mode);
    const inner = entryName ?? titleCaseKebab(mode.slice('choice-'.length));
    return `Choice \u2014 ${inner}`;
  }

  const normalized = normalizeModeId(mode);
  const entryName = getDisplayName(normalized);
  if (entryName) return entryName;

  // Legacy uppercase enum value with no registry entry (e.g. 'CHOICE'
  // without a specific choice mode id): title-case it so the dropdown
  // doesn't scream in caps.
  if (mode === mode.toUpperCase() && /^[A-Z_]+$/.test(mode)) {
    return titleCaseKebab(mode.toLowerCase().replace(/_/g, '-'));
  }

  // Kebab / snake-cased unknown id: "some-thing" -> "Some Thing"
  if (/[-_]/.test(mode)) {
    return titleCaseKebab(mode);
  }

  return mode;
}
