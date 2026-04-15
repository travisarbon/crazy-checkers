/**
 * Shared type definitions for the Crazy Checkers engine.
 */

/** The two player colors. White moves first. */
export const PieceColor = {
  White: 'WHITE',
  Black: 'BLACK',
} as const;
export type PieceColor = (typeof PieceColor)[keyof typeof PieceColor];

/**
 * All Crazy mode events (see Events and Choice Mode Playbook for details).
 * Phase 2 implements Events 1–7; Events 8–40 are implemented in Phases 3–4.
 * Event 40 (DoubleTrouble) is a meta-event with no decorator — handled by selection logic.
 * The enum is defined up front to establish stable string identifiers for
 * persistence, serialization, and AI worker communication.
 */
export const CrazyEvent = {
  // Phase 2 (core events, Events 1–7)
  KingForADay: 'KING_FOR_A_DAY',
  LiveGrenade: 'LIVE_GRENADE',
  HotPotato: 'HOT_POTATO',
  ChecksMix: 'CHECKS_MIX',
  OppositeDay: 'OPPOSITE_DAY',
  UpInTheAir: 'UP_IN_THE_AIR',
  NoTouching: 'NO_TOUCHING',
  // Phases 3–4 (Events 8–40)
  StepBack: 'STEP_BACK',
  FlippedScript: 'FLIPPED_SCRIPT',
  MarchingOrders: 'MARCHING_ORDERS',
  DealersChoice: 'DEALERS_CHOICE',
  Bodyguard: 'BODYGUARD',
  Quicksand: 'QUICKSAND',
  Conscription: 'CONSCRIPTION',
  GhostWalk: 'GHOST_WALK',
  Landmine: 'LANDMINE',
  Leapfrog: 'LEAPFROG',
  FrozenAssets: 'FROZEN_ASSETS',
  DoubleTime: 'DOUBLE_TIME',
  SafeHaven: 'SAFE_HAVEN',
  ChainReaction: 'CHAIN_REACTION',
  PromotionParty: 'PROMOTION_PARTY',
  Reinforcements: 'REINFORCEMENTS',
  Wormhole: 'WORMHOLE',
  Demotion: 'DEMOTION',
  TimeBomb: 'TIME_BOMB',
  ForcedMarch: 'FORCED_MARCH',
  Ricochet: 'RICOCHET',
  CrownThief: 'CROWN_THIEF',
  Stampede: 'STAMPEDE',
  TollRoad: 'TOLL_ROAD',
  SwapMeet: 'SWAP_MEET',
  RoyalDecree: 'ROYAL_DECREE',
  Backfire: 'BACKFIRE',
  Sentry: 'SENTRY',
  RushHour: 'RUSH_HOUR',
  Haunted: 'HAUNTED',
  Sacrifice: 'SACRIFICE',
  ShrinkingBoard: 'SHRINKING_BOARD',
  // Event 40 — Meta-event (no decorator; handled by selection logic)
  DoubleTrouble: 'DOUBLE_TROUBLE',
} as const;
export type CrazyEvent = (typeof CrazyEvent)[keyof typeof CrazyEvent];

/**
 * An active event instance with remaining duration and optional metadata.
 *
 * All event state that decorators need is encoded here, not in instance
 * variables, to support immutable GameState and correct AI search branching.
 */
export interface ActiveEvent {
  /** Which event this is. */
  readonly type: CrazyEvent;

  /**
   * Remaining half-turns (plies) for this event.
   * - Positive integer: ticks down each ply.
   * - 0: instant effect (Checks Mix) — applied once then removed.
   * - -1: lasts until a condition is met (Live Grenade — until next capture).
   */
  readonly remainingPlies: number;

  /** Which player triggered this event (the player who completed the multi-jump). */
  readonly triggeredBy: PieceColor;

  /** The ply count at which this event was triggered. */
  readonly triggeredAtPly: number;

  /**
   * Whether this event is a permanent Choice mode event that should never
   * be consumed or removed. When true, condition-based events (e.g., Live
   * Grenade) skip their self-removal logic, and player-targeted events
   * (e.g., Hot Potato) apply to both players.
   */
  readonly permanent?: boolean;

