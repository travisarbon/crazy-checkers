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
