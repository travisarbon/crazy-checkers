#!/usr/bin/env tsx
/**
 * P5.1–P5.4 — Generator for the 40 Crazy event icon-pairs.
 *
 * Authoring 80 individual hand-crafted SVGs is the parent plan's
 * largest line item (3–6 weeks of design). The asset spec
 * (`Documentation/UI Overhaul/Phases_4_to_6_Implementation_Plan.md`
 * §P5.1) defines the contract; this generator produces a
 * spec-conforming first cut for every event so the wiring path
 * (P5.5) can land. Each icon-pair is intentionally minimal —
 * single-motif geometry that hints at the event mechanic — and
 * designed to be replaced by hand-authored production assets in
 * later P5.x amendments without changing any consumer code.
 *
 * Each event yields three files:
 *   - `<id>.svg`            — the icon (64×64 viewBox, ink-on-paper)
 *   - `<id>.annotation.svg` — the annotation overlay (80×80, pencil-set)
 *   - `<id>.metadata.json`  — { drawOnDurationMs }
 *
 * After generation, `_index.ts` is auto-emitted with a loader per
 * event id; each loader does a dynamic `import(...)?raw` so Vite
 * splits the assets into per-event chunks (the menu never loads all
 * 40 up front).
 *
 * Run: `tsx scripts/generate-event-icons.ts`
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ICON_DIR = resolve(__dirname, '..', 'src/data/eventIcons');

mkdirSync(ICON_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Icon spec primitives
// ---------------------------------------------------------------------------

const PENCIL_TOKENS = [
  'ballpoint-blue',
  'pencil-green',
  'india-red',
  'highlighter-yellow',
] as const;

/** Pick the deterministic pencil color for an event by its 1-based number. */
function pencilTokenFor(eventNumber: number): string {
  return PENCIL_TOKENS[(eventNumber - 1) % PENCIL_TOKENS.length] ?? 'india-red';
}

interface IconSpec {
  /** 1-based event number (from EVENT_DATA). */
  eventNumber: number;
  /** TypeScript enum key used by EventIconLoader index. */
  enumKey: string;
  /** kebab-case file id. */
  fileId: string;
  /** SVG inner markup for the icon (paths/circles/etc). */
  iconBody: string;
  /** SVG inner markup for the annotation overlay. */
  annotationBody: string;
  /** Draw-on animation duration in ms. */
  drawOnDurationMs: number;
}

/**
 * Wraps an inner body in a 64×64 ink-on-paper SVG that conforms to P5.1.
 * Single ink stroke (var(--ink)), single paper fill (var(--paper)).
 */
function wrapIconSvg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="var(--ink, currentColor)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
${inner}
</svg>`;
}

/**
 * Wraps an inner body in an 80×80 annotation SVG that conforms to P5.1.
 * Pencil-set token used as the stroke color. The stroke is lighter (1) to
 * read as "lighter than ink".
 */
function wrapAnnotationSvg(inner: string, pencilToken: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" stroke="var(--${pencilToken})" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
${inner}
</svg>`;
}

// ---------------------------------------------------------------------------
// Per-event motif library — minimal geometry that hints at mechanic
// ---------------------------------------------------------------------------

// Reusable annotation motifs.
const ANNOTATION_CIRCLE = `<circle cx="40" cy="40" r="32" stroke-dasharray="3 4" />`;
const ANNOTATION_ARROW = `<path d="M14 60 Q 40 8, 66 60" /><path d="M58 52 L 66 60 L 56 62" />`;
const ANNOTATION_STAR = `<path d="M40 16 L 44 34 L 62 38 L 48 50 L 52 68 L 40 58 L 28 68 L 32 50 L 18 38 L 36 34 Z" />`;
const ANNOTATION_SCRIBBLE = `<path d="M12 40 Q 22 24, 32 40 T 52 40 T 72 40" />`;
const ANNOTATION_BANG = `<line x1="40" y1="14" x2="40" y2="48" /><circle cx="40" cy="58" r="2" fill="currentColor" />`;
const ANNOTATION_X = `<path d="M16 16 L 64 64" /><path d="M64 16 L 16 64" />`;
const ANNOTATION_QUESTION = `<path d="M30 26 Q 30 16, 40 16 Q 50 16, 50 26 Q 50 34, 40 38 L 40 48" /><circle cx="40" cy="58" r="2" fill="currentColor" />`;