  /**
   * Optional event-specific data. Each event type defines its own metadata
   * shape. This field enables stateless decorators: instead of storing state
   * in instance variables, decorators read metadata from the ActiveEvent.
   */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** The game mode determines which rule set and event logic apply. */
export const GameMode = {
  Classic: 'CLASSIC',
  Crazy: 'CRAZY',
  Choice: 'CHOICE',
  Chaos: 'CHAOS',
} as const;
export type GameMode = (typeof GameMode)[keyof typeof GameMode];

/** Piece rank. Pawns promote to kings on the far row. */
export const PieceType = {
  Pawn: 'PAWN',
  King: 'KING',
} as const;
export type PieceType = (typeof PieceType)[keyof typeof PieceType];

/** A piece on the board. */
export interface Piece {
  readonly color: PieceColor;
  readonly type: PieceType;
}

/**
 * A square index on the standard checkers board, numbered 1–32.
 *
 * Standard checkers numbering for an 8×8 board (only dark squares are playable):
 *
 *     Row 0 (top, Black's start / White's king row):  1   2   3   4
 *     Row 1:                                           5   6   7   8
 *     Row 2:                                           9  10  11  12
 *     Row 3:                                          13  14  15  16
 *     Row 4:                                          17  18  19  20
 *     Row 5:                                          21  22  23  24
 *     Row 6:                                          25  26  27  28
 *     Row 7 (bottom, White's start / Black's king row):29  30  31  32
 *
 * Branded type prevents accidentally passing a raw number where a Square is expected.
 */
export type Square = number & { readonly __brand: 'Square' };

/** Creates a Square from a raw number (1–32). Throws on out-of-range values. */
export function square(n: number): Square {
  if (n < 1 || n > 32 || !Number.isInteger(n)) {
    throw new RangeError(`Invalid square number: ${String(n)}. Must be an integer 1–32.`);
  }
  return n as Square;
}

/** Row and column on the 8×8 grid (0-indexed, row 0 = top of board). */
export interface GridPosition {
  readonly row: number; // 0–7, top to bottom
  readonly col: number; // 0–7, left to right
}

/** The state of a single playable square: either empty or occupied by a piece. */
export type SquareState = Piece | null;

/**
 * The board as a flat array of 32 playable squares.
 * Index 0 = square 1, index 31 = square 32.
 * Each element is either a Piece or null (empty).
 */
export type BoardState = readonly SquareState[];

/**
 * A move: a starting square and one or more destination squares.
 * - Simple move: path has 1 element.
 * - Single jump: path has 1 element, captured has 1 element.
 * - Multi-jump: path has N elements (each intermediate landing + final),
 *   captured has N elements (one per jump in the chain).
 */
export interface Move {
  readonly from: Square;
  readonly path: readonly Square[];
  readonly captured: readonly Square[];
}

/** The lifecycle status of a game. */
export const GameStatus = {
  Setup: 'SETUP',
  InProgress: 'IN_PROGRESS',
  GameOver: 'GAME_OVER',
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

/** How a game ended. */
export const GameResultType = {
  WhiteWin: 'WHITE_WIN',
  BlackWin: 'BLACK_WIN',
  Draw: 'DRAW',
} as const;
export type GameResultType = (typeof GameResultType)[keyof typeof GameResultType];

/** The reason a game ended. */
export const GameEndReason = {
  NoPiecesLeft: 'NO_PIECES_LEFT',
  NoLegalMoves: 'NO_LEGAL_MOVES',
  Repetition: 'REPETITION',
  FortyMoveRule: 'FORTY_MOVE_RULE',
  Resignation: 'RESIGNATION',
  Time: 'TIME',
} as const;
export type GameEndReason = (typeof GameEndReason)[keyof typeof GameEndReason];

/** Full game result. */
export interface GameResult {
  readonly type: GameResultType;
  readonly reason: GameEndReason;
}

/** The player types the game needs to distinguish. */
export const PlayerType = {
  Human: 'HUMAN',
  CpuEasy: 'CPU_EASY',
  CpuHard: 'CPU_HARD',
} as const;
export type PlayerType = (typeof PlayerType)[keyof typeof PlayerType];

// ---------------------------------------------------------------------------
// RuleSet interface (defined here to avoid circular dependency with rules.ts)
// ---------------------------------------------------------------------------

/**
 * A complete rule set for a checkers-family game.
 *
 * The game state machine (game.ts) calls these methods to advance the game.
 * The AI calls getLegalMoves and applyMove during search.
 * The UI calls getLegalMoves to highlight valid destinations.
 */
export interface RuleSet {
  /** Returns all legal moves for the active player. */
  getLegalMoves(board: BoardState, activeColor: PieceColor): Move[];

  /** Applies a move to the board, producing a new board state. */
  applyMove(board: BoardState, move: Move): BoardState;

  /** Checks whether the game is over based on the current board and active color. */
  checkGameOver(board: BoardState, activeColor: PieceColor): GameResult | null;

  /** Returns true if a piece on the given square should be promoted. */
  shouldPromote(piece: Piece, sq: Square): boolean;

  // --- Phase 2 extensibility hooks (optional) ---
  onTurnStart?(board: BoardState, activeColor: PieceColor): BoardState;
  onTurnEnd?(board: BoardState, activeColor: PieceColor, move: Move): BoardState;
  onCapture?(board: BoardState, landingSquare: Square, captured: Square[]): BoardState;
  onCheckGameOver?(
    board: BoardState,
    activeColor: PieceColor,
    baseResult: GameResult | null,
  ): GameResult | null;
}

/** Configuration for a game: who is playing each color. */
export interface PlayerSetup {
  readonly white: PlayerType;
  readonly black: PlayerType;
}

/**
 * The complete state of a game at a point in time.
 *
 * Immutable by convention: every function that advances the game returns
 * a new GameState rather than mutating the existing one.
 *
 * Phase 4 (Task 27.4) adds two optional additive fields — `classifiedGameId`
 * and `classifiedState` — populated only by `createNewClassifiedGame`.
 * Phase 3 code that reads `state.board` / `state.ruleSet` continues to
 * operate against the Phase 1 shape unchanged.
 */
export interface GameState {
  /** The current board position. */
  readonly board: BoardState;

  /** Whose turn it is. */
  readonly activeColor: PieceColor;

  /** Current lifecycle status. */
  readonly status: GameStatus;

  /** The result of the game, if status is GameOver. Null otherwise. */
  readonly result: GameResult | null;

  /** The rule set governing this game (imported as type to avoid circular deps). */
  readonly ruleSet: RuleSet;

  /** Who is playing each color. */
  readonly players: PlayerSetup;

  /** Ordered list of moves played so far (oldest first). */
  readonly moveHistory: readonly Move[];

  /**
   * Ordered list of Zobrist hashes for every position that has occurred,
   * including the initial position. Used for threefold repetition detection.
   */
  readonly positionHashes: readonly bigint[];

  /**
   * Count of consecutive half-moves (plies) with no capture and no pawn advance.
   * Reset to 0 whenever a capture or pawn move occurs.
   * Draw is triggered at 80 (40 moves per side, per WCDF rules).
   */
  readonly halfMoveClock: number;

  /**
   * The total number of half-moves (plies) played. Starts at 0.
   * Incremented by 1 after each move.
   */
  readonly plyCount: number;

  /** The game mode. Classic games have no events. */
  readonly mode: GameMode;

  /**
   * Ordered list of currently active events (oldest first).
   * Empty array for Classic mode and for Crazy mode before any event triggers.
   */
  readonly activeEvents: readonly ActiveEvent[];

  /**
   * Optional PRNG for event selection. Used by self-play to force specific events.
   * Not serialized (functions cannot be serialized).
   * When undefined, Math.random is used.
   */
  readonly eventRandomFn?: () => number;

  /**
   * Phase 4 (Task 27.4): when present, this game is a Classified mode game
   * and the interpretive authority is the ClassifiedRuleSet registered
   * under this id. The Phase 1 `board` / `ruleSet` fields are populated
   * with inert defaults for compatibility with consumers that still type
   * against `GameState`; real play flows through the Classified registry.
   */
  readonly classifiedGameId?: string;

  /**
   * Phase 4 (Task 27.4): the Classified-specific state snapshot. Populated
   * only for Classified games. Tier task owners may extend this shape
   * additively without breaking Phase 3 consumers.
   */
  readonly classifiedState?: {
    readonly pieces: ReadonlyMap<number, unknown>;
    readonly turn?: string;
    readonly plyCount?: number;
    readonly moveHistory?: readonly unknown[];
    readonly hands?: unknown;
    readonly placementPhase?: unknown;
    readonly roles?: unknown;
    readonly meta?: Readonly<Record<string, unknown>>;
  };
}

/** Diagonal directions for adjacency lookups. */
export const Direction = {
  ForwardLeft: 'FORWARD_LEFT',
  ForwardRight: 'FORWARD_RIGHT',
  BackwardLeft: 'BACKWARD_LEFT',
  BackwardRight: 'BACKWARD_RIGHT',
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

/** Returns the opposite color. */
export function opponentColor(color: PieceColor): PieceColor {
  return color === PieceColor.White ? PieceColor.Black : PieceColor.White;
}
