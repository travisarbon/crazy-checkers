/**
 * DraughtsConfig — Phase 4 Tier 1 parameter-space (Task 28.1).
 *
 * The pure-data contract between every Tier 1 Classified draughts variant and
 * the `ParameterizedDraughtsRules` engine that Task 28.2 will author. Every
 * behavioural divergence across the ten Tier 1 games (Russian, Brazilian,
 * Italian, International, Frysk!, Frisian, Malaysian, Canadian, Armenian,
 * Turkish) is expressible through the fields below. Task 28.2's engine is
 * forbidden from branching on `config.gameId` for behaviour — every decision
 * goes through one of the non-identity fields.
 *
 * Authored against:
 *  - Phase 4 Tier 1 Classified Playbook v1.1 §3 "Parameterized Draughts Engine
 *    Architecture" (parameter catalogue) and §4.1..§4.10 (per-game specifications).
 *  - Classified Integration Master Playbook v1.1 §3 "Registration Conventions"
 *    (kebab-case `gameId`s matching `ClassifiedGameId` brand).
 *  - Task 27.2 `BoardGeometry` descriptor (`src/engine/boardGeometry.ts`).
 *  - Task 27.4 `ClassifiedRuleSet`/`ClassifiedGameState` contracts.
 *
 * See `CONFIG_NOTES.md` (co-located) for the parameter-interaction matrix,
 * starting-layout diagrams, and the derivations of every per-game field.
 */

import type { BoardGeometry, NodeId } from '../../boardGeometry';
import { squareGeometry } from '../../boardGeometry';

// ---------------------------------------------------------------------------
// Direction vocabulary
// ---------------------------------------------------------------------------

export type DraughtsDirection =
  | 'nw'
  | 'n'
  | 'ne'
  | 'w'
  | 'e'
  | 'sw'
  | 's'
  | 'se';

export const DIAGONAL_DIRECTIONS: readonly DraughtsDirection[] = Object.freeze([
  'nw',
  'ne',
  'sw',
  'se',
] as const);

export const ORTHOGONAL_DIRECTIONS: readonly DraughtsDirection[] = Object.freeze([
  'n',
  's',
  'e',
  'w',
] as const);

export const ALL_DIRECTIONS: readonly DraughtsDirection[] = Object.freeze([
  ...DIAGONAL_DIRECTIONS,
  ...ORTHOGONAL_DIRECTIONS,
] as const);

const DIAGONAL_SET: ReadonlySet<DraughtsDirection> = new Set(DIAGONAL_DIRECTIONS);
const ORTHOGONAL_SET: ReadonlySet<DraughtsDirection> = new Set(ORTHOGONAL_DIRECTIONS);

// ---------------------------------------------------------------------------
// Parameter enums
// ---------------------------------------------------------------------------

export type KingType = 'short' | 'flying';

export type CapturedPieceRemovalTiming = 'immediate' | 'end-of-sequence';

/**
 * Promotion-behaviour taxonomy (Task 28.2.1 §3 normative rewrite).
 *
 *  - `'standard'` — **promotion-stop.** A man that reaches the opponent back
 *    row during a capture sequence is promoted to king and the turn ends
 *    immediately, even if further captures would be available. Tier 1: Italian.
 *  - `'mid-capture'` — **promote-and-continue.** A man promoted mid-chain
 *    continues the chain as a king using king capture rules. Tier 1:
 *    Russian, Armenian, Turkish.
 *  - `'end-of-turn'` — **stay-as-man-mid-chain.** A man that crosses the back
 *    row mid-chain stays a man for the remainder of the chain; promotion
 *    fires only if the man's final landing square is on the back row. Tier
 *    1: Brazilian, International, Frysk!, Frisian, Malaysian, Canadian.
 */
export type PromotionBehavior = 'standard' | 'mid-capture' | 'end-of-turn';

export type CapturePriorityRule =
  | 'most-pieces'
  | 'most-kings-captured'
  | 'capturing-with-king'
  | 'first-king-earliest'
  | 'kings-weight-1-5';