// Build a piece (checker disc) at center.
function disc(cx: number, cy: number, r: number, withCrown = false): string {
  const crown = withCrown
    ? `<path d="M${String(cx - r * 0.7)} ${String(cy - r * 0.2)} L ${String(cx - r * 0.4)} ${String(cy - r * 0.7)} L ${String(cx)} ${String(cy - r * 0.3)} L ${String(cx + r * 0.4)} ${String(cy - r * 0.7)} L ${String(cx + r * 0.7)} ${String(cy - r * 0.2)} Z" fill="var(--paper)" />`
    : '';
  return `<circle cx="${String(cx)}" cy="${String(cy)}" r="${String(r)}" fill="var(--paper)" />${crown}`;
}

// Centred small square (board cell hint).
function square(cx: number, cy: number, w: number): string {
  return `<rect x="${String(cx - w / 2)}" y="${String(cy - w / 2)}" width="${String(w)}" height="${String(w)}" fill="var(--paper)" />`;
}

// ---------------------------------------------------------------------------
// 40 icon definitions — order matches CrazyEvent enum / EVENT_DATA
// ---------------------------------------------------------------------------

const SPECS: IconSpec[] = [
  // 1 — King for a Day: pawn wearing a crown
  {
    eventNumber: 1,
    enumKey: 'KingForADay',
    fileId: 'king-for-a-day',
    iconBody: `${disc(32, 38, 14)}<path d="M18 24 L 24 16 L 32 22 L 40 16 L 46 24 L 44 28 L 20 28 Z" fill="var(--paper)" />`,
    annotationBody: ANNOTATION_STAR,
    drawOnDurationMs: 800,
  },
  // 2 — Live Grenade: piece with fuse + spark
  {
    eventNumber: 2,
    enumKey: 'LiveGrenade',
    fileId: 'live-grenade',
    iconBody: `${disc(32, 40, 14)}<path d="M32 26 Q 36 18, 44 14" /><path d="M44 14 L 48 10" /><path d="M44 14 L 48 18" /><path d="M44 14 L 50 14" />`,
    annotationBody: ANNOTATION_BANG,
    drawOnDurationMs: 700,
  },
  // 3 — Hot Potato: piece with steam squiggles
  {
    eventNumber: 3,
    enumKey: 'HotPotato',
    fileId: 'hot-potato',
    iconBody: `${disc(32, 42, 14)}<path d="M22 22 Q 22 14, 26 14 T 30 22" /><path d="M32 18 Q 32 10, 36 10 T 40 18" /><path d="M42 22 Q 42 14, 46 14 T 50 22" />`,
    annotationBody: ANNOTATION_SCRIBBLE,
    drawOnDurationMs: 700,
  },
  // 4 — Checks Mix: scattered dots
  {
    eventNumber: 4,
    enumKey: 'ChecksMix',
    fileId: 'checks-mix',
    iconBody: `<circle cx="20" cy="22" r="5" fill="var(--paper)" /><circle cx="44" cy="20" r="5" fill="var(--paper)" /><circle cx="22" cy="44" r="5" fill="var(--paper)" /><circle cx="46" cy="46" r="5" fill="var(--paper)" /><circle cx="34" cy="32" r="5" fill="var(--paper)" />`,
    annotationBody: ANNOTATION_QUESTION,
    drawOnDurationMs: 800,
  },
  // 5 — Opposite Day: circle with diagonal slash (Ø)
  {
    eventNumber: 5,
    enumKey: 'OppositeDay',
    fileId: 'opposite-day',
    iconBody: `<circle cx="32" cy="32" r="20" fill="var(--paper)" /><line x1="14" y1="14" x2="50" y2="50" />`,
    annotationBody: ANNOTATION_X,
    drawOnDurationMs: 700,
  },
  // 6 — Up in the Air: chevron over a piece (flying)
  {
    eventNumber: 6,
    enumKey: 'UpInTheAir',
    fileId: 'up-in-the-air',
    iconBody: `${disc(32, 44, 12)}<path d="M16 30 L 32 16 L 48 30" /><path d="M22 36 L 32 26 L 42 36" />`,
    annotationBody: ANNOTATION_ARROW,
    drawOnDurationMs: 800,
  },
  // 7 — No Touching: two pieces with a vertical bar between
  {
    eventNumber: 7,
    enumKey: 'NoTouching',
    fileId: 'no-touching',
    iconBody: `${disc(18, 32, 10)}${disc(46, 32, 10)}<line x1="32" y1="14" x2="32" y2="50" stroke-dasharray="3 3" />`,
    annotationBody: ANNOTATION_X,
    drawOnDurationMs: 600,
  },
  // 8 — Step-Back: leftward arrow
  {
    eventNumber: 8,
    enumKey: 'StepBack',
    fileId: 'step-back',
    iconBody: `<line x1="14" y1="32" x2="50" y2="32" /><path d="M22 24 L 14 32 L 22 40" />`,
    annotationBody: ANNOTATION_SCRIBBLE,
    drawOnDurationMs: 600,
  },
  // 9 — Flipped Script: rotation arrow
  {
    eventNumber: 9,
    enumKey: 'FlippedScript',
    fileId: 'flipped-script',
    iconBody: `<path d="M48 22 A 18 18 0 1 0 48 42" /><path d="M40 14 L 48 22 L 40 30" />`,
    annotationBody: ANNOTATION_CIRCLE,
    drawOnDurationMs: 800,
  },
  // 10 — Marching Orders: row of chevrons
  {
    eventNumber: 10,
    enumKey: 'MarchingOrders',
    fileId: 'marching-orders',
    iconBody: `<path d="M14 22 L 22 32 L 14 42" /><path d="M26 22 L 34 32 L 26 42" /><path d="M38 22 L 46 32 L 38 42" />`,
    annotationBody: ANNOTATION_ARROW,
    drawOnDurationMs: 900,
  },
  // 11 — Dealer's Choice: a card outline with corner marker
  {
    eventNumber: 11,
    enumKey: 'DealersChoice',
    fileId: 'dealers-choice',
    iconBody: `<rect x="18" y="14" width="28" height="36" rx="3" fill="var(--paper)" /><path d="M28 26 L 36 38" /><path d="M36 26 L 28 38" />`,
    annotationBody: ANNOTATION_QUESTION,
    drawOnDurationMs: 700,
  },
  // 12 — Bodyguard: shield outline
  {
    eventNumber: 12,
    enumKey: 'Bodyguard',
    fileId: 'bodyguard',
    iconBody: `<path d="M32 12 L 50 18 L 50 36 Q 50 48, 32 54 Q 14 48, 14 36 L 14 18 Z" fill="var(--paper)" /><path d="M26 32 L 30 38 L 40 26" />`,
    annotationBody: ANNOTATION_STAR,
    drawOnDurationMs: 900,
  },
  // 13 — Quicksand: piece sinking into curves
  {
    eventNumber: 13,
    enumKey: 'Quicksand',
    fileId: 'quicksand',
    iconBody: `${disc(32, 28, 12)}<path d="M10 44 Q 20 50, 32 44 T 54 44" /><path d="M10 52 Q 20 58, 32 52 T 54 52" />`,
    annotationBody: ANNOTATION_SCRIBBLE,
    drawOnDurationMs: 800,
  },
  // 14 — Conscription: piece with up-arrow (joining ranks)
  {
    eventNumber: 14,
    enumKey: 'Conscription',
    fileId: 'conscription',
    iconBody: `${disc(32, 40, 12)}<line x1="32" y1="28" x2="32" y2="12" /><path d="M26 18 L 32 12 L 38 18" />`,
    annotationBody: ANNOTATION_ARROW,
    drawOnDurationMs: 700,
  },
  // 15 — Ghost Walk: cloud / spectre outline
  {
    eventNumber: 15,
    enumKey: 'GhostWalk',
    fileId: 'ghost-walk',
    iconBody: `<path d="M16 40 Q 16 18, 32 18 Q 48 18, 48 40 L 48 52 L 42 46 L 38 52 L 32 46 L 26 52 L 22 46 L 16 52 Z" fill="var(--paper)" /><circle cx="26" cy="32" r="2" fill="var(--ink, currentColor)" /><circle cx="38" cy="32" r="2" fill="var(--ink, currentColor)" />`,
    annotationBody: ANNOTATION_CIRCLE,
    drawOnDurationMs: 900,
  },
  // 16 — Landmine: explosion star + base
  {
    eventNumber: 16,
    enumKey: 'Landmine',
    fileId: 'landmine',
    iconBody: `<path d="M32 12 L 36 26 L 50 22 L 40 32 L 50 42 L 36 38 L 32 52 L 28 38 L 14 42 L 24 32 L 14 22 L 28 26 Z" fill="var(--paper)" />`,
    annotationBody: ANNOTATION_BANG,
    drawOnDurationMs: 800,
  },
  // 17 — Leapfrog: arc above two squares
  {
    eventNumber: 17,
    enumKey: 'Leapfrog',
    fileId: 'leapfrog',
    iconBody: `<path d="M14 44 Q 32 12, 50 44" />${square(20, 48, 8)}${square(44, 48, 8)}`,
    annotationBody: ANNOTATION_ARROW,
    drawOnDurationMs: 800,
  },
  // 18 — Frozen Assets: snowflake
  {
    eventNumber: 18,
    enumKey: 'FrozenAssets',
    fileId: 'frozen-assets',
    iconBody: `<line x1="32" y1="12" x2="32" y2="52" /><line x1="14" y1="32" x2="50" y2="32" /><line x1="18" y1="18" x2="46" y2="46" /><line x1="46" y1="18" x2="18" y2="46" />`,
    annotationBody: ANNOTATION_STAR,
    drawOnDurationMs: 700,
  },
  // 19 — Double Time: clock face with "2" hand
  {
    eventNumber: 19,
    enumKey: 'DoubleTime',
    fileId: 'double-time',
    iconBody: `<circle cx="32" cy="32" r="20" fill="var(--paper)" /><line x1="32" y1="32" x2="32" y2="18" /><line x1="32" y1="32" x2="44" y2="32" />`,
    annotationBody: ANNOTATION_BANG,
    drawOnDurationMs: 700,
  },
  // 20 — Safe Haven: heart inside a square
  {
    eventNumber: 20,
    enumKey: 'SafeHaven',
    fileId: 'safe-haven',
    iconBody: `<rect x="12" y="12" width="40" height="40" rx="3" fill="var(--paper)" /><path d="M32 44 L 22 32 Q 18 24, 26 24 Q 30 24, 32 28 Q 34 24, 38 24 Q 46 24, 42 32 Z" fill="var(--paper)" />`,
    annotationBody: ANNOTATION_CIRCLE,
    drawOnDurationMs: 800,
  },
  // 21 — Chain Reaction: chain links
  {
    eventNumber: 21,
    enumKey: 'ChainReaction',
    fileId: 'chain-reaction',
    iconBody: `<rect x="14" y="22" width="18" height="20" rx="6" fill="var(--paper)" /><rect x="32" y="22" width="18" height="20" rx="6" fill="var(--paper)" />`,
    annotationBody: ANNOTATION_BANG,
    drawOnDurationMs: 700,
  },
  // 22 — Promotion Party: crown + confetti
  {
    eventNumber: 22,
    enumKey: 'PromotionParty',
    fileId: 'promotion-party',
    iconBody: `<path d="M14 36 L 22 22 L 32 32 L 42 22 L 50 36 Z" fill="var(--paper)" /><circle cx="14" cy="14" r="2" fill="var(--ink, currentColor)" /><circle cx="50" cy="14" r="2" fill="var(--ink, currentColor)" /><circle cx="32" cy="10" r="2" fill="var(--ink, currentColor)" />`,
    annotationBody: ANNOTATION_STAR,
    drawOnDurationMs: 900,
  },
  // 23 — Reinforcements: up arrow with plus
  {
    eventNumber: 23,
    enumKey: 'Reinforcements',
    fileId: 'reinforcements',
    iconBody: `<line x1="32" y1="50" x2="32" y2="20" /><path d="M22 30 L 32 20 L 42 30" /><line x1="22" y1="14" x2="42" y2="14" /><line x1="32" y1="8" x2="32" y2="20" />`,
    annotationBody: ANNOTATION_ARROW,
    drawOnDurationMs: 700,
  },
  // 24 — Wormhole: spiral
  {
    eventNumber: 24,
    enumKey: 'Wormhole',
    fileId: 'wormhole',
    iconBody: `<path d="M32 12 A 20 20 0 1 1 12 32 A 16 16 0 1 1 28 16 A 12 12 0 1 1 16 28 A 8 8 0 1 1 24 20" />`,
    annotationBody: ANNOTATION_CIRCLE,
    drawOnDurationMs: 900,
  },
  // 25 — Demotion: crown with down arrow
  {
    eventNumber: 25,
    enumKey: 'Demotion',
    fileId: 'demotion',
    iconBody: `<path d="M14 24 L 22 14 L 32 22 L 42 14 L 50 24 L 50 30 L 14 30 Z" fill="var(--paper)" /><line x1="32" y1="36" x2="32" y2="52" /><path d="M24 44 L 32 52 L 40 44" />`,
    annotationBody: ANNOTATION_X,
    drawOnDurationMs: 800,
  },
  // 26 — Time Bomb: bomb with timer arc
  {
    eventNumber: 26,
    enumKey: 'TimeBomb',
    fileId: 'time-bomb',
    iconBody: `<circle cx="32" cy="38" r="14" fill="var(--paper)" /><line x1="32" y1="24" x2="32" y2="14" /><path d="M28 14 L 36 14" /><path d="M26 38 A 6 6 0 0 1 32 32" />`,
    annotationBody: ANNOTATION_BANG,
    drawOnDurationMs: 800,
  },
  // 27 — Forced March: exclamation in circle
  {
    eventNumber: 27,
    enumKey: 'ForcedMarch',
    fileId: 'forced-march',
    iconBody: `<circle cx="32" cy="32" r="20" fill="var(--paper)" /><line x1="32" y1="20" x2="32" y2="36" /><circle cx="32" cy="42" r="2" fill="var(--ink, currentColor)" />`,
    annotationBody: ANNOTATION_BANG,
    drawOnDurationMs: 700,
  },
  // 28 — Ricochet: bouncing ball trail
  {
    eventNumber: 28,
    enumKey: 'Ricochet',
    fileId: 'ricochet',
    iconBody: `<path d="M14 14 L 24 32 L 14 50" /><circle cx="44" cy="32" r="6" fill="var(--paper)" /><path d="M24 32 L 38 32" stroke-dasharray="2 3" />`,
    annotationBody: ANNOTATION_ARROW,
    drawOnDurationMs: 800,
  },
  // 29 — Crown Thief: crown with arrow stealing it
  {
    eventNumber: 29,
    enumKey: 'CrownThief',
    fileId: 'crown-thief',
    iconBody: `<path d="M18 30 L 24 18 L 32 26 L 40 18 L 46 30 Z" fill="var(--paper)" /><line x1="32" y1="36" x2="48" y2="52" /><path d="M48 44 L 48 52 L 40 52" />`,
    annotationBody: ANNOTATION_ARROW,
    drawOnDurationMs: 800,
  },
  // 30 — Stampede: 3 chevrons rushing right
  {
    eventNumber: 30,
    enumKey: 'Stampede',
    fileId: 'stampede',
    iconBody: `<path d="M10 18 L 18 32 L 10 46" /><path d="M22 18 L 30 32 L 22 46" /><path d="M34 18 L 42 32 L 34 46" /><path d="M46 18 L 54 32 L 46 46" />`,
    annotationBody: ANNOTATION_ARROW,
    drawOnDurationMs: 900,
  },
  // 31 — Toll Road: barrier with circle (coin)
  {
    eventNumber: 31,
    enumKey: 'TollRoad',
    fileId: 'toll-road',
    iconBody: `<line x1="14" y1="32" x2="50" y2="32" stroke-width="4" /><circle cx="32" cy="20" r="6" fill="var(--paper)" /><line x1="32" y1="16" x2="32" y2="24" /><line x1="28" y1="20" x2="36" y2="20" />`,
    annotationBody: ANNOTATION_X,
    drawOnDurationMs: 700,
  },
  // 32 — Swap Meet: circular swap arrows
  {
    eventNumber: 32,
    enumKey: 'SwapMeet',
    fileId: 'swap-meet',
    iconBody: `<path d="M14 22 L 50 22" /><path d="M44 16 L 50 22 L 44 28" /><path d="M50 42 L 14 42" /><path d="M20 36 L 14 42 L 20 48" />`,
    annotationBody: ANNOTATION_CIRCLE,
    drawOnDurationMs: 800,
  },
  // 33 — Royal Decree: scroll
  {
    eventNumber: 33,
    enumKey: 'RoyalDecree',
    fileId: 'royal-decree',
    iconBody: `<path d="M14 18 Q 14 12, 18 12 L 46 12 Q 50 12, 50 18 L 50 50 Q 50 54, 46 54 L 18 54 Q 14 54, 14 50 Z" fill="var(--paper)" /><line x1="22" y1="24" x2="42" y2="24" /><line x1="22" y1="32" x2="42" y2="32" /><line x1="22" y1="40" x2="36" y2="40" />`,
    annotationBody: ANNOTATION_STAR,
    drawOnDurationMs: 900,
  },
  // 34 — Backfire: X with curved-back arrow
  {
    eventNumber: 34,
    enumKey: 'Backfire',
    fileId: 'backfire',
    iconBody: `<path d="M16 16 L 48 48" /><path d="M48 16 L 16 48" /><path d="M44 16 Q 56 32, 44 48" /><path d="M52 40 L 44 48 L 38 40" />`,
    annotationBody: ANNOTATION_BANG,
    drawOnDurationMs: 800,
  },
  // 35 — Sentry: eye
  {
    eventNumber: 35,
    enumKey: 'Sentry',
    fileId: 'sentry',
    iconBody: `<path d="M8 32 Q 32 12, 56 32 Q 32 52, 8 32 Z" fill="var(--paper)" /><circle cx="32" cy="32" r="6" fill="var(--paper)" /><circle cx="32" cy="32" r="2" fill="var(--ink, currentColor)" />`,
    annotationBody: ANNOTATION_CIRCLE,
    drawOnDurationMs: 800,
  },
  // 36 — Rush Hour: lightning bolt
  {
    eventNumber: 36,
    enumKey: 'RushHour',
    fileId: 'rush-hour',
    iconBody: `<path d="M34 8 L 18 36 L 30 36 L 24 56 L 46 28 L 34 28 Z" fill="var(--paper)" />`,
    annotationBody: ANNOTATION_BANG,
    drawOnDurationMs: 700,
  },
  // 37 — Haunted: classic ghost outline
  {
    eventNumber: 37,
    enumKey: 'Haunted',
    fileId: 'haunted',
    iconBody: `<path d="M14 50 L 14 30 Q 14 12, 32 12 Q 50 12, 50 30 L 50 50 L 44 44 L 38 50 L 32 44 L 26 50 L 20 44 Z" fill="var(--paper)" /><circle cx="26" cy="28" r="2" fill="var(--ink, currentColor)" /><circle cx="38" cy="28" r="2" fill="var(--ink, currentColor)" />`,
    annotationBody: ANNOTATION_QUESTION,
    drawOnDurationMs: 900,
  },
  // 38 — Sacrifice: cross
  {
    eventNumber: 38,
    enumKey: 'Sacrifice',
    fileId: 'sacrifice',
    iconBody: `<line x1="32" y1="10" x2="32" y2="54" stroke-width="3" /><line x1="18" y1="22" x2="46" y2="22" stroke-width="3" />`,
    annotationBody: ANNOTATION_STAR,
    drawOnDurationMs: 700,
  },
  // 39 — Shrinking Board: nested squares
  {
    eventNumber: 39,
    enumKey: 'ShrinkingBoard',
    fileId: 'shrinking-board',
    iconBody: `<rect x="8" y="8" width="48" height="48" fill="var(--paper)" /><rect x="18" y="18" width="28" height="28" fill="var(--paper)" /><rect x="26" y="26" width="12" height="12" fill="var(--paper)" />`,
    annotationBody: ANNOTATION_CIRCLE,
    drawOnDurationMs: 800,
  },
  // 40 — Double Trouble: two bangs
  {
    eventNumber: 40,
    enumKey: 'DoubleTrouble',
    fileId: 'double-trouble',
    iconBody: `<line x1="22" y1="12" x2="22" y2="40" /><circle cx="22" cy="48" r="2" fill="var(--ink, currentColor)" /><line x1="42" y1="12" x2="42" y2="40" /><circle cx="42" cy="48" r="2" fill="var(--ink, currentColor)" />`,
    annotationBody: ANNOTATION_BANG,
    drawOnDurationMs: 800,
  },
];