/**
 * Huffing-mechanism taxonomy (Task 28.1.2).
 *
 * Upgraded from the Task 28.1 `huffingRule: boolean` so variants that adopt
 * huffing can name their specific penalty mechanism.
 *
 *  - `'none'` — no huffing rule (nine of ten Tier 1 variants).
 *  - `'self-piece-forfeit'` — majority Malaysian canonical: the player who
 *    failed to play a mandatory capture forfeits the piece that should have
 *    captured (it is removed from the board). Used by: Malaysian Checkers.
 *  - `'opponent-chooses'` — variant Wikipedia footnote rule: the opponent
 *    chooses which of the mover's pieces to remove.
 *  - `'immediate-loss'` — fringe house rule: failing to take a mandatory
 *    capture is an automatic loss. Not used by any authoritative Tier 1
 *    source; retained on the enum so a future variant can select it.
 */
export type HuffingMechanism =
  | 'none'
  | 'self-piece-forfeit'
  | 'opponent-chooses'
  | 'immediate-loss';

export type StartingLayout =
  | 'dark-squares-3-rows'
  | 'dark-squares-4-rows'
  | 'dark-squares-5-rows'
  | 'dark-squares-back-row-only'
  | 'full-board-rows-2-and-3';

export type DraughtsGameId =
  | 'russian-draughts'
  | 'brazilian-draughts'
  | 'italian-draughts'
  | 'international-checkers'
  | 'frysk'
  | 'frisian-draughts'
  | 'malaysian-checkers'
  | 'canadian-draughts'
  | 'armenian-draughts'
  | 'turkish-draughts';

export const TIER_1_DRAUGHTS_GAME_IDS: readonly DraughtsGameId[] = Object.freeze([
  'russian-draughts',
  'brazilian-draughts',
  'italian-draughts',
  'international-checkers',
  'frysk',
  'frisian-draughts',
  'malaysian-checkers',
  'canadian-draughts',
  'armenian-draughts',
  'turkish-draughts',
] as const);

// ---------------------------------------------------------------------------
// DraughtsConfig contract
// ---------------------------------------------------------------------------

export interface DraughtsConfig {
  readonly gameId: DraughtsGameId;
  readonly displayName: string;

  readonly boardGeometry: BoardGeometry;
  readonly piecesPerSide: number;
  readonly startingLayout: StartingLayout;

  readonly menMoveDirections: readonly DraughtsDirection[];
  readonly kingType: KingType;
  readonly kingMoveDirections: readonly DraughtsDirection[];

  readonly menCaptureDirections: readonly DraughtsDirection[];
  readonly kingCaptureDirections: readonly DraughtsDirection[];
  readonly capturedPieceRemovalTiming: CapturedPieceRemovalTiming;
  readonly menCanCaptureKings: boolean;
  readonly kingOrthogonalCaptureIsLimited: boolean;

  readonly captureObligatory: boolean;
  readonly maximumCaptureMandatory: boolean;
  readonly capturePriorityRules: readonly CapturePriorityRule[];

  readonly promotionBehavior: PromotionBehavior;
  readonly huffingMechanism: HuffingMechanism;
  readonly kingConsecutiveMoveLimit: number | null;
}

/** Narrowing helper: did the variant adopt any huffing mechanism? */
export function hasHuffing(config: DraughtsConfig): boolean {
  return config.huffingMechanism !== 'none';
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export class DraughtsConfigInvariantError extends Error {
  readonly gameId: DraughtsGameId;
  readonly invariant: string;
  constructor(gameId: DraughtsGameId, invariant: string, message: string) {
    super(`[${gameId}] ${invariant}: ${message}`);
    this.name = 'DraughtsConfigInvariantError';
    this.gameId = gameId;
    this.invariant = invariant;
  }
}

function piecesImpliedByLayout(
  layout: StartingLayout,
  boardSize: 8 | 10 | 12,
): number {
  switch (layout) {
    case 'dark-squares-3-rows':
      return 12;
    case 'dark-squares-4-rows':
      return 20;
    case 'dark-squares-5-rows':
      return 30;
    case 'dark-squares-back-row-only':
      return boardSize / 2;
    case 'full-board-rows-2-and-3':
      return boardSize * 2;
  }
}

export function validateDraughtsConfig(config: DraughtsConfig): void {
  const { gameId } = config;
  const size = boardSizeOfInternal(config);

  const expectedPieces = piecesImpliedByLayout(config.startingLayout, size);
  if (expectedPieces !== config.piecesPerSide) {
    throw new DraughtsConfigInvariantError(
      gameId,
      'piecesPerSide matches startingLayout',
      `expected ${String(expectedPieces)} pieces for layout ${config.startingLayout} on ${String(size)}×${String(size)}, got ${String(config.piecesPerSide)}`,
    );
  }

  if (config.kingMoveDirections.length === 0) {
    throw new DraughtsConfigInvariantError(
      gameId,
      'kingMoveDirections non-empty',
      'a king must be able to move in at least one direction',
    );
  }

  // Note: the former "flying king covers menMoveDirections" invariant was
  // removed in Task 28.2.1. Armenian Draughts has asymmetric directions
  // (men: forward diagonals + forward/sideways orthogonal; kings: orthogonal
  // only), which is the rulebook-correct behaviour and violates the old
  // invariant. The invariant was a local sanity check, not a rulebook
  // requirement; its removal is backed by the §2.9 source audit.

  const prios = config.capturePriorityRules;
  const weightIdx = prios.indexOf('kings-weight-1-5');
  if (weightIdx !== -1) {
    const mostPiecesIdx = prios.indexOf('most-pieces');
    if (mostPiecesIdx === -1 || mostPiecesIdx > weightIdx) {
      throw new DraughtsConfigInvariantError(
        gameId,
        "capturePriorityRules 'kings-weight-1-5' ordering",
        "'kings-weight-1-5' is a weighting for 'most-pieces' and must appear after it",
      );
    }
  }

  if (config.kingConsecutiveMoveLimit !== null && config.kingType !== 'flying') {
    throw new DraughtsConfigInvariantError(
      gameId,
      'kingConsecutiveMoveLimit requires flying kings',
      'consecutive-move limits track long-range king drift; short kings cannot accumulate the state',
    );
  }

  if (!config.menCanCaptureKings && !config.captureObligatory) {
    throw new DraughtsConfigInvariantError(
      gameId,
      "'menCanCaptureKings: false' requires captureObligatory",
      "the man/king capture asymmetry only makes sense under mandatory capture",
    );
  }

  if (hasHuffing(config) && config.captureObligatory) {
    throw new DraughtsConfigInvariantError(
      gameId,
      'huffingRule excludes captureObligatory',
      'huffing replaces obligatory-capture enforcement; the two rules are mutually exclusive',
    );
  }
}

// ---------------------------------------------------------------------------
// Narrowing helpers
// ---------------------------------------------------------------------------

function boardSizeOfInternal(config: DraughtsConfig): 8 | 10 | 12 {
  const dim = config.boardGeometry.dimensions.square;
  if (!dim) {
    throw new TypeError(
      `[${config.gameId}] Tier 1 DraughtsConfig must hold a square BoardGeometry`,
    );
  }
  const { size } = dim;
  if (size !== 8 && size !== 10 && size !== 12) {
    throw new TypeError(
      `[${config.gameId}] Tier 1 only supports 8/10/12 square boards, got ${String(size)}`,
    );
  }
  return size;
}

export function boardSizeOf(config: DraughtsConfig): 8 | 10 | 12 {
  return boardSizeOfInternal(config);
}

export function usesDarkSquaresOnly(config: DraughtsConfig): boolean {
  return config.boardGeometry.playableMask !== undefined;
}

export function hasDualAxisCapture(config: DraughtsConfig): boolean {
  return (
    (hasAny(config.menCaptureDirections, DIAGONAL_SET) &&
      hasAny(config.menCaptureDirections, ORTHOGONAL_SET)) ||
    (hasAny(config.kingCaptureDirections, DIAGONAL_SET) &&
      hasAny(config.kingCaptureDirections, ORTHOGONAL_SET))
  );
}

export function hasOrthogonalMenCapture(config: DraughtsConfig): boolean {
  return hasAny(config.menCaptureDirections, ORTHOGONAL_SET);
}

function hasAny(
  dirs: readonly DraughtsDirection[],
  set: ReadonlySet<DraughtsDirection>,
): boolean {
  for (const dir of dirs) if (set.has(dir)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Geometry singletons
// ---------------------------------------------------------------------------

const darkMaskForSize = (size: number) => (node: NodeId): boolean => {
  const idx = node as unknown as number;
  const r = Math.floor(idx / size);
  const c = idx % size;
  return (r + c) % 2 === 1;
};

const GEOM_8_DARK: BoardGeometry = squareGeometry({
  size: 8,
  indexing: 'squares',
  playableMask: darkMaskForSize(8),
  variant: 'pdn-8',
});
const GEOM_10_DARK: BoardGeometry = squareGeometry({
  size: 10,
  indexing: 'squares',
  playableMask: darkMaskForSize(10),
  variant: 'pdn-10',
});
const GEOM_12_DARK: BoardGeometry = squareGeometry({
  size: 12,
  indexing: 'squares',
  playableMask: darkMaskForSize(12),
  variant: 'pdn-12',
});
const GEOM_8_FULL: BoardGeometry = squareGeometry({
  size: 8,
  indexing: 'squares',
});

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function freezeConfig(config: DraughtsConfig): DraughtsConfig {
  Object.freeze(config.menMoveDirections);
  Object.freeze(config.kingMoveDirections);
  Object.freeze(config.menCaptureDirections);
  Object.freeze(config.kingCaptureDirections);
  Object.freeze(config.capturePriorityRules);
  return Object.freeze(config);
}

// ---------------------------------------------------------------------------
// Per-game factories
// ---------------------------------------------------------------------------

const cache = new Map<DraughtsGameId, DraughtsConfig>();

function memoize(
  gameId: DraughtsGameId,
  build: () => DraughtsConfig,
): DraughtsConfig {
  const cached = cache.get(gameId);
  if (cached) return cached;
  const config = freezeConfig(build());
  validateDraughtsConfig(config);
  cache.set(gameId, config);
  return config;
}

export function createRussianDraughtsConfig(): DraughtsConfig {
  return memoize('russian-draughts', () => ({
    gameId: 'russian-draughts',
    displayName: 'Russian Draughts',
    boardGeometry: GEOM_8_DARK,
    piecesPerSide: 12,
    startingLayout: 'dark-squares-3-rows',
    menMoveDirections: ['nw', 'ne'],
    kingType: 'flying',
    kingMoveDirections: [...DIAGONAL_DIRECTIONS],
    menCaptureDirections: [...DIAGONAL_DIRECTIONS],
    kingCaptureDirections: [...DIAGONAL_DIRECTIONS],
    capturedPieceRemovalTiming: 'end-of-sequence',
    menCanCaptureKings: true,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: true,
    maximumCaptureMandatory: false,
    capturePriorityRules: [],
    promotionBehavior: 'mid-capture',
    huffingMechanism: 'none',
    kingConsecutiveMoveLimit: null,
  }));
}

export function createBrazilianDraughtsConfig(): DraughtsConfig {
  return memoize('brazilian-draughts', () => ({
    gameId: 'brazilian-draughts',
    displayName: 'Brazilian Draughts',
    boardGeometry: GEOM_8_DARK,
    piecesPerSide: 12,
    startingLayout: 'dark-squares-3-rows',
    menMoveDirections: ['nw', 'ne'],
    kingType: 'flying',
    kingMoveDirections: [...DIAGONAL_DIRECTIONS],
    menCaptureDirections: [...DIAGONAL_DIRECTIONS],
    kingCaptureDirections: [...DIAGONAL_DIRECTIONS],
    capturedPieceRemovalTiming: 'end-of-sequence',
    menCanCaptureKings: true,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: true,
    maximumCaptureMandatory: true,
    capturePriorityRules: ['most-pieces'],
    promotionBehavior: 'end-of-turn',
    huffingMechanism: 'none',
    kingConsecutiveMoveLimit: null,
  }));
}

export function createItalianDraughtsConfig(): DraughtsConfig {
  return memoize('italian-draughts', () => ({
    gameId: 'italian-draughts',
    displayName: 'Italian Draughts',
    boardGeometry: GEOM_8_DARK,
    piecesPerSide: 12,
    startingLayout: 'dark-squares-3-rows',
    menMoveDirections: ['nw', 'ne'],
    kingType: 'short',
    kingMoveDirections: [...DIAGONAL_DIRECTIONS],
    menCaptureDirections: ['nw', 'ne'],
    kingCaptureDirections: [...DIAGONAL_DIRECTIONS],
    capturedPieceRemovalTiming: 'end-of-sequence',
    menCanCaptureKings: false,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: true,
    maximumCaptureMandatory: true,
    capturePriorityRules: [
      'most-pieces',
      'most-kings-captured',
      'capturing-with-king',
      'first-king-earliest',
    ],
    promotionBehavior: 'standard',
    huffingMechanism: 'none',
    kingConsecutiveMoveLimit: null,
  }));
}

export function createInternationalCheckersConfig(): DraughtsConfig {
  return memoize('international-checkers', () => ({
    gameId: 'international-checkers',
    displayName: 'International Checkers',
    boardGeometry: GEOM_10_DARK,
    piecesPerSide: 20,
    startingLayout: 'dark-squares-4-rows',
    menMoveDirections: ['nw', 'ne'],
    kingType: 'flying',
    kingMoveDirections: [...DIAGONAL_DIRECTIONS],
    menCaptureDirections: [...DIAGONAL_DIRECTIONS],
    kingCaptureDirections: [...DIAGONAL_DIRECTIONS],
    capturedPieceRemovalTiming: 'end-of-sequence',
    menCanCaptureKings: true,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: true,
    maximumCaptureMandatory: true,
    capturePriorityRules: ['most-pieces'],
    promotionBehavior: 'end-of-turn',
    huffingMechanism: 'none',
    kingConsecutiveMoveLimit: null,
  }));
}

export function createFryskConfig(): DraughtsConfig {
  return memoize('frysk', () => ({
    gameId: 'frysk',
    displayName: 'Frysk!',
    boardGeometry: GEOM_10_DARK,
    piecesPerSide: 5,
    startingLayout: 'dark-squares-back-row-only',
    menMoveDirections: ['nw', 'ne'],
    kingType: 'flying',
    kingMoveDirections: [...DIAGONAL_DIRECTIONS, ...ORTHOGONAL_DIRECTIONS],
    menCaptureDirections: [...DIAGONAL_DIRECTIONS, ...ORTHOGONAL_DIRECTIONS],
    kingCaptureDirections: [...DIAGONAL_DIRECTIONS, ...ORTHOGONAL_DIRECTIONS],
    capturedPieceRemovalTiming: 'end-of-sequence',
    menCanCaptureKings: true,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: true,
    maximumCaptureMandatory: true,
    capturePriorityRules: ['most-pieces', 'kings-weight-1-5'],
    promotionBehavior: 'end-of-turn',
    huffingMechanism: 'none',
    kingConsecutiveMoveLimit: 3,
  }));
}

export function createFrisianDraughtsConfig(): DraughtsConfig {
  return memoize('frisian-draughts', () => ({
    gameId: 'frisian-draughts',
    displayName: 'Frisian Draughts',
    boardGeometry: GEOM_10_DARK,
    piecesPerSide: 20,
    startingLayout: 'dark-squares-4-rows',
    menMoveDirections: ['nw', 'ne'],
    kingType: 'flying',
    kingMoveDirections: [...DIAGONAL_DIRECTIONS, ...ORTHOGONAL_DIRECTIONS],
    menCaptureDirections: [...DIAGONAL_DIRECTIONS, ...ORTHOGONAL_DIRECTIONS],
    kingCaptureDirections: [...DIAGONAL_DIRECTIONS, ...ORTHOGONAL_DIRECTIONS],
    capturedPieceRemovalTiming: 'end-of-sequence',
    menCanCaptureKings: true,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: true,
    maximumCaptureMandatory: true,
    capturePriorityRules: ['most-pieces', 'kings-weight-1-5'],
    promotionBehavior: 'end-of-turn',
    huffingMechanism: 'none',
    kingConsecutiveMoveLimit: 3,
  }));
}

export function createMalaysianCheckersConfig(): DraughtsConfig {
  return memoize('malaysian-checkers', () => ({
    gameId: 'malaysian-checkers',
    displayName: 'Malaysian Checkers',
    boardGeometry: GEOM_12_DARK,
    piecesPerSide: 30,
    startingLayout: 'dark-squares-5-rows',
    menMoveDirections: ['nw', 'ne'],
    kingType: 'flying',
    kingMoveDirections: [...DIAGONAL_DIRECTIONS],
    menCaptureDirections: ['nw', 'ne'],
    kingCaptureDirections: [...DIAGONAL_DIRECTIONS],
    capturedPieceRemovalTiming: 'end-of-sequence',
    menCanCaptureKings: true,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: false,
    maximumCaptureMandatory: true,
    capturePriorityRules: ['most-pieces'],
    promotionBehavior: 'end-of-turn',
    huffingMechanism: 'self-piece-forfeit',
    kingConsecutiveMoveLimit: null,
  }));
}

export function createCanadianDraughtsConfig(): DraughtsConfig {
  return memoize('canadian-draughts', () => ({
    gameId: 'canadian-draughts',
    displayName: 'Canadian Draughts',
    boardGeometry: GEOM_12_DARK,
    piecesPerSide: 30,
    startingLayout: 'dark-squares-5-rows',
    menMoveDirections: ['nw', 'ne'],
    kingType: 'flying',
    kingMoveDirections: [...DIAGONAL_DIRECTIONS],
    menCaptureDirections: [...DIAGONAL_DIRECTIONS],
    kingCaptureDirections: [...DIAGONAL_DIRECTIONS],
    capturedPieceRemovalTiming: 'end-of-sequence',
    menCanCaptureKings: true,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: true,
    maximumCaptureMandatory: true,
    capturePriorityRules: ['most-pieces'],
    promotionBehavior: 'end-of-turn',
    huffingMechanism: 'none',
    kingConsecutiveMoveLimit: null,
  }));
}

export function createArmenianDraughtsConfig(): DraughtsConfig {
  return memoize('armenian-draughts', () => ({
    gameId: 'armenian-draughts',
    displayName: 'Armenian Draughts',
    boardGeometry: GEOM_8_FULL,
    piecesPerSide: 16,
    startingLayout: 'full-board-rows-2-and-3',
    menMoveDirections: ['n', 'ne', 'nw', 'e', 'w'],
    kingType: 'flying',
    kingMoveDirections: ['n', 'e', 's', 'w'],
    menCaptureDirections: ['n', 'e', 'w'],
    kingCaptureDirections: ['n', 'e', 's', 'w'],
    capturedPieceRemovalTiming: 'immediate',
    menCanCaptureKings: true,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: true,
    maximumCaptureMandatory: true,
    capturePriorityRules: ['most-pieces'],
    promotionBehavior: 'mid-capture',
    huffingMechanism: 'none',
    kingConsecutiveMoveLimit: null,
  }));
}

export function createTurkishDraughtsConfig(): DraughtsConfig {
  return memoize('turkish-draughts', () => ({
    gameId: 'turkish-draughts',
    displayName: 'Turkish Draughts',
    boardGeometry: GEOM_8_FULL,
    piecesPerSide: 16,
    startingLayout: 'full-board-rows-2-and-3',
    menMoveDirections: ['n', 'e', 'w'],
    kingType: 'flying',
    kingMoveDirections: ['n', 's', 'e', 'w'],
    menCaptureDirections: ['n', 'e', 'w'],
    kingCaptureDirections: ['n', 's', 'e', 'w'],
    capturedPieceRemovalTiming: 'immediate',
    menCanCaptureKings: true,
    kingOrthogonalCaptureIsLimited: false,
    captureObligatory: true,
    maximumCaptureMandatory: true,
    capturePriorityRules: ['most-pieces'],
    promotionBehavior: 'mid-capture',
    huffingMechanism: 'none',
    kingConsecutiveMoveLimit: null,
  }));
}

// ---------------------------------------------------------------------------
// Top-level lookup
// ---------------------------------------------------------------------------

export function createDraughtsConfig(gameId: DraughtsGameId): DraughtsConfig {
  switch (gameId) {
    case 'russian-draughts':
      return createRussianDraughtsConfig();
    case 'brazilian-draughts':
      return createBrazilianDraughtsConfig();
    case 'italian-draughts':
      return createItalianDraughtsConfig();
    case 'international-checkers':
      return createInternationalCheckersConfig();
    case 'frysk':
      return createFryskConfig();
    case 'frisian-draughts':
      return createFrisianDraughtsConfig();
    case 'malaysian-checkers':
      return createMalaysianCheckersConfig();
    case 'canadian-draughts':
      return createCanadianDraughtsConfig();
    case 'armenian-draughts':
      return createArmenianDraughtsConfig();
    case 'turkish-draughts':
      return createTurkishDraughtsConfig();
  }
}