// ---------------------------------------------------------------------------
// Materialize files
// ---------------------------------------------------------------------------

function writeIfChanged(path: string, content: string): boolean {
  // We always write to keep the index deterministic across runs.
  writeFileSync(path, content);
  return true;
}

let writtenCount = 0;
for (const spec of SPECS) {
  const pencilToken = pencilTokenFor(spec.eventNumber);
  const iconSvg = wrapIconSvg(spec.iconBody);
  const annotationSvg = wrapAnnotationSvg(spec.annotationBody, pencilToken);
  const metadata = JSON.stringify({ drawOnDurationMs: spec.drawOnDurationMs }, null, 2) + '\n';

  writeIfChanged(resolve(ICON_DIR, `${spec.fileId}.svg`), iconSvg + '\n');
  writeIfChanged(resolve(ICON_DIR, `${spec.fileId}.annotation.svg`), annotationSvg + '\n');
  writeIfChanged(resolve(ICON_DIR, `${spec.fileId}.metadata.json`), metadata);
  writtenCount += 3;
}

// ---------------------------------------------------------------------------
// Emit the loader index
// ---------------------------------------------------------------------------

const indexHeader = `/**
 * AUTO-GENERATED by scripts/generate-event-icons.ts.
 *
 * Do not edit by hand. To add or modify an event icon, update the
 * SPECS array in the generator and re-run \`tsx scripts/generate-event-icons.ts\`.
 *
 * Each loader does a dynamic \`import(?raw)\` of the icon + annotation
 * SVG strings so Vite emits a per-event chunk; consumers (EventIcon
 * via React.lazy) never load all 40 up front.
 *
 * Phase 5 — Margin Notes UI Redesign (P5.1, P5.5)
 */

import { CrazyEvent } from '../../engine/types';
import type { EventIconLoader } from '../eventData';

`;

const loaderEntries = SPECS.map((spec) => {
  return `  [CrazyEvent.${spec.enumKey}]: async () => {
    const [icon, annotation, metadata] = await Promise.all([
      import('./${spec.fileId}.svg?raw'),
      import('./${spec.fileId}.annotation.svg?raw'),
      import('./${spec.fileId}.metadata.json'),
    ]);
    return {
      icon: icon.default,
      annotation: annotation.default,
      drawOnDurationMs: (metadata.default as { drawOnDurationMs: number }).drawOnDurationMs,
    };
  },`;
}).join('\n');

const indexBody = `export const EVENT_ICON_LOADERS: Readonly<Partial<Record<CrazyEvent, EventIconLoader>>> = {
${loaderEntries}
};
`;

writeFileSync(resolve(ICON_DIR, '_index.ts'), indexHeader + indexBody);
writtenCount += 1;

console.log(`[generate-event-icons] wrote ${String(writtenCount)} files to ${ICON_DIR}`);
